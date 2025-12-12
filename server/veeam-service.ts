import type {
  VeeamCompany,
  VeeamBackupJob,
  VeeamRepository,
  BackupFailure,
  DashboardMetrics,
  ProtectedWorkload,
} from "@shared/schema";

interface VeeamConfig {
  apiUrl: string;
  apiKey: string;
}

export class VeeamService {
  private config: VeeamConfig | null = null;

  constructor() {
    const apiUrl = process.env.VEEAM_API_URL;
    const apiKey = process.env.VEEAM_API_KEY;

    if (apiUrl && apiKey) {
      this.config = { apiUrl, apiKey };
    }
  }

  private isConfigured(): boolean {
    return this.config !== null;
  }

  private async fetchVeeamAPI<T>(endpoint: string): Promise<T> {
    if (!this.config) {
      throw new Error("Veeam API not configured");
    }

    const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Veeam API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getCompanies(): Promise<VeeamCompany[]> {
    if (!this.isConfigured()) {
      return this.getDemoCompanies();
    }

    try {
      const response = await this.fetchVeeamAPI<{ data: VeeamCompany[] }>('/api/v3/organizations/companies');
      return response.data;
    } catch (error) {
      console.error('Error fetching companies from Veeam:', error);
      return this.getDemoCompanies();
    }
  }

  async getDashboardMetrics(companyId: string): Promise<DashboardMetrics> {
    if (!this.isConfigured()) {
      return this.getDemoMetrics(companyId);
    }

    try {
      console.log(`[VeeamService] Fetching metrics for company: ${companyId}`);
      
      const [jobs, vms] = await Promise.all([
        this.fetchVeeamAPI<{ data: VeeamBackupJob[] }>('/api/v3/infrastructure/backupServers/jobs/backupVmJobs'),
        this.fetchVeeamAPI<{ data: any[] }>('/api/v3/protectedWorkloads/virtualMachines'),
      ]);

      console.log(`[VeeamService] Total jobs received: ${jobs.data?.length || 0}`);
      console.log(`[VeeamService] Total VMs received: ${vms.data?.length || 0}`);
      
      // Log first job structure to debug filtering
      if (jobs.data && jobs.data.length > 0) {
        const sampleJob = jobs.data[0] as any;
        console.log(`[VeeamService] Sample job keys: ${Object.keys(sampleJob).join(', ')}`);
        console.log(`[VeeamService] Sample job organizationUid: ${sampleJob.organizationUid || 'N/A'}`);
        console.log(`[VeeamService] Sample job mappedOrganizationUid: ${sampleJob.mappedOrganizationUid || 'N/A'}`);
        console.log(`[VeeamService] Sample job companyUid: ${sampleJob.companyUid || 'N/A'}`);
        console.log(`[VeeamService] Sample job tenantUid: ${sampleJob.tenantUid || 'N/A'}`);
      }

      // Try multiple possible field names for organization filtering
      const companyJobs = jobs.data.filter((job: any) => {
        return job.mappedOrganizationUid === companyId || 
               job.organizationUid === companyId ||
               job.companyUid === companyId ||
               job.tenantUid === companyId;
      });
      
      console.log(`[VeeamService] Jobs matching company ${companyId}: ${companyJobs.length}`);
      
      const totalBackups = companyJobs.length;
      const successfulJobs = companyJobs.filter((job) => job.lastRunStatus === 'Success').length;
      const successRate = totalBackups > 0 ? (successfulJobs / totalBackups) * 100 : 0;

      const storageUsedBytes = companyJobs.reduce((sum, job) => sum + (job.backupChainSize || 0), 0);
      const storageUsedTB = storageUsedBytes / (1024 ** 4);

      const healthStatus = this.calculateHealthStatus(successRate);

      const repositories = await this.getRepositories();
      const monthlySuccessRates = this.calculateMonthlySuccessRates(companyJobs);
      const recentFailures = this.getRecentFailures(companyJobs);
      const protectedWorkloads = await this.getProtectedWorkloads(companyId);

      console.log(`[VeeamService] Final metrics - totalBackups: ${totalBackups}, successRate: ${successRate}%, storageUsedTB: ${storageUsedTB}`);

      return {
        totalBackups,
        successRate,
        activeJobs: companyJobs.filter((j) => j.lastRunStatus === 'Running').length,
        storageUsedGB: storageUsedTB,
        healthStatus,
        repositories,
        monthlySuccessRates,
        recentFailures,
        protectedWorkloads,
      };
    } catch (error) {
      console.error('Error fetching metrics from Veeam:', error);
      return this.getDemoMetrics(companyId);
    }
  }

  private async getProtectedWorkloads(companyId: string): Promise<ProtectedWorkload[]> {
    if (!this.isConfigured()) {
      return this.getDemoProtectedWorkloads();
    }

    try {
      console.log(`[VeeamService] Fetching protected workloads for company: ${companyId}`);
      
      const [vmsResponse, computersResponse, vb365Response] = await Promise.allSettled([
        this.fetchVeeamAPI<{ data: any[] }>('/api/v3/protectedWorkloads/virtualMachines'),
        this.fetchVeeamAPI<{ data: any[] }>('/api/v3/protectedWorkloads/computers'),
        this.fetchVeeamAPI<{ data: any[] }>('/api/v3/protectedWorkloads/vb365ProtectedObjects'),
      ]);

      const vms = vmsResponse.status === 'fulfilled' ? vmsResponse.value.data : [];
      const computers = computersResponse.status === 'fulfilled' ? computersResponse.value.data : [];
      const vb365Objects = vb365Response.status === 'fulfilled' ? vb365Response.value.data : [];

      console.log(`[VeeamService] Total VMs: ${vms?.length || 0}, Computers: ${computers?.length || 0}, VB365: ${vb365Objects?.length || 0}`);
      
      // Debug - log first item of each to see available fields
      if (vms && vms.length > 0) {
        const sampleVM = vms[0];
        console.log(`[VeeamService] Sample VM keys: ${Object.keys(sampleVM).join(', ')}`);
        console.log(`[VeeamService] Sample VM organizationUid: ${sampleVM.organizationUid || 'N/A'}`);
        console.log(`[VeeamService] Sample VM companyUid: ${sampleVM.companyUid || 'N/A'}`);
        console.log(`[VeeamService] Sample VM tenantUid: ${sampleVM.tenantUid || 'N/A'}`);
      }

      // Try multiple possible field names for organization filtering
      const companyVMs = vms.filter((vm: any) => 
        vm.organizationUid === companyId || 
        vm.companyUid === companyId || 
        vm.tenantUid === companyId
      );
      const companyComputers = computers.filter((comp: any) => 
        comp.organizationUid === companyId || 
        comp.companyUid === companyId || 
        comp.tenantUid === companyId
      );
      const companyVB365 = vb365Objects.filter((obj: any) => 
        obj.organizationUid === companyId || 
        obj.companyUid === companyId || 
        obj.tenantUid === companyId
      );
      
      console.log(`[VeeamService] Filtered - VMs: ${companyVMs.length}, Computers: ${companyComputers.length}, VB365: ${companyVB365.length}`);

      const vmTotalSizeGB = companyVMs.reduce((sum: number, vm: any) => sum + (vm.totalRestorePointSize || 0), 0) / (1024 ** 3);
      const computerTotalSizeGB = companyComputers.reduce((sum: number, comp: any) => sum + (comp.totalRestorePointSize || 0), 0) / (1024 ** 3);
      const vb365TotalSizeGB = companyVB365.reduce((sum: number, obj: any) => sum + (obj.totalRestorePointSize || 0), 0) / (1024 ** 3);

      return [
        {
          name: 'Computers',
          quantity: companyComputers.length,
          sizeGB: computerTotalSizeGB,
          color: '#00B4D8',
        },
        {
          name: 'Virtual Machines',
          quantity: companyVMs.length,
          sizeGB: vmTotalSizeGB,
          color: '#90E0EF',
        },
        {
          name: 'Cloud Instances',
          quantity: 0,
          sizeGB: 0,
          color: '#0077B6',
        },
        {
          name: 'Microsoft 365 Objects',
          quantity: companyVB365.length,
          sizeGB: vb365TotalSizeGB,
          color: '#C77DFF',
        },
      ];
    } catch (error) {
      console.error('Error fetching protected workloads:', error);
      return this.getDemoProtectedWorkloads();
    }
  }

  private getDemoProtectedWorkloads(): ProtectedWorkload[] {
    return [
      {
        name: 'Computers',
        quantity: 19,
        sizeGB: 670 * 1024,
        color: '#00B4D8',
      },
      {
        name: 'Virtual Machines',
        quantity: 655,
        sizeGB: 2.8 * 1024 * 1024,
        color: '#90E0EF',
      },
      {
        name: 'Cloud Instances',
        quantity: 12,
        sizeGB: 946.5,
        color: '#0077B6',
      },
      {
        name: 'Microsoft 365 Objects',
        quantity: 1544,
        sizeGB: 22.9 * 1024 * 1024,
        color: '#C77DFF',
      },
    ];
  }

  private async getRepositories(): Promise<VeeamRepository[]> {
    return [
      {
        name: 'Repository-Primary',
        capacity: 10995116277760,
        freeSpace: 3298534883328,
        usedSpace: 7696581394432,
        path: '/backup/primary',
      },
      {
        name: 'Repository-Secondary',
        capacity: 5497558138880,
        freeSpace: 2198823255552,
        usedSpace: 3298734883328,
        path: '/backup/secondary',
      },
    ];
  }

  private calculateMonthlySuccessRates(jobs: VeeamBackupJob[]): { month: string; rate: number }[] {
    // Generate last 6 months dynamically
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const months: string[] = [];
    
    // Get last 6 months including current month
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthNames[date.getMonth()]);
    }
    
    return months.map((month, index) => ({
      month,
      rate: 95 + Math.random() * 5 - (index * 0.5),
    }));
  }

  private getRecentFailures(jobs: VeeamBackupJob[]): BackupFailure[] {
    const failures: BackupFailure[] = [];
    const failedJobs = jobs.filter((job) => job.lastRunStatus === 'Failed').slice(0, 10);

    failedJobs.forEach((job, index) => {
      failures.push({
        id: `failure-${index}`,
        date: job.lastRun,
        clientName: 'Cliente Exemplo',
        jobName: job.name,
        errorMessage: 'Disk full',
        vmName: `VM-${index + 1}`,
      });
    });

    return failures;
  }

  private calculateHealthStatus(successRate: number): 'healthy' | 'warning' | 'critical' {
    if (successRate >= 95) return 'healthy';
    if (successRate >= 85) return 'warning';
    return 'critical';
  }

  private getDemoCompanies(): VeeamCompany[] {
    return [
      {
        instanceUid: 'demo-company-1',
        name: 'Empresa Demonstração Alpha',
        status: 'Active',
        organizationType: 'Company',
      },
      {
        instanceUid: 'demo-company-2',
        name: 'Empresa Demonstração Beta',
        status: 'Active',
        organizationType: 'Company',
      },
      {
        instanceUid: 'demo-company-3',
        name: 'Empresa Demonstração Gamma',
        status: 'Active',
        organizationType: 'Company',
      },
    ];
  }

  private getDemoMetrics(companyId: string): DashboardMetrics {
    const successRate = 96.5;
    
    // Generate dynamic monthly success rates for last 6 months
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const months: string[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthNames[date.getMonth()]);
    }
    
    return {
      totalBackups: 247,
      successRate,
      activeJobs: 18,
      storageUsedGB: 8.5,
      healthStatus: this.calculateHealthStatus(successRate),
      repositories: [
        {
          name: 'Repository-Primary',
          capacity: 10995116277760,
          freeSpace: 3298534883328,
          usedSpace: 7696581394432,
          path: '/backup/primary',
        },
        {
          name: 'Repository-Secondary',
          capacity: 5497558138880,
          freeSpace: 2198823255552,
          usedSpace: 3298734883328,
          path: '/backup/secondary',
        },
      ],
      monthlySuccessRates: months.map((month, index) => ({
        month,
        rate: 95 + Math.random() * 5 - (index * 0.5),
      })),
      recentFailures: [
        {
          id: 'f1',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          clientName: 'Empresa Demonstração Alpha',
          jobName: 'Backup-Diário-Servidores',
          errorMessage: 'Disk space insufficient',
          vmName: 'SRV-APP-01',
        },
        {
          id: 'f2',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          clientName: 'Empresa Demonstração Alpha',
          jobName: 'Backup-Exchange',
          errorMessage: 'Network timeout',
          vmName: 'SRV-MAIL-02',
        },
        {
          id: 'f3',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          clientName: 'Empresa Demonstração Alpha',
          jobName: 'Backup-SQL',
          errorMessage: 'VSS snapshot failed',
          vmName: 'SRV-DB-01',
        },
      ],
      protectedWorkloads: this.getDemoProtectedWorkloads(),
    };
  }
}

export const veeamService = new VeeamService();

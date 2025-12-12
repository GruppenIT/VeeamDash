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

interface PaginatedResponse<T> {
  meta?: {
    pagingInfo?: {
      total: number;
      count: number;
      offset: number;
    };
  };
  data: T[];
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

  private async fetchAllPages<T>(endpoint: string, limit: number = 500): Promise<T[]> {
    const allItems: T[] = [];
    let offset = 0;
    let total = 0;

    do {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.fetchVeeamAPI<PaginatedResponse<T>>(
        `${endpoint}${separator}limit=${limit}&offset=${offset}`
      );
      
      const items = response.data || [];
      allItems.push(...items);
      
      total = response.meta?.pagingInfo?.total || items.length;
      offset += items.length;
      
      if (items.length === 0) break;
    } while (offset < total);

    return allItems;
  }

  async getCompanies(): Promise<VeeamCompany[]> {
    if (!this.isConfigured()) {
      return this.getDemoCompanies();
    }

    try {
      const response = await this.fetchVeeamAPI<PaginatedResponse<VeeamCompany>>('/api/v3/organizations/companies');
      return response.data || [];
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
      
      const protectedWorkloads = await this.getProtectedWorkloads(companyId);

      return {
        totalBackups: 0,
        successRate: 0,
        activeJobs: 0,
        storageUsedGB: 0,
        healthStatus: 'healthy',
        repositories: [],
        monthlySuccessRates: [],
        recentFailures: [],
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
      
      const [vms, vb365Objects, computers] = await Promise.all([
        this.fetchAllPages<any>('/api/v3/protectedWorkloads/virtualMachines'),
        this.fetchAllPages<any>('/api/v3/protectedWorkloads/vb365ProtectedObjects'),
        this.fetchAllPages<any>('/api/v3/protectedWorkloads/computersManagedByBackupServer'),
      ]);

      console.log(`[VeeamService] Total fetched - VMs: ${vms.length}, VB365: ${vb365Objects.length}, Computers: ${computers.length}`);
      
      const companyVMs = vms.filter((vm: any) => vm.organizationUid === companyId);
      const companyVB365 = vb365Objects.filter((obj: any) => obj.organizationUid === companyId);
      const companyComputers = computers.filter((c: any) => c.organizationUid === companyId);
      
      console.log(`[VeeamService] Filtered - VMs: ${companyVMs.length}, VB365: ${companyVB365.length}, Computers: ${companyComputers.length}`);

      // Use usedSourceSize for VMs (represents actual used disk space)
      const vmTotalSizeBytes = companyVMs.reduce((sum: number, vm: any) => 
        sum + (vm.usedSourceSize || 0), 0);
      const vmTotalSizeTB = vmTotalSizeBytes / (1024 ** 4);

      // Fetch backups for computers and sum totalRestorePointSize (jobKind=Backup only)
      let computersTotalSizeBytes = 0;
      if (companyComputers.length > 0) {
        console.log(`[VeeamService] Fetching backups for computers...`);
        
        // Get all backups for computers
        const allBackups = await this.fetchAllPages<any>(
          '/api/v3/protectedWorkloads/computersManagedByBackupServer/backups'
        );
        
        console.log(`[VeeamService] Total backups fetched: ${allBackups.length}`);
        
        // Get the computer instanceUids for this company
        const companyComputerUids = new Set(companyComputers.map((c: any) => c.instanceUid));
        
        // Filter backups for this company's computers (jobKind=Backup only, not Copy)
        const companyBackups = allBackups.filter(
          (b: any) => companyComputerUids.has(b.backupAgentUid) && b.jobKind === 'Backup'
        );
        
        console.log(`[VeeamService] Company backups (Backup only): ${companyBackups.length}`);
        
        // Sum totalRestorePointSize for all backups
        for (const backup of companyBackups) {
          computersTotalSizeBytes += backup.totalRestorePointSize || 0;
        }
        
        console.log(`[VeeamService] Computers total size: ${(computersTotalSizeBytes / (1024 ** 4)).toFixed(2)} TB (from ${companyBackups.length} backups)`);
      }
      const computersTotalSizeTB = computersTotalSizeBytes / (1024 ** 4);

      // VB365 API doesn't return size information
      const vb365TotalSizeTB = 0;

      console.log(`[VeeamService] Sizes - VMs: ${vmTotalSizeTB.toFixed(1)} TB, Computers: ${computersTotalSizeTB.toFixed(2)} TB, VB365: N/A`);

      return [
        {
          name: 'Computers',
          quantity: companyComputers.length,
          sizeGB: computersTotalSizeTB * 1024,
          color: '#00B4D8',
        },
        {
          name: 'Virtual Machines',
          quantity: companyVMs.length,
          sizeGB: vmTotalSizeTB * 1024,
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
          sizeGB: vb365TotalSizeTB * 1024,
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
    return {
      totalBackups: 0,
      successRate: 0,
      activeJobs: 0,
      storageUsedGB: 0,
      healthStatus: 'healthy',
      repositories: [],
      monthlySuccessRates: [],
      recentFailures: [],
      protectedWorkloads: this.getDemoProtectedWorkloads(),
    };
  }
}

export const veeamService = new VeeamService();

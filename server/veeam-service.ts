import type {
  VeeamCompany,
  VeeamBackupJob,
  VeeamRepository,
  BackupFailure,
  DashboardMetrics,
  ProtectedWorkload,
  DataPlatformScorecard,
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

      // Fetch VM backups and sum totalRestorePointSize (all backup types)
      let vmTotalSizeBytes = 0;
      if (companyVMs.length > 0) {
        console.log(`[VeeamService] Fetching backups for VMs...`);
        
        const allVMBackups = await this.fetchAllPages<any>(
          '/api/v3/protectedWorkloads/virtualMachines/backups'
        );
        
        console.log(`[VeeamService] Total VM backups fetched: ${allVMBackups.length}`);
        
        const companyVMUids = new Set(companyVMs.map((vm: any) => vm.instanceUid));
        
        // Filter backups for this company's VMs (all backup types - Backup + Copy)
        const companyVMBackups = allVMBackups.filter(
          (b: any) => companyVMUids.has(b.virtualMachineUid)
        );
        
        console.log(`[VeeamService] Company VM backups: ${companyVMBackups.length}`);
        
        // Sum totalRestorePointSize for all backups
        for (const backup of companyVMBackups) {
          vmTotalSizeBytes += backup.totalRestorePointSize || 0;
        }
        
        console.log(`[VeeamService] VMs total size: ${(vmTotalSizeBytes / (1024 ** 4)).toFixed(2)} TB`);
      }
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

  async getDataPlatformScorecard(companyId: string, periodDays: number = 7): Promise<DataPlatformScorecard> {
    if (!this.isConfigured()) {
      return this.getDemoScorecard(periodDays);
    }

    try {
      console.log(`[VeeamService] Fetching scorecard for company: ${companyId}, period: ${periodDays} days`);

      // Fetch jobs and backup servers
      const [jobs, backupServers] = await Promise.all([
        this.fetchAllPages<any>('/api/v3/infrastructure/backupServers/jobs'),
        this.fetchAllPages<any>('/api/v3/infrastructure/backupServers'),
      ]);
      
      console.log(`[VeeamService] Fetched ${jobs.length} jobs total`);

      // Filter by company and period
      const now = new Date();
      const periodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
      
      // Helper to extract date from various job date fields
      const extractLastRunDate = (job: any): Date | null => {
        // Try multiple possible date fields in order of preference
        const candidates = [
          job.lastRun,
          job.lastActiveDate,
          job.lastRunTime,
          job.lastSessionEnd,
          job.endTime,
        ];
        
        for (const candidate of candidates) {
          if (!candidate) continue;
          
          // If it's a string (ISO date), parse directly
          if (typeof candidate === 'string') {
            const date = new Date(candidate);
            if (!isNaN(date.getTime())) return date;
          }
          
          // If it's an object, try common date properties
          if (typeof candidate === 'object') {
            const dateStr = candidate.endTime || candidate.startTime || candidate.date || candidate.time;
            if (dateStr) {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) return date;
            }
          }
        }
        
        return null;
      };
      
      // First get all jobs for this company (unfiltered by date)
      const allCompanyJobs = jobs.filter((job: any) => job.organizationUid === companyId);
      
      // Log sample job to understand date structure
      if (allCompanyJobs.length > 0) {
        const sample = allCompanyJobs[0];
        console.log(`[VeeamService] Sample job keys:`, Object.keys(sample).join(', '));
        console.log(`[VeeamService] Sample job lastRun:`, JSON.stringify(sample.lastRun));
        console.log(`[VeeamService] Sample job lastActiveDate:`, sample.lastActiveDate);
      }
      
      const companyJobs = allCompanyJobs.filter((job: any) => {
        // Filter by job date within period
        const jobDate = extractLastRunDate(job);
        if (jobDate && !isNaN(jobDate.getTime())) {
          return jobDate >= periodStart;
        }
        
        return true; // Include jobs without valid date (always show current status)
      });
      
      console.log(`[VeeamService] Jobs filtered: ${allCompanyJobs.length} total -> ${companyJobs.length} within ${periodDays} days`);

      // Calculate Job Sessions Overview
      let jobsOk = 0;
      let jobsIssue = 0;
      
      for (const job of companyJobs) {
        const status = job.status;
        if (status === 'Success' || status === 'Running' || status === 'Idle') {
          jobsOk++;
        } else {
          jobsIssue++;
        }
      }
      
      const jobsTotal = jobsOk + jobsIssue;
      const jobsPercentage = jobsTotal > 0 ? Math.round((jobsOk / jobsTotal) * 100) : 100;

      // Calculate Platform Health (backup servers status for this company)
      const companyServers = backupServers.filter((s: any) => s.organizationUid === companyId);
      let healthyServers = 0;
      let unhealthyServers = 0;
      
      for (const server of companyServers) {
        if (server.status === 'Healthy') {
          healthyServers++;
        } else {
          unhealthyServers++;
        }
      }
      
      const healthTotal = healthyServers + unhealthyServers;
      const healthPercentage = healthTotal > 0 ? Math.round((healthyServers / healthTotal) * 100) : 100;

      // Calculate overall score (average of 2 metrics: Jobs + Health)
      const overallScore = Math.round((jobsPercentage + healthPercentage) / 2 * 10) / 10;

      // Determine status
      let status: 'Well Done' | 'Needs Attention' | 'Critical';
      let statusMessage: string;
      
      if (overallScore >= 90) {
        status = 'Well Done';
        statusMessage = 'Your Data Platform Status Score is above 90%.';
      } else if (overallScore >= 70) {
        status = 'Needs Attention';
        statusMessage = 'Your Data Platform Status Score needs attention.';
      } else {
        status = 'Critical';
        statusMessage = 'Your Data Platform Status Score is critical.';
      }

      console.log(`[VeeamService] Scorecard - Jobs: ${companyJobs.length}, Servers: ${companyServers.length}, Period: ${periodDays} days`);
      console.log(`[VeeamService] Scorecard - Jobs: ${jobsPercentage}% (${jobsOk}/${jobsTotal}), Health: ${healthPercentage}% (${healthyServers}/${healthTotal}), Overall: ${overallScore}%`);

      return {
        overallScore,
        status,
        statusMessage,
        jobSessions: {
          percentage: jobsPercentage,
          okCount: jobsOk,
          issueCount: jobsIssue,
          title: `Job Sessions Overview (${periodDays} days)`,
        },
        platformHealth: {
          percentage: healthPercentage,
          okCount: healthyServers,
          issueCount: unhealthyServers,
          title: 'Platform Health State',
        },
        periodDays,
      };
    } catch (error) {
      console.error('Error fetching scorecard from Veeam:', error);
      return this.getDemoScorecard(periodDays);
    }
  }

  private getDemoScorecard(periodDays: number = 7): DataPlatformScorecard {
    return {
      overallScore: 98.5,
      status: 'Well Done',
      statusMessage: 'Your Data Platform Status Score is above 90%.',
      jobSessions: {
        percentage: 97,
        okCount: 58,
        issueCount: 2,
        title: `Job Sessions Overview (${periodDays} days)`,
      },
      platformHealth: {
        percentage: 100,
        okCount: 2,
        issueCount: 0,
        title: 'Platform Health State',
      },
      periodDays,
    };
  }
}

export const veeamService = new VeeamService();

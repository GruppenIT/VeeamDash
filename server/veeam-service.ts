import type {
  VeeamCompany,
  VeeamBackupJob,
  VeeamRepository,
  BackupFailure,
  DashboardMetrics,
  ProtectedWorkload,
  DataPlatformScorecard,
  SessionStatesData,
  DaySessionState,
  VeeamAlarm,
} from "@shared/schema";
import { storage } from "./storage";

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

  async getDataPlatformScorecard(companyId: string): Promise<DataPlatformScorecard> {
    if (!this.isConfigured()) {
      return this.getDemoScorecard();
    }

    try {
      console.log(`[VeeamService] Fetching scorecard for company: ${companyId}`);

      // Fetch jobs and backup servers
      const [jobs, backupServers] = await Promise.all([
        this.fetchAllPages<any>('/api/v3/infrastructure/backupServers/jobs'),
        this.fetchAllPages<any>('/api/v3/infrastructure/backupServers'),
      ]);
      
      console.log(`[VeeamService] Fetched ${jobs.length} jobs total`);

      // Filter by company
      const companyJobs = jobs.filter((job: any) => job.organizationUid === companyId);
      
      console.log(`[VeeamService] Company has ${companyJobs.length} jobs`);

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
      let status: 'Excelente' | 'Atenção' | 'Crítico';
      let statusMessage: string;
      
      if (overallScore >= 90) {
        status = 'Excelente';
        statusMessage = 'O Score da Plataforma de Dados está acima de 90%.';
      } else if (overallScore >= 70) {
        status = 'Atenção';
        statusMessage = 'O Score da Plataforma de Dados precisa de atenção.';
      } else {
        status = 'Crítico';
        statusMessage = 'O Score da Plataforma de Dados está crítico.';
      }

      console.log(`[VeeamService] Scorecard - Jobs: ${companyJobs.length}, Servers: ${companyServers.length}`);
      console.log(`[VeeamService] Scorecard - Jobs: ${jobsPercentage}% (${jobsOk}/${jobsTotal}), Health: ${healthPercentage}% (${healthyServers}/${healthTotal}), Overall: ${overallScore}%`);

      return {
        overallScore,
        status,
        statusMessage,
        jobSessions: {
          percentage: jobsPercentage,
          okCount: jobsOk,
          issueCount: jobsIssue,
          title: 'Sessões de Jobs',
        },
        platformHealth: {
          percentage: healthPercentage,
          okCount: healthyServers,
          issueCount: unhealthyServers,
          title: 'Saúde da Plataforma',
        },
      };
    } catch (error) {
      console.error('Error fetching scorecard from Veeam:', error);
      return this.getDemoScorecard();
    }
  }

  private getDemoScorecard(): DataPlatformScorecard {
    return {
      overallScore: 98.5,
      status: 'Excelente',
      statusMessage: 'O Score da Plataforma de Dados está acima de 90%.',
      jobSessions: {
        percentage: 97,
        okCount: 58,
        issueCount: 2,
        title: 'Sessões de Jobs',
      },
      platformHealth: {
        percentage: 100,
        okCount: 2,
        issueCount: 0,
        title: 'Saúde da Plataforma',
      },
    };
  }

  async collectSessionSnapshot(companyId: string): Promise<{ success: boolean; message: string }> {
    try {
      const companies = await this.getCompanies();
      const company = companies.find(c => c.instanceUid === companyId);
      
      if (!company) {
        return { success: false, message: 'Company not found' };
      }

      // Get current job statuses
      const jobs = await this.fetchAllPages<any>('/api/v3/infrastructure/backupServers/jobs');
      const companyJobs = jobs.filter((job: any) => job.organizationUid === companyId);

      let successCount = 0;
      let warningCount = 0;
      let failedCount = 0;

      for (const job of companyJobs) {
        const status = job.status;
        if (status === 'Success' || status === 'Running' || status === 'Idle') {
          successCount++;
        } else if (status === 'Warning') {
          warningCount++;
        } else {
          failedCount++;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await storage.upsertSessionSnapshot({
        date: today,
        companyId: companyId,
        companyName: company.name,
        successCount,
        warningCount,
        failedCount,
        totalCount: companyJobs.length,
      });

      console.log(`[VeeamService] Collected snapshot for ${company.name}: ${successCount} success, ${warningCount} warning, ${failedCount} failed`);

      return { success: true, message: `Snapshot collected for ${company.name}` };
    } catch (error) {
      console.error('Error collecting session snapshot:', error);
      return { success: false, message: String(error) };
    }
  }

  async getSessionStates(companyId: string): Promise<SessionStatesData> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const snapshots = await storage.getSessionSnapshots(companyId, startDate, endDate);

      if (snapshots.length === 0) {
        return {
          days: [],
          hasData: false,
          message: 'Dados históricos estão sendo coletados. O calendário será preenchido automaticamente ao longo do tempo.',
        };
      }

      const days: DaySessionState[] = [];

      // Generate all 30 days in chronological order (oldest first)
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const dateStr = date.toISOString().split('T')[0];
        const snapshot = snapshots.find(s => {
          const snapshotDate = new Date(s.date);
          snapshotDate.setHours(0, 0, 0, 0);
          return snapshotDate.toISOString().split('T')[0] === dateStr;
        });

        if (snapshot && snapshot.totalCount > 0) {
          days.push({
            date: dateStr,
            successPercent: Math.round((snapshot.successCount / snapshot.totalCount) * 100),
            warningPercent: Math.round((snapshot.warningCount / snapshot.totalCount) * 100),
            failedPercent: Math.round((snapshot.failedCount / snapshot.totalCount) * 100),
            successCount: snapshot.successCount,
            warningCount: snapshot.warningCount,
            failedCount: snapshot.failedCount,
            totalCount: snapshot.totalCount,
          });
        } else {
          // No data for this day - will show "Sem dados" in UI
          days.push({
            date: dateStr,
            successPercent: 0,
            warningPercent: 0,
            failedPercent: 0,
            successCount: 0,
            warningCount: 0,
            failedCount: 0,
            totalCount: 0,
          });
        }
      }

      return {
        days,
        hasData: true,
      };
    } catch (error) {
      console.error('Error getting session states:', error);
      return {
        days: [],
        hasData: false,
        message: 'Erro ao carregar dados históricos.',
      };
    }
  }

  async getMonthlyStats(companyId: string): Promise<{ month: string; errors: number; warnings: number; successRate: number }[]> {
    try {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const results: { month: string; errors: number; warnings: number; successRate: number }[] = [];
      
      const now = new Date();
      const currentYear = now.getFullYear();
      
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const startOfMonth = new Date(currentYear, monthIndex, 1);
        const endOfMonth = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
        
        if (startOfMonth > now) {
          results.push({
            month: monthNames[monthIndex],
            errors: 0,
            warnings: 0,
            successRate: 0,
          });
          continue;
        }
        
        const snapshots = await storage.getSessionSnapshots(companyId, startOfMonth, endOfMonth);
        
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalSuccess = 0;
        let totalCount = 0;
        
        for (const snapshot of snapshots) {
          totalErrors += snapshot.failedCount;
          totalWarnings += snapshot.warningCount;
          totalSuccess += snapshot.successCount;
          totalCount += snapshot.totalCount;
        }
        
        const successRate = totalCount > 0 ? Math.round((totalSuccess / totalCount) * 100) : 0;
        
        results.push({
          month: monthNames[monthIndex],
          errors: totalErrors,
          warnings: totalWarnings,
          successRate,
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error getting monthly stats:', error);
      return [];
    }
  }

  async getActiveAlarms(companyId: string): Promise<VeeamAlarm[]> {
    if (!this.isConfigured()) {
      return this.getDemoAlarms();
    }

    try {
      console.log(`[VeeamService] Fetching active alarms for company: ${companyId}`);
      
      const alarms = await this.fetchAllPages<VeeamAlarm>('/api/v3/alarms/active');
      
      console.log(`[VeeamService] Total alarms fetched: ${alarms.length}`);
      
      const companyAlarms = alarms.filter(
        (alarm) => alarm.object?.organizationUid === companyId
      );
      
      console.log(`[VeeamService] Company alarms: ${companyAlarms.length}`);
      
      companyAlarms.sort((a, b) => {
        const dateA = new Date(a.lastActivation?.time || 0);
        const dateB = new Date(b.lastActivation?.time || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      return companyAlarms;
    } catch (error) {
      console.error('Error fetching active alarms:', error);
      return this.getDemoAlarms();
    }
  }

  private getDemoAlarms(): VeeamAlarm[] {
    return [
      {
        instanceUid: 'demo-alarm-1',
        alarmTemplateUid: 'demo-template-1',
        repeatCount: 3,
        object: {
          instanceUid: 'demo-obj-1',
          type: 'BackupServer',
          organizationUid: 'demo-company-1',
          locationUid: 'demo-loc-1',
          computerName: 'SERVIDOR-BACKUP-01',
          objectUid: 'demo-obj-uid-1',
          objectName: 'Job Backup Diário',
        },
        lastActivation: {
          time: new Date().toISOString(),
          status: 'Warning',
          message: 'Backup completed with warnings. Some VMs were skipped.',
          remark: 'Check VM connectivity.',
        },
        area: 'vspc',
      },
      {
        instanceUid: 'demo-alarm-2',
        alarmTemplateUid: 'demo-template-2',
        repeatCount: 1,
        object: {
          instanceUid: 'demo-obj-2',
          type: 'BackupServer',
          organizationUid: 'demo-company-1',
          locationUid: 'demo-loc-1',
          computerName: 'SERVIDOR-BACKUP-02',
          objectUid: 'demo-obj-uid-2',
          objectName: 'Job Replicação',
        },
        lastActivation: {
          time: new Date(Date.now() - 86400000).toISOString(),
          status: 'Resolved',
          message: 'All metrics are back to normal.',
          remark: 'The alarm has been automatically resolved.',
        },
        area: 'vspc',
      },
    ];
  }
}

export const veeamService = new VeeamService();

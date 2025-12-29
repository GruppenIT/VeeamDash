import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ProtectedDataOverview } from "@/components/protected-data-overview";
import { DataPlatformScorecard } from "@/components/data-platform-scorecard";
import { SessionStatesCalendar } from "@/components/session-states-calendar";
import { MonthlyCharts } from "@/components/monthly-charts";
import { FailedJobsTable } from "@/components/failed-jobs-table";
import type { DashboardMetrics, DataPlatformScorecard as ScorecardType, SessionStatesData, MonthlyChartData, FailedJob } from "@shared/schema";

interface ReportData {
  success: boolean;
  companyId: string;
  companyName: string;
  metrics: DashboardMetrics;
  scorecard: ScorecardType;
  sessionStates: SessionStatesData;
  monthlyStats: MonthlyChartData[];
  failedJobs: FailedJob[];
  generatedAt: string;
}

export default function PrintReport() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [isReady, setIsReady] = useState(false);

  const { data: reportData, isLoading, isError, error } = useQuery<ReportData>({
    queryKey: ['/api/report/data', companyId],
    enabled: !!companyId,
    retry: 2,
    staleTime: 0,
  });

  const reportDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  useEffect(() => {
    if (!isLoading && reportData?.success) {
      const timer = setTimeout(() => {
        setIsReady(true);
        (window as any).__REPORT_READY__ = true;
        console.log("[PrintReport] Report ready for PDF generation");
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    if (isError) {
      console.error("[PrintReport] Error loading report data:", error);
      (window as any).__REPORT_ERROR__ = true;
    }
  }, [isLoading, reportData, isError, error]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" data-loading="true">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparando relatório...</p>
        </div>
      </div>
    );
  }

  if (isError || !reportData?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" data-error="true">
        <p className="text-muted-foreground" data-testid="error-no-data">
          Erro ao carregar dados do relatório
        </p>
      </div>
    );
  }

  const { metrics, scorecard, sessionStates, monthlyStats, failedJobs, companyName } = reportData;

  return (
    <div className="bg-white min-h-screen print-report" data-ready={isReady}>
      <style>{`
        @media print {
          .print-report { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
        }
        .print-report { font-family: 'Inter', sans-serif; }
      `}</style>
      
      <div className="p-8">
        <header className="mb-8 pb-6 border-b-2 border-primary">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Relatório BaaS</h1>
              <p className="text-lg text-muted-foreground mt-1">{companyName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Gerado em</p>
              <p className="font-medium">{reportDate}</p>
            </div>
          </div>
        </header>

        <section className="mb-8">
          <DataPlatformScorecard
            overallScore={scorecard.overallScore}
            status={scorecard.status}
            statusMessage={scorecard.statusMessage}
            jobSessions={scorecard.jobSessions}
            platformHealth={scorecard.platformHealth}
          />
        </section>

        <section className="mb-8">
          <ProtectedDataOverview workloads={metrics.protectedWorkloads} />
        </section>

        <div className="page-break"></div>

        <section className="mb-8">
          <MonthlyCharts 
            data={monthlyStats || []} 
            isLoading={false} 
          />
        </section>

        <section className="mb-8">
          <SessionStatesCalendar 
            data={sessionStates || { days: [], hasData: false }} 
            isLoading={false} 
          />
        </section>

        <section className="mb-8">
          <FailedJobsTable 
            jobs={failedJobs || []} 
            isLoading={false} 
          />
        </section>

        <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>Relatório gerado automaticamente pelo Veeam VSPC Dashboard</p>
          <p className="mt-1">Powered by Zero Group</p>
        </footer>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, ArrowUpRight } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ProtectedDataOverview } from "@/components/protected-data-overview";
import { DataPlatformScorecard } from "@/components/data-platform-scorecard";
import { SessionStatesCalendar } from "@/components/session-states-calendar";
import { MonthlyCharts } from "@/components/monthly-charts";
import { AlarmsTable } from "@/components/alarms-table";
import type { VeeamCompany, DashboardMetrics, DataPlatformScorecard as ScorecardType, SessionStatesData, MonthlyChartData, VeeamAlarm } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const { data: companies, isLoading: companiesLoading } = useQuery<VeeamCompany[]>({
    queryKey: ["/api/companies"],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: [`/api/dashboard/metrics/${selectedCompany}`],
    enabled: !!selectedCompany,
  });

  const { data: scorecard, isLoading: scorecardLoading } = useQuery<ScorecardType>({
    queryKey: ['/api/scorecard', selectedCompany],
    enabled: !!selectedCompany,
  });

  const { data: sessionStates, isLoading: sessionStatesLoading } = useQuery<SessionStatesData>({
    queryKey: ['/api/session-states', selectedCompany],
    enabled: !!selectedCompany,
  });

  const { data: monthlyStats, isLoading: monthlyStatsLoading } = useQuery<MonthlyChartData[]>({
    queryKey: ['/api/monthly-stats', selectedCompany],
    enabled: !!selectedCompany,
  });

  const { data: alarms, isLoading: alarmsLoading } = useQuery<VeeamAlarm[]>({
    queryKey: [`/api/alarms/${selectedCompany}`],
    enabled: !!selectedCompany,
  });

  const { data: user } = useQuery<{ name: string; username: string }>({
    queryKey: ["/api/auth/me"],
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setLocation("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompany(companyId);
  };

  if (companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-companies">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader
        companies={companies || []}
        selectedCompany={selectedCompany}
        onCompanyChange={handleCompanyChange}
        userName={user?.name || "Usuário"}
        onLogout={handleLogout}
        onScheduleClick={() => setIsScheduleModalOpen(true)}
      />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {metricsLoading || scorecardLoading ? (
          <div className="text-center py-12" data-testid="loading-metrics">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando métricas...</p>
          </div>
        ) : metrics && scorecard ? (
          <>
            <DataPlatformScorecard
              overallScore={scorecard.overallScore}
              status={scorecard.status}
              statusMessage={scorecard.statusMessage}
              jobSessions={scorecard.jobSessions}
              platformHealth={scorecard.platformHealth}
            />
            <ProtectedDataOverview workloads={metrics.protectedWorkloads} />
            <MonthlyCharts 
              data={monthlyStats || []} 
              isLoading={monthlyStatsLoading} 
            />
            <SessionStatesCalendar 
              data={sessionStates || { days: [], hasData: false }} 
              isLoading={sessionStatesLoading} 
            />
            <AlarmsTable 
              alarms={alarms || []} 
              isLoading={alarmsLoading} 
            />
          </>
        ) : !selectedCompany ? (
          <div className="flex flex-col items-center justify-center py-24" data-testid="select-company-prompt">
            <div className="bg-card border rounded-lg p-8 max-w-md text-center shadow-sm">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Selecione um Cliente</h2>
              <p className="text-muted-foreground mb-4">
                Para visualizar as métricas de backup, selecione um cliente no seletor localizado no canto superior direito da tela.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <span>Clique no seletor de clientes</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum dado disponível para este cliente</p>
          </div>
        )}
      </main>
    </div>
  );
}

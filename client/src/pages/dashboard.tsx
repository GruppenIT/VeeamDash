import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCard } from "@/components/metric-card";
import { HealthStatusCard } from "@/components/health-status-card";
import { SuccessRateChart } from "@/components/success-rate-chart";
import { RepositoryCards } from "@/components/repository-cards";
import { FailuresTable } from "@/components/failures-table";
import { ScheduleModal } from "@/components/schedule-modal";
import { Database, Server, HardDrive, TrendingUp } from "lucide-react";
import type { VeeamCompany, DashboardMetrics } from "@shared/schema";

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

  const { data: user } = useQuery<{ name: string; username: string }>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (companies && companies.length > 0 && !selectedCompany) {
      setSelectedCompany(companies[0].instanceUid);
    }
  }, [companies, selectedCompany]);

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

  const selectedCompanyData = companies?.find((c) => c.instanceUid === selectedCompany);

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
        {metricsLoading ? (
          <div className="text-center py-12" data-testid="loading-metrics">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando métricas...</p>
          </div>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total de Backups"
                value={metrics.totalBackups}
                icon={Database}
                iconColor="text-blue-600"
              />
              <MetricCard
                title="Taxa de Sucesso"
                value={`${metrics.successRate.toFixed(1)}%`}
                icon={TrendingUp}
                iconColor="text-green-600"
              />
              <MetricCard
                title="Jobs Ativos"
                value={metrics.activeJobs}
                icon={Server}
                iconColor="text-purple-600"
              />
              <MetricCard
                title="Armazenamento Usado"
                value={`${metrics.storageUsedGB.toFixed(1)} TB`}
                icon={HardDrive}
                iconColor="text-orange-600"
              />
            </div>

            <HealthStatusCard
              status={metrics.healthStatus}
              totalBackups={metrics.totalBackups}
              successRate={metrics.successRate}
              activeJobs={metrics.activeJobs}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SuccessRateChart data={metrics.monthlySuccessRates} />
              <RepositoryCards repositories={metrics.repositories} />
            </div>

            <FailuresTable failures={metrics.recentFailures} />
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Selecione um cliente para visualizar os dados</p>
          </div>
        )}
      </main>

      {selectedCompanyData && (
        <ScheduleModal
          open={isScheduleModalOpen}
          onOpenChange={setIsScheduleModalOpen}
          companyId={selectedCompanyData.instanceUid}
          companyName={selectedCompanyData.name}
        />
      )}
    </div>
  );
}

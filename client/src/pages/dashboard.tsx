import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard-header";
import { ProtectedDataOverview } from "@/components/protected-data-overview";
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
          <ProtectedDataOverview workloads={metrics.protectedWorkloads} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Selecione um cliente para visualizar os dados</p>
          </div>
        )}
      </main>
    </div>
  );
}

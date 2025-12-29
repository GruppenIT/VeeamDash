import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ProtectedDataOverview } from "@/components/protected-data-overview";
import { DataPlatformScorecard } from "@/components/data-platform-scorecard";
import { SessionStatesCalendar } from "@/components/session-states-calendar";
import { MonthlyCharts } from "@/components/monthly-charts";
import { FailedJobsTable } from "@/components/failed-jobs-table";
import type { DashboardMetrics, DataPlatformScorecard as ScorecardType, SessionStatesData, MonthlyChartData, FailedJob } from "@shared/schema";

import gruppenLogo from "@assets/gruppen_1765573676765.png";
import zeroboxLogo from "@assets/zerobox_1765573676765.png";
import firewall365Logo from "@assets/firewall365_1765573676765.png";
import gsecdoLogo from "@assets/gsecdo_1765573676765.png";

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
  });

  const reportTime = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const currentMonth = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
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
        {/* Banner com Logos - Fundo Preto */}
        <div className="flex justify-center items-center gap-8 mb-8 py-6 bg-black rounded-lg">
          <img src={gruppenLogo} alt="Gruppen" className="h-10 object-contain" />
          <img src={zeroboxLogo} alt="Zerobox" className="h-10 object-contain" />
          <img src={firewall365Logo} alt="Firewall365" className="h-10 object-contain" />
          <img src={gsecdoLogo} alt="GSecDo" className="h-10 object-contain" />
        </div>

        {/* Cabeçalho Formal */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Relatório de Backup as a Service
          </h1>
          <h2 className="text-xl text-primary font-semibold mb-4">
            {companyName}
          </h2>
          <p className="text-muted-foreground">
            Período de Referência: {currentMonth}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Gerado em {reportDate} às {reportTime}
          </p>
        </header>

        {/* Introdução Formal */}
        <section className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold text-foreground mb-3">Apresentação</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Prezado cliente,
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Este documento apresenta o relatório consolidado dos serviços de Backup as a Service (BaaS) 
            prestados à <strong>{companyName}</strong>. O relatório contém informações detalhadas sobre 
            o status de proteção dos seus dados, desempenho das rotinas de backup, e métricas de saúde 
            da plataforma.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nosso compromisso é garantir a continuidade e segurança das suas informações através de 
            uma infraestrutura de backup robusta e monitoramento contínuo. As métricas apresentadas 
            refletem nosso empenho em manter os mais altos padrões de qualidade e disponibilidade.
          </p>
        </section>

        {/* Scorecard Principal */}
        <section className="mb-8">
          <DataPlatformScorecard
            overallScore={scorecard.overallScore}
            status={scorecard.status}
            statusMessage={scorecard.statusMessage}
            jobSessions={scorecard.jobSessions}
            platformHealth={scorecard.platformHealth}
          />
        </section>

        {/* Protected Data Overview */}
        <section className="mb-8">
          <ProtectedDataOverview workloads={metrics.protectedWorkloads} />
        </section>

        <div className="page-break"></div>

        {/* Gráficos Mensais */}
        <section className="mb-8">
          <MonthlyCharts 
            data={monthlyStats || []} 
            isLoading={false} 
          />
        </section>

        {/* Calendário de Estados */}
        <section className="mb-8">
          <SessionStatesCalendar 
            data={sessionStates || { days: [], hasData: false }} 
            isLoading={false} 
          />
        </section>

        {/* Tabela de Jobs com Falha */}
        <section className="mb-8">
          <FailedJobsTable 
            jobs={failedJobs || []} 
            isLoading={false} 
          />
        </section>

        {/* Rodapé Formal */}
        <footer className="mt-12 pt-8 border-t-2 border-primary">
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
              Informações sobre a Prestação de Serviço
            </h3>
            
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                Este relatório é gerado automaticamente pela plataforma de BaaS da Gruppen it Security 
                e reflete o estado atual dos serviços de backup contratados.
              </p>
              
              <p>
                Nossa equipe, através das marcas <strong>Gruppen</strong>, <strong>Zerobox</strong> e 
                <strong> Firewall365</strong>, oferecemos soluções completas de proteção de dados, 
                segurança da informação e infraestrutura de TI para empresas de todos os portes.
              </p>
              
              <p>
                Nosso time de especialistas está à disposição para esclarecer dúvidas, fornecer 
                suporte técnico e auxiliar na evolução da sua estratégia de proteção de dados.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-300 text-center">
              <p className="text-sm font-semibold text-foreground mb-2">
                Central de Atendimento
              </p>
              <a 
                href="https://sistemas.gruppen.com.br" 
                className="text-primary font-medium hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://sistemas.gruppen.com.br
              </a>
              <p className="text-xs text-muted-foreground mt-3">
                // Gruppen it Security // Tecnologia Pensada em Grupo
              </p>
            </div>
          </div>

          <div className="text-center mt-6 text-xs text-muted-foreground">
            <p>Documento gerado automaticamente. Este relatório é confidencial e destinado exclusivamente ao cliente {companyName}.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

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
          .print-report { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .page-break { 
            page-break-before: always; 
            break-before: page;
          }
          .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        .print-report { font-family: 'Inter', sans-serif; }
        .report-page {
          min-height: calc(100vh - 20mm);
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        .report-page-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
      `}</style>
      
      {/* PÁGINA 1: Capa */}
      <div className="report-page">
        <div className="report-page-content">
          {/* Banner com Logos - Fundo Preto */}
          <div className="flex justify-center items-center gap-8 mb-8 py-6 bg-black rounded-lg">
            <img src={gruppenLogo} alt="Gruppen" className="h-12 object-contain" />
            <img src={zeroboxLogo} alt="Zerobox" className="h-12 object-contain" />
            <img src={firewall365Logo} alt="Firewall365" className="h-12 object-contain" />
            <img src={gsecdoLogo} alt="GSecDo" className="h-12 object-contain" />
          </div>

          {/* Cabeçalho Formal */}
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Relatório de Backup as a Service
            </h1>
            <h2 className="text-2xl text-primary font-semibold mb-6">
              {companyName}
            </h2>
            <p className="text-lg text-muted-foreground">
              Período de Referência: {currentMonth}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Gerado em {reportDate} às {reportTime}
            </p>
          </header>

          {/* Introdução Formal */}
          <section className="max-w-4xl mx-auto p-6 bg-slate-50 rounded-lg border border-slate-200">
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
        </div>
      </div>

      {/* PÁGINA 2: Scorecard */}
      <div className="page-break report-page">
        <div className="report-page-content">
          <DataPlatformScorecard
            overallScore={scorecard.overallScore}
            status={scorecard.status}
            statusMessage={scorecard.statusMessage}
            jobSessions={scorecard.jobSessions}
            platformHealth={scorecard.platformHealth}
          />
        </div>
      </div>

      {/* PÁGINA 3: Protected Data Overview */}
      <div className="page-break report-page">
        <div className="report-page-content">
          <ProtectedDataOverview workloads={metrics.protectedWorkloads} />
        </div>
      </div>

      {/* PÁGINA 4: Gráficos Mensais */}
      <div className="page-break report-page">
        <div className="report-page-content">
          <MonthlyCharts 
            data={monthlyStats || []} 
            isLoading={false} 
          />
        </div>
      </div>

      {/* PÁGINA 5: Session States */}
      <div className="page-break report-page">
        <div className="report-page-content">
          <SessionStatesCalendar 
            data={sessionStates || { days: [], hasData: false }} 
            isLoading={false} 
          />
        </div>
      </div>

      {/* PÁGINA 6: Jobs com Falha */}
      <div className="page-break report-page">
        <div className="report-page-content">
          <FailedJobsTable 
            jobs={failedJobs || []} 
            isLoading={false} 
          />
        </div>
      </div>

      {/* PÁGINA 7: Rodapé Formal */}
      <div className="page-break report-page">
        <div className="report-page-content">
          <div className="max-w-4xl mx-auto bg-slate-50 rounded-lg p-8 border border-slate-200">
            <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
              Informações sobre a Prestação de Serviço
            </h3>
            
            <div className="text-base text-muted-foreground leading-relaxed space-y-4">
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

            <div className="mt-8 pt-6 border-t border-slate-300 text-center">
              <p className="text-lg font-semibold text-foreground mb-3">
                Central de Atendimento
              </p>
              <a 
                href="https://sistemas.gruppen.com.br" 
                className="text-primary text-lg font-medium hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://sistemas.gruppen.com.br
              </a>
              <p className="text-sm text-muted-foreground mt-4">
                // Gruppen it Security // Tecnologia Pensada em Grupo
              </p>
            </div>
          </div>

          <div className="text-center mt-8 text-sm text-muted-foreground">
            <p>Documento gerado automaticamente. Este relatório é confidencial e destinado exclusivamente ao cliente {companyName}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

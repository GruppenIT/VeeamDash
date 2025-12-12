import PDFDocument from "pdfkit";
import { veeamService } from "./veeam-service";
import type { DashboardMetrics, ProtectedWorkload, DataPlatformScorecard, SessionStatesData, DaySessionState } from "@shared/schema";
import path from "path";
import fs from "fs";

interface ReportData {
  companyId: string;
  companyName: string;
  metrics: DashboardMetrics;
  scorecard: DataPlatformScorecard;
  sessionStates: SessionStatesData;
  generatedAt: Date;
}

export class PDFService {
  private logosPaths = {
    gruppen: path.join(process.cwd(), "attached_assets", "gruppen_1765573676765.png"),
    zerobox: path.join(process.cwd(), "attached_assets", "zerobox_1765573676765.png"),
    firewall365: path.join(process.cwd(), "attached_assets", "firewall365_1765573676765.png"),
    gsecdo: path.join(process.cwd(), "attached_assets", "gsecdo_1765573676765.png"),
  };

  private colors = {
    primary: "#00B336",
    primaryLight: "#e8f5e9",
    secondary: "#1a1a1a",
    muted: "#666666",
    background: "#ffffff",
    border: "#e5e5e5",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    lightGray: "#f5f5f5",
    purple: "#8b5cf6",
    cyan: "#06b6d4",
    blue: "#3b82f6",
  };

  async generateReport(companyId: string, companyName: string): Promise<Buffer> {
    const [metrics, scorecard, sessionStates] = await Promise.all([
      veeamService.getDashboardMetrics(companyId),
      veeamService.getDataPlatformScorecard(companyId),
      veeamService.getSessionStates(companyId),
    ]);
    
    const reportData: ReportData = {
      companyId,
      companyName,
      metrics,
      scorecard,
      sessionStates,
      generatedAt: new Date(),
    };

    return this.createPDF(reportData);
  }

  private createPDF(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
        info: {
          Title: `Relatório de Backup - ${data.companyName}`,
          Author: "Gruppen IT Security",
          Subject: "Relatório de Backup - BaaS",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.addCoverPage(doc, data);
      doc.addPage();
      this.addScorecardPage(doc, data);
      doc.addPage();
      this.addProtectedDataPage(doc, data);
      doc.addPage();
      this.addAlarmsPage(doc, data);
      doc.addPage();
      this.addBackupSessionsPage(doc, data);
      this.addFooter(doc, data);

      doc.end();
    });
  }

  private addCoverPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;

    doc.rect(0, 0, pageWidth, 120).fill(this.colors.secondary);

    const logoWidth = 80;
    const logoHeight = 40;
    const logoY = 40;
    const logosGap = 20;
    const totalLogosWidth = 4 * logoWidth + 3 * logosGap;
    let logoX = (pageWidth - totalLogosWidth) / 2;

    const logos: (keyof typeof this.logosPaths)[] = ["gruppen", "zerobox", "firewall365", "gsecdo"];
    for (const logoKey of logos) {
      const logoPath = this.logosPaths[logoKey];
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, logoX, logoY, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });
        } catch (e) {
          console.warn(`Could not load logo: ${logoKey}`);
        }
      }
      logoX += logoWidth + logosGap;
    }

    const centerY = pageHeight / 2 - 100;
    
    doc.fillColor(this.colors.primary)
      .fontSize(14)
      .font("Helvetica")
      .text("RELATÓRIO DE BACKUP", margin, centerY, { align: "center" });

    doc.fillColor(this.colors.secondary)
      .fontSize(32)
      .font("Helvetica-Bold")
      .text(data.companyName, margin, centerY + 30, { align: "center" });

    const dateStr = data.generatedAt.toLocaleDateString("pt-BR");
    const timeStr = data.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    doc.fillColor(this.colors.muted)
      .fontSize(14)
      .font("Helvetica")
      .text(
        `Gerado em ${dateStr} às ${timeStr}`,
        margin,
        centerY + 80,
        { align: "center" }
      );

    doc.rect(margin, pageHeight - 180, pageWidth - 2 * margin, 1).fill(this.colors.border);

    doc.fillColor(this.colors.muted)
      .fontSize(10)
      .font("Helvetica")
      .text(
        "Relatório gerado pela plataforma de BaaS da Gruppen IT Security.",
        margin,
        pageHeight - 160,
        { align: "center" }
      );

    doc.text(
      "As informações contidas neste documento são confidenciais.",
      margin,
      pageHeight - 145,
      { align: "center" }
    );
  }

  private addScorecardPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Scorecard da Plataforma de Dados");
    y += 80;

    const metrics = data.metrics;
    const successRate = metrics.successRate ?? 0;
    const scoreLabel = this.getScoreLabel(successRate);
    const scoreColor = this.getHealthColor(successRate);

    const shieldCenterX = margin + 120;
    const shieldCenterY = y + 130;
    const shieldSize = 100;

    doc.save();
    
    doc.moveTo(shieldCenterX, shieldCenterY - shieldSize)
      .lineTo(shieldCenterX + shieldSize * 0.85, shieldCenterY - shieldSize * 0.5)
      .lineTo(shieldCenterX + shieldSize * 0.85, shieldCenterY + shieldSize * 0.3)
      .quadraticCurveTo(shieldCenterX + shieldSize * 0.5, shieldCenterY + shieldSize * 0.9, shieldCenterX, shieldCenterY + shieldSize)
      .quadraticCurveTo(shieldCenterX - shieldSize * 0.5, shieldCenterY + shieldSize * 0.9, shieldCenterX - shieldSize * 0.85, shieldCenterY + shieldSize * 0.3)
      .lineTo(shieldCenterX - shieldSize * 0.85, shieldCenterY - shieldSize * 0.5)
      .closePath();

    doc.fillColor(this.colors.primaryLight).fill();

    doc.moveTo(shieldCenterX, shieldCenterY - shieldSize)
      .lineTo(shieldCenterX + shieldSize * 0.85, shieldCenterY - shieldSize * 0.5)
      .lineTo(shieldCenterX + shieldSize * 0.85, shieldCenterY + shieldSize * 0.3)
      .quadraticCurveTo(shieldCenterX + shieldSize * 0.5, shieldCenterY + shieldSize * 0.9, shieldCenterX, shieldCenterY + shieldSize)
      .quadraticCurveTo(shieldCenterX - shieldSize * 0.5, shieldCenterY + shieldSize * 0.9, shieldCenterX - shieldSize * 0.85, shieldCenterY + shieldSize * 0.3)
      .lineTo(shieldCenterX - shieldSize * 0.85, shieldCenterY - shieldSize * 0.5)
      .closePath();

    doc.lineWidth(4).strokeColor(scoreColor).stroke();
    doc.restore();

    doc.fillColor(scoreColor)
      .fontSize(42)
      .font("Helvetica-Bold")
      .text(`${Math.round(successRate)}%`, shieldCenterX - 50, shieldCenterY - 20, { width: 100, align: "center" });

    doc.fillColor(scoreColor)
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(scoreLabel, margin, shieldCenterY + shieldSize + 30, { width: 240, align: "center" });

    const descText = successRate >= 90 
      ? "O Score da Plataforma de Dados está acima de 90%."
      : successRate >= 70 
        ? "O Score da Plataforma de Dados está entre 70% e 90%."
        : "O Score da Plataforma de Dados está abaixo de 70%.";

    doc.fillColor(this.colors.muted)
      .fontSize(10)
      .font("Helvetica")
      .text(descText, margin, shieldCenterY + shieldSize + 55, { width: 240, align: "center" });

    const rightX = margin + 280;
    const circleRadius = 35;
    
    const jobSessions = data.scorecard.jobSessions;
    const successJobs = jobSessions.okCount;
    const failedJobs = jobSessions.issueCount;
    const jobsSuccessRate = jobSessions.percentage;

    this.drawDonutChart(doc, rightX + circleRadius, y + 60, circleRadius, jobsSuccessRate, this.colors.success, this.colors.error);

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`${Math.round(jobsSuccessRate)}%`, rightX + circleRadius - 20, y + 52, { width: 40, align: "center" });

    doc.fillColor(this.colors.success)
      .fontSize(9)
      .font("Helvetica")
      .text(`● ${successJobs}`, rightX + circleRadius * 2 + 20, y + 45);

    doc.fillColor(this.colors.error)
      .text(`● ${failedJobs}`, rightX + circleRadius * 2 + 50, y + 45);

    doc.fillColor(this.colors.secondary)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Sessões de Jobs", rightX + circleRadius * 2 + 20, y + 60);

    const platformHealth = data.scorecard.platformHealth;
    const healthyServers = platformHealth.okCount;
    const unhealthyServers = platformHealth.issueCount;
    const platformHealthRate = platformHealth.percentage;

    this.drawDonutChart(doc, rightX + circleRadius, y + 160, circleRadius, platformHealthRate, this.colors.success, this.colors.error);

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`${Math.round(platformHealthRate)}%`, rightX + circleRadius - 20, y + 152, { width: 40, align: "center" });

    doc.fillColor(this.colors.success)
      .fontSize(9)
      .font("Helvetica")
      .text(`● ${healthyServers}`, rightX + circleRadius * 2 + 20, y + 145);

    doc.fillColor(this.colors.error)
      .text(`● ${unhealthyServers}`, rightX + circleRadius * 2 + 50, y + 145);

    doc.fillColor(this.colors.secondary)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Saúde da Plataforma", rightX + circleRadius * 2 + 20, y + 160);
  }

  private addProtectedDataPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Visão Geral de Dados Protegidos");
    y += 80;

    doc.fillColor(this.colors.muted)
      .fontSize(10)
      .font("Helvetica")
      .text("Distribuição de workloads protegidos", margin, y);

    y += 25;

    const workloads: ProtectedWorkload[] = data.metrics.protectedWorkloads ?? [];
    const totalWorkloads = workloads.reduce((sum, w) => sum + w.quantity, 0);

    const chartColors = [this.colors.blue, this.colors.cyan, this.colors.purple, this.colors.primary];
    const chartCenterX = margin + 100;
    const chartCenterY = y + 100;
    const outerRadius = 80;
    const innerRadius = 50;

    let startAngle = -Math.PI / 2;
    workloads.forEach((workload, index) => {
      if (workload.quantity === 0) return;
      const sliceAngle = (workload.quantity / totalWorkloads) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      
      this.drawArcSlice(doc, chartCenterX, chartCenterY, innerRadius, outerRadius, startAngle, endAngle, chartColors[index % chartColors.length]);
      startAngle = endAngle;
    });

    doc.circle(chartCenterX, chartCenterY, innerRadius - 2).fill(this.colors.background);

    doc.fillColor(this.colors.secondary)
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(totalWorkloads.toLocaleString("pt-BR"), chartCenterX - 40, chartCenterY - 15, { width: 80, align: "center" });

    doc.fillColor(this.colors.muted)
      .fontSize(10)
      .font("Helvetica")
      .text("Workloads", chartCenterX - 40, chartCenterY + 15, { width: 80, align: "center" });

    let legendY = y + 180;
    const legendX = margin;
    workloads.forEach((workload, index) => {
      doc.rect(legendX + index * 120, legendY, 10, 10).fill(chartColors[index % chartColors.length]);
      doc.fillColor(this.colors.muted)
        .fontSize(8)
        .font("Helvetica")
        .text(workload.name, legendX + index * 120 + 15, legendY + 1);
    });

    const tableX = margin + 240;
    const tableY = y;
    const colWidths = [150, 80, 80];

    doc.fillColor(this.colors.muted)
      .fontSize(10)
      .font("Helvetica")
      .text("Nome", tableX, tableY)
      .text("Quantidade", tableX + colWidths[0], tableY)
      .text("Tamanho", tableX + colWidths[0] + colWidths[1], tableY);

    doc.rect(tableX, tableY + 15, colWidths[0] + colWidths[1] + colWidths[2], 1).fill(this.colors.border);

    let rowY = tableY + 25;
    workloads.forEach((workload, index) => {
      doc.rect(tableX - 5, rowY - 5, 10, 10).fill(chartColors[index % chartColors.length]);

      doc.fillColor(this.colors.secondary)
        .fontSize(11)
        .font("Helvetica")
        .text(workload.name, tableX + 10, rowY);

      doc.text(workload.quantity.toLocaleString("pt-BR"), tableX + colWidths[0], rowY);

      const sizeText = workload.sizeGB > 0 
        ? `${workload.sizeGB >= 1000 ? (workload.sizeGB / 1024).toFixed(1) + " TB" : workload.sizeGB.toFixed(1) + " GB"}`
        : "N/A";
      doc.text(sizeText, tableX + colWidths[0] + colWidths[1], rowY);

      rowY += 25;
    });

    doc.rect(tableX, rowY - 5, colWidths[0] + colWidths[1] + colWidths[2], 1).fill(this.colors.border);

    const totalSize = workloads.reduce((sum, w) => sum + w.sizeGB, 0);
    const totalSizeText = totalSize >= 1000 ? `${(totalSize / 1024).toFixed(1)} TB` : `${totalSize.toFixed(1)} GB`;

    doc.fillColor(this.colors.secondary)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Total", tableX + 10, rowY + 5)
      .text(totalWorkloads.toLocaleString("pt-BR"), tableX + colWidths[0], rowY + 5)
      .text(totalSizeText, tableX + colWidths[0] + colWidths[1], rowY + 5);
  }

  private addAlarmsPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Alertas de Backup");
    y += 80;

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Histórico de Falhas de Backup", margin, y);

    y += 25;

    const chartWidth = pageWidth - 2 * margin;
    const chartHeight = 120;

    doc.rect(margin, y, chartWidth, chartHeight).fill(this.colors.lightGray);

    const recentFailures = data.metrics.recentFailures ?? [];
    const alarmsByMonth = this.groupFailuresByMonth(recentFailures, 6);
    const months = alarmsByMonth.map(m => m.month);
    const alarmData = alarmsByMonth.map(m => m.count);
    const maxAlarms = Math.max(...alarmData, 1);
    const barWidth = (chartWidth - 60) / (months.length || 1) - 10;

    if (months.length > 0) {
      months.forEach((month, index) => {
        const barHeight = (alarmData[index] / maxAlarms) * (chartHeight - 40);
        const barX = margin + 30 + index * (barWidth + 10);
        const barY = y + chartHeight - 20 - barHeight;

        doc.rect(barX, barY, barWidth, barHeight).fill(this.colors.warning);

        doc.fillColor(this.colors.muted)
          .fontSize(8)
          .font("Helvetica")
          .text(month, barX, y + chartHeight - 15, { width: barWidth, align: "center" });

        if (alarmData[index] > 0) {
          doc.fillColor(this.colors.secondary)
            .fontSize(8)
            .font("Helvetica-Bold")
            .text(alarmData[index].toString(), barX, barY - 12, { width: barWidth, align: "center" });
        }
      });
    } else {
      doc.fillColor(this.colors.muted)
        .fontSize(11)
        .font("Helvetica")
        .text("Sem dados de alarmes históricos disponíveis.", margin + 20, y + chartHeight / 2 - 10);
    }

    y += chartHeight + 40;

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Falhas Recentes", margin, y);

    y += 25;

    const tableHeaders = ["Tipo", "Descrição", "Severidade", "Data"];
    const colWidths = [80, 220, 80, 100];
    let x = margin;

    doc.rect(margin, y, pageWidth - 2 * margin, 25).fill(this.colors.lightGray);

    doc.fillColor(this.colors.secondary)
      .fontSize(10)
      .font("Helvetica-Bold");

    tableHeaders.forEach((header, i) => {
      doc.text(header, x + 5, y + 7);
      x += colWidths[i];
    });

    y += 30;

    if (recentFailures.length === 0) {
      doc.fillColor(this.colors.success)
        .fontSize(11)
        .font("Helvetica")
        .text("Nenhum alarme ativo no momento.", margin, y);
    } else {
      recentFailures.slice(0, 5).forEach((failure, index) => {
        const rowY = y;
        const bgColor = index % 2 === 0 ? this.colors.background : this.colors.lightGray;
        doc.rect(margin, rowY, pageWidth - 2 * margin, 25).fill(bgColor);

        x = margin;
        doc.fillColor(this.colors.secondary)
          .fontSize(9)
          .font("Helvetica");

        doc.text("Backup", x + 5, rowY + 7);
        x += colWidths[0];

        doc.text(failure.jobName.substring(0, 40), x + 5, rowY + 7, { width: colWidths[1] - 10 });
        x += colWidths[1];

        doc.fillColor(this.colors.error)
          .font("Helvetica-Bold")
          .text("Alta", x + 5, rowY + 7);
        x += colWidths[2];

        doc.fillColor(this.colors.muted)
          .font("Helvetica")
          .text(failure.date, x + 5, rowY + 7);

        y += 25;
      });
    }
  }

  private groupFailuresByMonth(failures: { jobName: string; errorMessage: string; date: string }[], numMonths: number) {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const result: { month: string; count: number }[] = [];
    const now = new Date();

    for (let i = numMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = monthNames[date.getMonth()];
      
      const count = failures.filter(f => {
        const parts = f.date.split('/');
        if (parts.length === 3) {
          const failMonth = `${parts[2]}-${parts[1]}`;
          return failMonth === monthKey;
        }
        return false;
      }).length;

      result.push({ month: monthLabel, count });
    }

    return result;
  }

  private addBackupSessionsPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Sessões de Backup");
    y += 80;

    const metrics = data.metrics;
    const monthlyRates = metrics.monthlySuccessRates ?? [];

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Taxa de Sucesso de Backup (%)", margin, y);

    y += 25;

    if (monthlyRates.length > 0) {
      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 100;

      doc.rect(margin, y, chartWidth, chartHeight).fill(this.colors.lightGray);

      const recentMonths = monthlyRates.slice(-6);
      const barWidth = (chartWidth - 60) / recentMonths.length - 10;

      recentMonths.forEach((item, index) => {
        const barHeight = (item.rate / 100) * (chartHeight - 30);
        const barX = margin + 30 + index * (barWidth + 10);
        const barY = y + chartHeight - 20 - barHeight;

        doc.rect(barX, barY, barWidth, barHeight).fill(this.getHealthColor(item.rate));

        doc.fillColor(this.colors.muted)
          .fontSize(8)
          .font("Helvetica")
          .text(item.month, barX, y + chartHeight - 15, { width: barWidth, align: "center" });

        if (item.rate > 0) {
          doc.fillColor(this.colors.secondary)
            .fontSize(7)
            .font("Helvetica-Bold")
            .text(`${item.rate}%`, barX, barY - 12, { width: barWidth, align: "center" });
        }
      });
    }

    y += 130;

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Calendário de Status (Últimos 30 dias)", margin, y);

    y += 25;

    const cellSize = 18;
    const cols = 7;
    const sessionDays = data.sessionStates.days ?? [];
    const hasSessionData = data.sessionStates.hasData && sessionDays.length > 0;

    if (hasSessionData) {
      sessionDays.forEach((day, dayIndex) => {
        const col = dayIndex % cols;
        const row = Math.floor(dayIndex / cols);
        
        const cellX = margin + col * (cellSize + 4);
        const cellY = y + row * (cellSize + 4);

        let cellColor = this.colors.lightGray;
        if (day.status === 'success') cellColor = this.colors.success;
        else if (day.status === 'warning') cellColor = this.colors.warning;
        else if (day.status === 'failed') cellColor = this.colors.error;

        doc.rect(cellX, cellY, cellSize, cellSize).fill(cellColor);

        const dateObj = new Date(day.date);
        doc.fillColor(day.status === 'no_data' ? this.colors.muted : this.colors.background)
          .fontSize(7)
          .font("Helvetica")
          .text(dateObj.getDate().toString(), cellX, cellY + 5, { width: cellSize, align: "center" });
      });
    } else {
      doc.fillColor(this.colors.muted)
        .fontSize(10)
        .font("Helvetica")
        .text(data.sessionStates.message || "Dados históricos estão sendo coletados.", margin, y);
      
      for (let i = 0; i < 30; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellX = margin + col * (cellSize + 4);
        const cellY = y + 25 + row * (cellSize + 4);
        doc.rect(cellX, cellY, cellSize, cellSize).fill(this.colors.lightGray);
      }
      y += 25;
    }

    const legendY = y;
    const legendX = margin + cols * (cellSize + 4) + 40;

    doc.rect(legendX, legendY, 12, 12).fill(this.colors.success);
    doc.fillColor(this.colors.muted).fontSize(9).font("Helvetica").text("Sucesso", legendX + 18, legendY + 2);

    doc.rect(legendX, legendY + 20, 12, 12).fill(this.colors.warning);
    doc.text("Aviso", legendX + 18, legendY + 22);

    doc.rect(legendX, legendY + 40, 12, 12).fill(this.colors.error);
    doc.text("Falha", legendX + 18, legendY + 42);

    doc.rect(legendX, legendY + 60, 12, 12).fill(this.colors.lightGray);
    doc.text("Sem dados", legendX + 18, legendY + 62);

    y += 5 * (cellSize + 4) + 40;

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Jobs com Falha", margin, y);

    y += 25;

    const recentFailures = metrics.recentFailures ?? [];

    if (recentFailures.length === 0) {
      doc.fillColor(this.colors.success)
        .fontSize(11)
        .font("Helvetica")
        .text("Nenhuma falha registrada recentemente.", margin, y);
    } else {
      const tableHeaders = ["Job", "Erro", "Data"];
      const colWidths = [150, 250, 80];
      let x = margin;

      doc.rect(margin, y, pageWidth - 2 * margin, 22).fill(this.colors.lightGray);

      doc.fillColor(this.colors.secondary)
        .fontSize(10)
        .font("Helvetica-Bold");

      tableHeaders.forEach((header, i) => {
        doc.text(header, x + 5, y + 6);
        x += colWidths[i];
      });

      y += 25;

      recentFailures.slice(0, 5).forEach((failure, index) => {
        if (y > 750) return;

        const rowY = y;
        const bgColor = index % 2 === 0 ? this.colors.background : this.colors.lightGray;
        doc.rect(margin, rowY, pageWidth - 2 * margin, 22).fill(bgColor);

        x = margin;
        doc.fillColor(this.colors.secondary)
          .fontSize(9)
          .font("Helvetica");

        doc.text(failure.jobName.substring(0, 25), x + 5, rowY + 6);
        x += colWidths[0];

        doc.text(failure.errorMessage.substring(0, 45) + (failure.errorMessage.length > 45 ? "..." : ""), x + 5, rowY + 6);
        x += colWidths[1];

        doc.text(failure.date, x + 5, rowY + 6);

        y += 22;
      });
    }
  }

  private addHeader(doc: PDFKit.PDFDocument, title: string) {
    const pageWidth = doc.page.width;
    const margin = 50;

    doc.rect(0, 0, pageWidth, 60).fill(this.colors.secondary);

    doc.fillColor("#ffffff")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(title, margin, 22);
  }

  private addFooter(doc: PDFKit.PDFDocument, data: ReportData) {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;
      const margin = 50;

      doc.fillColor(this.colors.muted)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Página ${i + 1} de ${pageCount}`,
          margin,
          pageHeight - 30,
          { align: "center", width: pageWidth - 2 * margin }
        );

      doc.text(
        `${data.companyName} | ${data.generatedAt.toLocaleDateString("pt-BR")} | Gruppen IT Security`,
        margin,
        pageHeight - 45,
        { align: "center", width: pageWidth - 2 * margin }
      );
    }
  }

  private drawDonutChart(doc: PDFKit.PDFDocument, centerX: number, centerY: number, radius: number, percent: number, successColor: string, failColor: string) {
    const innerRadius = radius * 0.6;
    
    if (percent < 100) {
      doc.save();
      doc.circle(centerX, centerY, radius).fill(failColor);
      doc.circle(centerX, centerY, innerRadius).fill(this.colors.background);
      doc.restore();
    }

    if (percent > 0) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (percent / 100) * 2 * Math.PI;
      
      this.drawArcSlice(doc, centerX, centerY, innerRadius, radius, startAngle, endAngle, successColor);
    }

    doc.circle(centerX, centerY, innerRadius).fill(this.colors.background);
  }

  private drawArcSlice(doc: PDFKit.PDFDocument, centerX: number, centerY: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, color: string) {
    doc.save();
    
    const steps = 50;
    const angleStep = (endAngle - startAngle) / steps;

    doc.moveTo(
      centerX + Math.cos(startAngle) * outerRadius,
      centerY + Math.sin(startAngle) * outerRadius
    );

    for (let i = 1; i <= steps; i++) {
      const angle = startAngle + i * angleStep;
      doc.lineTo(
        centerX + Math.cos(angle) * outerRadius,
        centerY + Math.sin(angle) * outerRadius
      );
    }

    doc.lineTo(
      centerX + Math.cos(endAngle) * innerRadius,
      centerY + Math.sin(endAngle) * innerRadius
    );

    for (let i = steps - 1; i >= 0; i--) {
      const angle = startAngle + i * angleStep;
      doc.lineTo(
        centerX + Math.cos(angle) * innerRadius,
        centerY + Math.sin(angle) * innerRadius
      );
    }

    doc.closePath();
    doc.fill(color);
    doc.restore();
  }

  private getHealthColor(successRate: number): string {
    if (successRate >= 95) return this.colors.success;
    if (successRate >= 80) return this.colors.warning;
    return this.colors.error;
  }

  private getScoreLabel(successRate: number): string {
    if (successRate >= 90) return "Excelente";
    if (successRate >= 70) return "Bom";
    if (successRate >= 50) return "Atenção";
    return "Crítico";
  }

  private getHealthLabel(status: string): string {
    switch (status) {
      case "healthy": return "Saudável";
      case "warning": return "Atenção";
      case "critical": return "Crítico";
      default: return "Desconhecido";
    }
  }

  private getHealthStatusColor(status: string): string {
    switch (status) {
      case "healthy": return this.colors.success;
      case "warning": return this.colors.warning;
      case "critical": return this.colors.error;
      default: return this.colors.muted;
    }
  }

  private getUsageColor(percent: number): string {
    if (percent < 70) return this.colors.success;
    if (percent < 90) return this.colors.warning;
    return this.colors.error;
  }
}

export const pdfService = new PDFService();

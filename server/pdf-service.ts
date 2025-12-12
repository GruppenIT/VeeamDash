import PDFDocument from "pdfkit";
import { veeamService } from "./veeam-service";
import type { DashboardMetrics, ProtectedWorkload } from "@shared/schema";
import path from "path";
import fs from "fs";

interface ReportData {
  companyId: string;
  companyName: string;
  metrics: DashboardMetrics;
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
    secondary: "#1a1a1a",
    muted: "#666666",
    background: "#ffffff",
    border: "#e5e5e5",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
  };

  async generateReport(companyId: string, companyName: string): Promise<Buffer> {
    const metrics = await veeamService.getDashboardMetrics(companyId);
    
    const reportData: ReportData = {
      companyId,
      companyName,
      metrics,
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
      this.addMetricsPage(doc, data);
      doc.addPage();
      this.addRepositoriesPage(doc, data);
      doc.addPage();
      this.addWorkloadsPage(doc, data);
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
      .fontSize(36)
      .font("Helvetica-Bold")
      .text("Relatório de Backup", margin, centerY, { align: "center" });

    doc.fillColor(this.colors.secondary)
      .fontSize(24)
      .font("Helvetica")
      .text(data.companyName, margin, centerY + 50, { align: "center" });

    doc.fillColor(this.colors.muted)
      .fontSize(14)
      .text(
        `Gerado em ${data.generatedAt.toLocaleDateString("pt-BR")} às ${data.generatedAt.toLocaleTimeString("pt-BR")}`,
        margin,
        centerY + 90,
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

  private addMetricsPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Resumo Executivo");
    y += 80;

    const metrics = {
      totalBackups: data.metrics.totalBackups ?? 0,
      successRate: data.metrics.successRate ?? 0,
      activeJobs: data.metrics.activeJobs ?? 0,
      storageUsedGB: data.metrics.storageUsedGB ?? 0,
      healthStatus: data.metrics.healthStatus ?? "unknown",
      repositories: data.metrics.repositories ?? [],
      protectedWorkloads: data.metrics.protectedWorkloads ?? [],
      recentFailures: data.metrics.recentFailures ?? [],
      monthlySuccessRates: data.metrics.monthlySuccessRates ?? [],
    };

    const cardWidth = (pageWidth - 2 * margin - 30) / 2;
    const cardHeight = 80;

    const cards = [
      { label: "Total de Backups", value: metrics.totalBackups.toString(), color: this.colors.primary },
      { label: "Taxa de Sucesso", value: `${metrics.successRate.toFixed(1)}%`, color: this.getHealthColor(metrics.successRate) },
      { label: "Jobs Ativos", value: metrics.activeJobs.toString(), color: this.colors.primary },
      { label: "Armazenamento (GB)", value: metrics.storageUsedGB.toFixed(1), color: this.colors.primary },
    ];

    cards.forEach((card, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + col * (cardWidth + 30);
      const cardY = y + row * (cardHeight + 20);

      doc.rect(x, cardY, cardWidth, cardHeight).fill("#f5f5f5");
      doc.rect(x, cardY, 4, cardHeight).fill(card.color);

      doc.fillColor(this.colors.muted)
        .fontSize(10)
        .font("Helvetica")
        .text(card.label, x + 15, cardY + 15);

      doc.fillColor(this.colors.secondary)
        .fontSize(28)
        .font("Helvetica-Bold")
        .text(card.value, x + 15, cardY + 35);
    });

    y += 2 * (cardHeight + 20) + 30;

    doc.fillColor(this.colors.secondary)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Status de Saúde", margin, y);

    y += 25;

    const healthStatus = this.getHealthLabel(metrics.healthStatus);
    const healthColor = this.getHealthStatusColor(metrics.healthStatus);

    doc.rect(margin, y, pageWidth - 2 * margin, 50).fill("#f5f5f5");
    doc.rect(margin, y, 4, 50).fill(healthColor);

    doc.fillColor(healthColor)
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(healthStatus, margin + 15, y + 15);

    y += 70;

    if (metrics.monthlySuccessRates && metrics.monthlySuccessRates.length > 0) {
      doc.fillColor(this.colors.secondary)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Taxa de Sucesso Mensal", margin, y);

      y += 30;

      const chartWidth = pageWidth - 2 * margin;
      const chartHeight = 120;
      const barWidth = Math.floor(chartWidth / 12) - 6;

      doc.rect(margin, y, chartWidth, chartHeight).fill("#f9f9f9");

      const recentMonths = metrics.monthlySuccessRates.slice(-6);
      const barGap = (chartWidth - recentMonths.length * barWidth) / (recentMonths.length + 1);

      recentMonths.forEach((item, index) => {
        const barHeight = (item.rate / 100) * (chartHeight - 30);
        const barX = margin + barGap + index * (barWidth + barGap);
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
  }

  private addRepositoriesPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Repositórios de Armazenamento");
    y += 80;

    const repositories = data.metrics.repositories ?? [];

    if (repositories.length === 0) {
      doc.fillColor(this.colors.muted)
        .fontSize(12)
        .font("Helvetica")
        .text("Nenhum repositório encontrado.", margin, y);
      return;
    }

    repositories.forEach((repo, index) => {
      if (y > 700) return;

      const usagePercent = repo.capacity > 0 
        ? (repo.usedSpace / repo.capacity) * 100 
        : 0;
      const usedGB = repo.usedSpace / (1024 * 1024 * 1024);
      const totalGB = repo.capacity / (1024 * 1024 * 1024);
      const freeGB = totalGB - usedGB;

      doc.rect(margin, y, pageWidth - 2 * margin, 70).fill("#f5f5f5");
      doc.rect(margin, y, 4, 70).fill(this.getUsageColor(usagePercent));

      doc.fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(repo.name, margin + 15, y + 10);

      doc.fillColor(this.colors.muted)
        .fontSize(10)
        .font("Helvetica")
        .text(`Usado: ${usedGB.toFixed(1)} GB | Livre: ${freeGB.toFixed(1)} GB | Total: ${totalGB.toFixed(1)} GB`, margin + 15, y + 28);

      const barY = y + 48;
      const barWidth = pageWidth - 2 * margin - 30;
      doc.rect(margin + 15, barY, barWidth, 12).fill("#e5e5e5");
      doc.rect(margin + 15, barY, (barWidth * usagePercent) / 100, 12).fill(this.getUsageColor(usagePercent));

      doc.fillColor(this.colors.secondary)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(`${usagePercent.toFixed(0)}%`, margin + barWidth - 20, barY + 2);

      y += 85;
    });
  }

  private addWorkloadsPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    this.addHeader(doc, "Dados Protegidos");
    y += 80;

    const workloads: ProtectedWorkload[] = data.metrics.protectedWorkloads ?? [];
    const recentFailures = data.metrics.recentFailures ?? [];

    const tableHeaders = ["Tipo de Workload", "Quantidade", "Tamanho (GB)"];
    const colWidths = [220, 120, 120];
    let x = margin;

    doc.rect(margin, y, pageWidth - 2 * margin, 25).fill("#f0f0f0");

    doc.fillColor(this.colors.secondary)
      .fontSize(11)
      .font("Helvetica-Bold");

    tableHeaders.forEach((header, i) => {
      doc.text(header, x + 10, y + 7);
      x += colWidths[i];
    });

    y += 30;

    doc.font("Helvetica");
    workloads.forEach((workload: ProtectedWorkload, index) => {
      const rowY = y;
      const bgColor = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
      doc.rect(margin, rowY, pageWidth - 2 * margin, 25).fill(bgColor);

      x = margin;
      doc.fillColor(this.colors.secondary)
        .fontSize(10)
        .text(workload.name, x + 10, rowY + 7);
      x += colWidths[0];

      doc.text(workload.quantity.toLocaleString("pt-BR"), x + 10, rowY + 7);
      x += colWidths[1];

      doc.text(workload.sizeGB.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), x + 10, rowY + 7);

      y += 25;
    });

    y += 20;

    const totalQuantity = workloads.reduce((sum: number, w: ProtectedWorkload) => sum + w.quantity, 0);
    const totalSize = workloads.reduce((sum: number, w: ProtectedWorkload) => sum + w.sizeGB, 0);

    doc.rect(margin, y, pageWidth - 2 * margin, 60).fill("#e8f5e9");
    doc.rect(margin, y, 4, 60).fill(this.colors.primary);

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Total de Dados Protegidos", margin + 15, y + 15);

    doc.fillColor(this.colors.primary)
      .fontSize(22)
      .text(`${totalQuantity.toLocaleString("pt-BR")} itens | ${totalSize.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`, margin + 15, y + 35);

    y += 80;

    if (recentFailures.length > 0) {
      doc.fillColor(this.colors.secondary)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Falhas Recentes", margin, y);

      y += 25;

      recentFailures.slice(0, 5).forEach((failure) => {
        if (y > 750) return;

        doc.rect(margin, y, pageWidth - 2 * margin, 45).fill("#fef2f2");
        doc.rect(margin, y, 4, 45).fill(this.colors.error);

        doc.fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(failure.jobName, margin + 15, y + 8);

        doc.fillColor(this.colors.muted)
          .fontSize(9)
          .font("Helvetica")
          .text(failure.errorMessage.substring(0, 90), margin + 15, y + 24, { width: pageWidth - 2 * margin - 30 });

        y += 55;
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

  private getHealthColor(successRate: number): string {
    if (successRate >= 95) return this.colors.success;
    if (successRate >= 80) return this.colors.warning;
    return this.colors.error;
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

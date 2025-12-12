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
    firewall365: path.join(process.cwd(), "attached_assets", "firewall365_1765573676765.png"),
    gruppen: path.join(process.cwd(), "attached_assets", "gruppen_1765573676765.png"),
    gsecdo: path.join(process.cwd(), "attached_assets", "gsecdo_1765573676765.png"),
    zerobox: path.join(process.cwd(), "attached_assets", "zerobox_1765573676765.png"),
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
        info: {
          Title: `Relatório de Backup - ${data.companyName}`,
          Author: "Veeam VSPC Dashboard",
          Subject: "Relatório Automatizado de Backup",
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

    const logos = ["firewall365", "gruppen", "gsecdo", "zerobox"] as const;
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
        "Este relatório foi gerado automaticamente pelo Veeam VSPC Dashboard.",
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

    doc.fillColor(this.colors.secondary)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Resumo Executivo", margin, y);

    y += 40;
    doc.rect(margin, y, pageWidth - 2 * margin, 1).fill(this.colors.primary);
    y += 20;

    const metrics = {
      totalBackups: data.metrics.totalBackups ?? 0,
      successRate: data.metrics.successRate ?? 0,
      activeJobs: data.metrics.activeJobs ?? 0,
      storageUsedGB: data.metrics.storageUsedGB ?? 0,
      healthStatus: data.metrics.healthStatus ?? "unknown",
      repositories: data.metrics.repositories ?? [],
      protectedWorkloads: data.metrics.protectedWorkloads ?? [],
      recentFailures: data.metrics.recentFailures ?? [],
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

    if (metrics.repositories && metrics.repositories.length > 0) {
      doc.fillColor(this.colors.secondary)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Repositórios", margin, y);

      y += 25;

      metrics.repositories.slice(0, 5).forEach((repo) => {
        const usagePercent = repo.capacity > 0 
          ? (repo.usedSpace / repo.capacity) * 100 
          : 0;
        const usedGB = repo.usedSpace / (1024 * 1024 * 1024);
        const totalGB = repo.capacity / (1024 * 1024 * 1024);

        doc.fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica")
          .text(repo.name, margin, y);

        doc.fillColor(this.colors.muted)
          .text(`${usedGB.toFixed(1)} / ${totalGB.toFixed(1)} GB (${usagePercent.toFixed(0)}%)`, margin + 200, y);

        y += 20;

        doc.rect(margin, y, pageWidth - 2 * margin, 10).fill("#e5e5e5");
        const barWidth = ((pageWidth - 2 * margin) * usagePercent) / 100;
        doc.rect(margin, y, barWidth, 10).fill(this.getUsageColor(usagePercent));

        y += 25;
      });
    }
  }

  private addWorkloadsPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const margin = 50;
    const pageWidth = doc.page.width;
    let y = margin;

    doc.fillColor(this.colors.secondary)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Dados Protegidos", margin, y);

    y += 40;
    doc.rect(margin, y, pageWidth - 2 * margin, 1).fill(this.colors.primary);
    y += 30;

    const workloads: ProtectedWorkload[] = data.metrics.protectedWorkloads ?? [];
    const recentFailures = data.metrics.recentFailures ?? [];

    const tableHeaders = ["Tipo", "Quantidade", "Tamanho (GB)"];
    const colWidths = [220, 120, 120];
    let x = margin;

    doc.fillColor(this.colors.secondary)
      .fontSize(11)
      .font("Helvetica-Bold");

    tableHeaders.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });

    y += 25;
    doc.rect(margin, y, pageWidth - 2 * margin, 1).fill(this.colors.border);
    y += 10;

    doc.font("Helvetica");
    workloads.forEach((workload: ProtectedWorkload) => {
      x = margin;
      doc.fillColor(this.colors.secondary)
        .fontSize(10)
        .text(workload.name, x, y);
      x += colWidths[0];

      doc.text(workload.quantity.toString(), x, y);
      x += colWidths[1];

      doc.text(workload.sizeGB.toFixed(1), x, y);

      y += 25;
    });

    y += 20;

    const totalQuantity = workloads.reduce((sum: number, w: ProtectedWorkload) => sum + w.quantity, 0);
    const totalSize = workloads.reduce((sum: number, w: ProtectedWorkload) => sum + w.sizeGB, 0);

    doc.rect(margin, y, pageWidth - 2 * margin, 60).fill("#f5f5f5");
    doc.rect(margin, y, 4, 60).fill(this.colors.primary);

    doc.fillColor(this.colors.secondary)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Total de Dados Protegidos", margin + 15, y + 15);

    doc.fillColor(this.colors.primary)
      .fontSize(24)
      .text(`${totalQuantity} itens (${totalSize.toFixed(1)} GB)`, margin + 15, y + 35);

    y += 80;

    if (recentFailures.length > 0) {
      doc.fillColor(this.colors.secondary)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Falhas Recentes", margin, y);

      y += 25;

      recentFailures.slice(0, 5).forEach((failure) => {
        doc.rect(margin, y, pageWidth - 2 * margin, 40).fill("#fef2f2");
        doc.rect(margin, y, 4, 40).fill(this.colors.error);

        doc.fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(failure.jobName, margin + 15, y + 8);

        doc.fillColor(this.colors.muted)
          .fontSize(9)
          .font("Helvetica")
          .text(failure.errorMessage.substring(0, 80), margin + 15, y + 22);

        y += 50;
      });
    }
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
        `${data.companyName} - ${data.generatedAt.toLocaleDateString("pt-BR")}`,
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

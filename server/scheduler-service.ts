import cron from "node-cron";
import { storage } from "./storage";
import { playwrightPdfService } from "./playwright-pdf-service";
import { emailService } from "./email-service";
import type { ReportSchedule, ScheduleRecipient } from "@shared/schema";

export class SchedulerService {
  private cronJob: cron.ScheduledTask | null = null;
  private executingSchedules: Set<string> = new Set();

  start() {
    if (this.cronJob) {
      console.log("[Scheduler] Already running");
      return;
    }

    this.cronJob = cron.schedule("* * * * *", async () => {
      await this.checkAndExecuteSchedules();
    });

    console.log("[Scheduler] Started - checking every minute");
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("[Scheduler] Stopped");
    }
  }

  private async checkAndExecuteSchedules() {
    try {
      // Usar horário de Brasília (GMT-3) para agendamentos
      const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const currentHour = nowBrasilia.getHours();
      const currentMinute = nowBrasilia.getMinutes();
      const currentDayOfWeek = nowBrasilia.getDay();
      const currentDayOfMonth = nowBrasilia.getDate();

      const activeSchedules = await storage.getActiveSchedules();

      const executionPromises: Promise<void>[] = [];

      for (const schedule of activeSchedules) {
        if (this.executingSchedules.has(schedule.id)) {
          console.log(`[Scheduler] Schedule ${schedule.id} already executing, skipping`);
          continue;
        }

        const shouldRun = this.shouldScheduleRun(
          schedule,
          currentHour,
          currentMinute,
          currentDayOfWeek,
          currentDayOfMonth
        );

        if (shouldRun) {
          console.log(`[Scheduler] Executing schedule: ${schedule.name} (${schedule.id})`);
          executionPromises.push(this.executeScheduleWithLock(schedule));
        }
      }

      await Promise.allSettled(executionPromises);
    } catch (error) {
      console.error("[Scheduler] Error checking schedules:", error);
    }
  }

  private async executeScheduleWithLock(schedule: ReportSchedule): Promise<void> {
    this.executingSchedules.add(schedule.id);
    try {
      await this.executeSchedule(schedule);
    } finally {
      this.executingSchedules.delete(schedule.id);
    }
  }

  private shouldScheduleRun(
    schedule: ReportSchedule,
    hour: number,
    minute: number,
    dayOfWeek: number,
    dayOfMonth: number
  ): boolean {
    if (schedule.hour !== hour || schedule.minute !== minute) {
      return false;
    }

    switch (schedule.frequency) {
      case "daily":
        return true;
      case "weekly":
        return schedule.dayOfWeek === dayOfWeek;
      case "monthly":
        return schedule.dayOfMonth === dayOfMonth;
      default:
        return false;
    }
  }

  private async executeSchedule(schedule: ReportSchedule) {
    const run = await storage.createScheduleRun({
      scheduleId: schedule.id,
      status: "running",
      recipientCount: 0,
    });

    try {
      if (!emailService.isConfigured()) {
        throw new Error("Email service not configured. Please set M365 environment variables.");
      }

      const recipients = await storage.getScheduleRecipients(schedule.id);
      const recipientEmails = recipients.map((r: ScheduleRecipient) => r.email);

      if (recipientEmails.length === 0) {
        throw new Error("No recipients configured for this schedule");
      }

      console.log(`[Scheduler] Generating PDF for ${schedule.companyName}...`);
      const baseUrl = process.env.BASE_URL || "http://localhost:5000";
      const pdfBuffer = await playwrightPdfService.generatePdf(schedule.companyId, baseUrl, schedule.frequency);

      console.log(`[Scheduler] Sending email to ${recipientEmails.length} recipients...`);
      await emailService.sendReportEmail(
        recipientEmails,
        schedule.companyName,
        pdfBuffer,
        new Date(),
        schedule.frequency
      );

      await storage.updateScheduleRun(run.id, {
        status: "success",
        recipientCount: recipientEmails.length,
        completedAt: new Date(),
      });

      console.log(`[Scheduler] Schedule ${schedule.name} executed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Schedule ${schedule.name} failed:`, errorMessage);

      await storage.updateScheduleRun(run.id, {
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      });
    }
  }

  async executeManually(scheduleId: string): Promise<{ success: boolean; message: string }> {
    try {
      const schedule = await storage.getReportScheduleById(scheduleId);
      if (!schedule) {
        return { success: false, message: "Agendamento não encontrado" };
      }

      await this.executeSchedule(schedule);
      return { success: true, message: "Relatório enviado com sucesso" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: errorMessage };
    }
  }
}

export const schedulerService = new SchedulerService();

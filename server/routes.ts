import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { veeamService } from "./veeam-service";
import { insertUserSchema, insertEmailScheduleSchema, insertReportScheduleSchema, insertScheduleRecipientSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "veeam-vspc-dashboard-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Changed: set to false even in production because we're behind Nginx proxy
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      },
    })
  );

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    next();
  };

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (username !== "login@sistema.com") {
        return res.status(401).json({
          success: false,
          message: "Usuário não autorizado. Use login@sistema.com",
        });
      }

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Usuário não encontrado. Reinicie a aplicação.",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Senha incorreta. Use a senha padrão: admin",
        });
      }

      req.session.userId = user.id;

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Erro no servidor",
      });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      return res.json({
        id: user.id,
        username: user.username,
        name: user.name,
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Erro no servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ success: true });
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Senha atual e nova senha são obrigatórias",
        });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          message: "A nova senha deve ter no mínimo 4 caracteres",
        });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Senha atual incorreta",
        });
      }

      // Password will be hashed automatically by storage.updateUserPassword
      await storage.updateUserPassword(user.id, newPassword);

      return res.json({
        success: true,
        message: "Senha alterada com sucesso",
      });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({
        success: false,
        message: "Erro no servidor",
      });
    }
  });

  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const companies = await veeamService.getCompanies();
      return res.json(companies);
    } catch (error) {
      console.error("Get companies error:", error);
      return res.status(500).json({ message: "Erro ao buscar empresas" });
    }
  });

  app.get("/api/dashboard/metrics/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const metrics = await veeamService.getDashboardMetrics(companyId);
      return res.json(metrics);
    } catch (error) {
      console.error("Get metrics error:", error);
      return res.status(500).json({ message: "Erro ao buscar métricas" });
    }
  });

  app.post("/api/schedules", requireAuth, async (req, res) => {
    try {
      const validation = insertEmailScheduleSchema.safeParse({
        ...req.body,
        userId: req.session.userId,
      });

      if (!validation.success) {
        return res.status(400).json({
          message: fromZodError(validation.error).toString(),
        });
      }

      const schedule = await storage.createEmailSchedule(validation.data);
      return res.json(schedule);
    } catch (error) {
      console.error("Create schedule error:", error);
      return res.status(500).json({ message: "Erro ao criar agendamento" });
    }
  });

  app.get("/api/schedules", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getEmailSchedulesByUser(req.session.userId!);
      return res.json(schedules);
    } catch (error) {
      console.error("Get schedules error:", error);
      return res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
  });

  app.get("/api/scorecard/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const scorecard = await veeamService.getDataPlatformScorecard(companyId);
      return res.json(scorecard);
    } catch (error) {
      console.error("Get scorecard error:", error);
      return res.status(500).json({ message: "Erro ao buscar scorecard" });
    }
  });

  // Collect session snapshot for a company (called by cron or manually)
  app.post("/api/session-snapshots/collect", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ message: "companyId is required" });
      }

      const result = await veeamService.collectSessionSnapshot(companyId);
      return res.json(result);
    } catch (error) {
      console.error("Collect session snapshot error:", error);
      return res.status(500).json({ message: "Erro ao coletar snapshot" });
    }
  });

  // Collect session snapshots for all companies (authenticated)
  app.post("/api/session-snapshots/collect-all", requireAuth, async (req, res) => {
    try {
      const companies = await veeamService.getCompanies();
      const results = [];
      
      for (const company of companies) {
        try {
          const result = await veeamService.collectSessionSnapshot(company.instanceUid);
          results.push({ company: company.name, success: true, result });
        } catch (error) {
          results.push({ company: company.name, success: false, error: String(error) });
        }
      }
      
      return res.json({ collected: results.length, results });
    } catch (error) {
      console.error("Collect all snapshots error:", error);
      return res.status(500).json({ message: "Erro ao coletar snapshots" });
    }
  });

  // Internal endpoint for cron job - uses API key via header only
  app.post("/api/internal/collect-snapshots", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'];
      const expectedKey = process.env.INTERNAL_API_KEY || process.env.SESSION_SECRET;
      
      if (!apiKey || apiKey !== expectedKey) {
        console.warn(`[Security] Invalid API key attempt from ${req.ip}`);
        return res.status(401).json({ message: "Chave de API inválida" });
      }

      const companies = await veeamService.getCompanies();
      const results = [];
      
      for (const company of companies) {
        try {
          const result = await veeamService.collectSessionSnapshot(company.instanceUid);
          results.push({ company: company.name, success: true, result });
        } catch (error) {
          results.push({ company: company.name, success: false, error: String(error) });
        }
      }
      
      console.log(`[Cron] Collected snapshots for ${results.length} companies`);
      return res.json({ collected: results.length, results });
    } catch (error) {
      console.error("Internal collect snapshots error:", error);
      return res.status(500).json({ message: "Erro ao coletar snapshots" });
    }
  });

  // Get session states for calendar (last 30 days)
  app.get("/api/session-states/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const sessionStates = await veeamService.getSessionStates(companyId);
      return res.json(sessionStates);
    } catch (error) {
      console.error("Get session states error:", error);
      return res.status(500).json({ message: "Erro ao buscar estados de sessão" });
    }
  });

  // Get monthly chart data (last 12 months)
  app.get("/api/monthly-stats/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const monthlyStats = await veeamService.getMonthlyStats(companyId);
      return res.json(monthlyStats);
    } catch (error) {
      console.error("Get monthly stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas mensais" });
    }
  });

  // Get active alarms for a company
  app.get("/api/alarms/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const alarms = await veeamService.getActiveAlarms(companyId);
      return res.json(alarms);
    } catch (error) {
      console.error("Get alarms error:", error);
      return res.status(500).json({ message: "Erro ao buscar alarmes" });
    }
  });

  // Get failed jobs for a company
  app.get("/api/failed-jobs/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const failedJobs = await veeamService.getFailedJobs(companyId);
      return res.json(failedJobs);
    } catch (error) {
      console.error("Get failed jobs error:", error);
      return res.status(500).json({ message: "Erro ao buscar jobs com falha" });
    }
  });

  // =====================
  // REPORT SCHEDULES API
  // =====================

  // Create a new report schedule with recipients
  app.post("/api/report-schedules", requireAuth, async (req, res) => {
    try {
      const { recipients, ...scheduleData } = req.body;
      
      const validation = insertReportScheduleSchema.safeParse({
        ...scheduleData,
        userId: req.session.userId,
      });

      if (!validation.success) {
        return res.status(400).json({
          message: fromZodError(validation.error).toString(),
        });
      }

      // Validate recipients
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          message: "Pelo menos um destinatário é obrigatório",
        });
      }

      const emailSchema = z.string().email();
      for (const email of recipients) {
        const emailValidation = emailSchema.safeParse(email);
        if (!emailValidation.success) {
          return res.status(400).json({
            message: `E-mail inválido: ${email}`,
          });
        }
      }

      // Create the schedule
      const schedule = await storage.createReportSchedule(validation.data);

      // Add recipients
      for (const email of recipients) {
        await storage.addScheduleRecipient({
          scheduleId: schedule.id,
          email,
        });
      }

      const scheduleRecipients = await storage.getScheduleRecipients(schedule.id);

      return res.json({
        ...schedule,
        recipients: scheduleRecipients,
      });
    } catch (error) {
      console.error("Create report schedule error:", error);
      return res.status(500).json({ message: "Erro ao criar agendamento de relatório" });
    }
  });

  // Get all report schedules for the current user
  app.get("/api/report-schedules", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getReportSchedules(req.session.userId!);
      
      // Fetch recipients for each schedule
      const schedulesWithRecipients = await Promise.all(
        schedules.map(async (schedule) => {
          const recipients = await storage.getScheduleRecipients(schedule.id);
          return {
            ...schedule,
            recipients,
          };
        })
      );

      return res.json(schedulesWithRecipients);
    } catch (error) {
      console.error("Get report schedules error:", error);
      return res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
  });

  // Get a single report schedule by ID
  app.get("/api/report-schedules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.getReportScheduleById(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Check if user owns this schedule
      if (schedule.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const recipients = await storage.getScheduleRecipients(schedule.id);
      const runs = await storage.getScheduleRuns(schedule.id);

      return res.json({
        ...schedule,
        recipients,
        runs,
      });
    } catch (error) {
      console.error("Get report schedule error:", error);
      return res.status(500).json({ message: "Erro ao buscar agendamento" });
    }
  });

  // Update a report schedule
  app.patch("/api/report-schedules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { recipients, ...updateData } = req.body;

      const schedule = await storage.getReportScheduleById(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Check if user owns this schedule
      if (schedule.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Update schedule
      const updated = await storage.updateReportSchedule(id, updateData);

      // Update recipients if provided
      if (recipients && Array.isArray(recipients)) {
        // Validate emails
        const emailSchema = z.string().email();
        for (const email of recipients) {
          const emailValidation = emailSchema.safeParse(email);
          if (!emailValidation.success) {
            return res.status(400).json({
              message: `E-mail inválido: ${email}`,
            });
          }
        }

        // Delete old recipients and add new ones
        await storage.deleteScheduleRecipients(id);
        for (const email of recipients) {
          await storage.addScheduleRecipient({
            scheduleId: id,
            email,
          });
        }
      }

      const updatedRecipients = await storage.getScheduleRecipients(id);

      return res.json({
        ...updated,
        recipients: updatedRecipients,
      });
    } catch (error) {
      console.error("Update report schedule error:", error);
      return res.status(500).json({ message: "Erro ao atualizar agendamento" });
    }
  });

  // Delete a report schedule
  app.delete("/api/report-schedules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const schedule = await storage.getReportScheduleById(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Check if user owns this schedule
      if (schedule.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.deleteReportSchedule(id);

      return res.json({ success: true, message: "Agendamento excluído com sucesso" });
    } catch (error) {
      console.error("Delete report schedule error:", error);
      return res.status(500).json({ message: "Erro ao excluir agendamento" });
    }
  });

  // Toggle schedule active status
  app.patch("/api/report-schedules/:id/toggle", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const schedule = await storage.getReportScheduleById(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Check if user owns this schedule
      if (schedule.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const updated = await storage.updateReportSchedule(id, {
        isActive: !schedule.isActive,
      });

      return res.json(updated);
    } catch (error) {
      console.error("Toggle report schedule error:", error);
      return res.status(500).json({ message: "Erro ao alterar status do agendamento" });
    }
  });

  // Manual run of a schedule
  app.post("/api/report-schedules/:id/run", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const schedule = await storage.getReportScheduleById(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Check if user owns this schedule
      if (schedule.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Import and execute scheduler
      const { schedulerService } = await import("./scheduler-service");
      const result = await schedulerService.executeManually(id);

      if (result.success) {
        return res.json({ message: result.message });
      } else {
        return res.status(400).json({ message: result.message });
      }
    } catch (error) {
      console.error("Manual run error:", error);
      return res.status(500).json({ message: "Erro ao executar agendamento" });
    }
  });

  // Get run history for a schedule
  app.get("/api/report-schedules/:id/runs", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const schedule = await storage.getReportScheduleById(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Check if user owns this schedule
      if (schedule.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const runs = await storage.getScheduleRuns(id);

      return res.json(runs);
    } catch (error) {
      console.error("Get schedule runs error:", error);
      return res.status(500).json({ message: "Erro ao buscar histórico de execuções" });
    }
  });

  // Get all report data in a single request (for PDF generation)
  app.get("/api/report/data/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID é obrigatório" });
      }

      console.log(`[ReportData] Fetching all data for company ${companyId}...`);

      const fetchWithFallback = async <T>(
        name: string,
        fetcher: () => Promise<T>,
        fallback: T
      ): Promise<{ data: T; error: string | null }> => {
        try {
          const data = await fetcher();
          return { data, error: null };
        } catch (err) {
          console.error(`[ReportData] Error fetching ${name}:`, err);
          return { data: fallback, error: err instanceof Error ? err.message : String(err) };
        }
      };

      const [companiesResult, metricsResult, scorecardResult, sessionStatesResult, monthlyStatsResult, failedJobsResult] = await Promise.all([
        fetchWithFallback("companies", () => veeamService.getCompanies(), []),
        fetchWithFallback("metrics", () => veeamService.getDashboardMetrics(companyId), { 
          totalBackups: 0, successRate: 0, activeJobs: 0, storageUsedGB: 0, 
          healthStatus: 'warning' as const, repositories: [], monthlySuccessRates: [],
          recentFailures: [], protectedWorkloads: []
        }),
        fetchWithFallback("scorecard", () => veeamService.getDataPlatformScorecard(companyId), {
          overallScore: 0, status: "Atenção" as const, statusMessage: "Dados indisponíveis",
          jobSessions: { percentage: 0, okCount: 0, issueCount: 0, title: "Sessões de Jobs" },
          platformHealth: { percentage: 0, okCount: 0, issueCount: 0, title: "Saúde da Plataforma" }
        }),
        fetchWithFallback("sessionStates", () => veeamService.getSessionStates(companyId), { days: [], hasData: false }),
        fetchWithFallback("monthlyStats", () => veeamService.getMonthlyStats(companyId), []),
        fetchWithFallback("failedJobs", () => veeamService.getFailedJobs(companyId), []),
      ]);

      const company = companiesResult.data.find(c => c.instanceUid === companyId);
      const companyName = company?.name || "Cliente";

      const errors = [
        metricsResult.error && `metrics: ${metricsResult.error}`,
        scorecardResult.error && `scorecard: ${scorecardResult.error}`,
      ].filter(Boolean);

      const hasEssentialData = !metricsResult.error && !scorecardResult.error;

      console.log(`[ReportData] Data fetched for ${companyName}. Essential data: ${hasEssentialData}`);

      return res.json({
        success: hasEssentialData,
        companyId,
        companyName,
        metrics: metricsResult.data,
        scorecard: scorecardResult.data,
        sessionStates: sessionStatesResult.data,
        monthlyStats: monthlyStatsResult.data,
        failedJobs: failedJobsResult.data,
        generatedAt: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("[ReportData] Error fetching report data:", error);
      return res.status(500).json({ 
        success: false,
        message: "Erro ao buscar dados do relatório",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Generate PDF report via Playwright (download endpoint)
  app.get("/api/report/pdf/:companyId", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID é obrigatório" });
      }

      // Get company name for the filename
      const companies = await veeamService.getCompanies();
      const company = companies.find(c => c.instanceUid === companyId);
      const companyName = company?.name || "Relatorio";
      const sanitizedName = companyName.replace(/[^a-zA-Z0-9]/g, "_");

      // Import and use Playwright PDF service
      const { playwrightPdfService } = await import("./playwright-pdf-service");
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      
      console.log(`[PDF] Generating PDF for company ${companyId}...`);
      const pdfBuffer = await playwrightPdfService.generatePdf(companyId, baseUrl);
      
      const filename = `Relatorio_BaaS_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      
      return res.send(pdfBuffer);
    } catch (error) {
      console.error("[PDF] Error generating PDF:", error);
      return res.status(500).json({ 
        message: "Erro ao gerar PDF. Verifique se o Playwright está instalado corretamente.",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

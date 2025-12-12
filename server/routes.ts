import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { veeamService } from "./veeam-service";
import { insertUserSchema, insertEmailScheduleSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

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

  const httpServer = createServer(app);

  return httpServer;
}

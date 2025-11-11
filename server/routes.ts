import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
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
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
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

      if (user.password !== password) {
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

  const httpServer = createServer(app);

  return httpServer;
}

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
});

export const emailSchedules = pgTable("email_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  frequency: text("frequency").notNull(),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  hour: integer("hour").notNull(),
  minute: integer("minute").notNull(),
  companyId: text("company_id"),
  companyName: text("company_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  userId: varchar("user_id").notNull().references(() => users.id),
});

// Session snapshots for historical calendar view
export const sessionSnapshots = pgTable("session_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  companyId: text("company_id").notNull(),
  companyName: text("company_name").notNull(),
  successCount: integer("success_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
});

export const insertEmailScheduleSchema = createInsertSchema(emailSchedules).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSnapshotSchema = createInsertSchema(sessionSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type EmailSchedule = typeof emailSchedules.$inferSelect;
export type InsertEmailSchedule = z.infer<typeof insertEmailScheduleSchema>;
export type SessionSnapshot = typeof sessionSnapshots.$inferSelect;
export type InsertSessionSnapshot = z.infer<typeof insertSessionSnapshotSchema>;

// Veeam VSPC API Types (não armazenados no banco, apenas para type safety)
export interface VeeamCompany {
  instanceUid: string;
  name: string;
  status: string;
  organizationType: string;
}

export interface VeeamBackupJob {
  jobUid: string;
  name: string;
  jobType: string;
  lastRun: string;
  lastRunStatus: string;
  nextRun: string;
  backupChainSize: number;
  mappedOrganizationUid: string;
}

export interface VeeamRepository {
  name: string;
  capacity: number;
  freeSpace: number;
  usedSpace: number;
  path: string;
}

export interface VeeamProtectedVM {
  name: string;
  jobUid: string;
  latestRestorePointDate: string;
  totalRestorePointSize: number;
  status: string;
}

export interface BackupFailure {
  id: string;
  date: string;
  clientName: string;
  jobName: string;
  errorMessage: string;
  vmName: string;
}

export interface ProtectedWorkload {
  name: string;
  quantity: number;
  sizeGB: number;
  color: string;
}

export interface DashboardMetrics {
  totalBackups: number;
  successRate: number;
  activeJobs: number;
  storageUsedGB: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  repositories: VeeamRepository[];
  monthlySuccessRates: { month: string; rate: number }[];
  recentFailures: BackupFailure[];
  protectedWorkloads: ProtectedWorkload[];
}

// Data Platform Scorecard Types
export interface ScorecardMetric {
  percentage: number;
  okCount: number;
  issueCount: number;
  title: string;
}

export interface DataPlatformScorecard {
  overallScore: number;
  status: 'Excelente' | 'Atenção' | 'Crítico';
  statusMessage: string;
  jobSessions: ScorecardMetric;
  platformHealth: ScorecardMetric;
}

// Session States Calendar Types
export interface DaySessionState {
  date: string;
  successPercent: number;
  warningPercent: number;
  failedPercent: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  totalCount: number;
}

export interface SessionStatesData {
  days: DaySessionState[];
  hasData: boolean;
  message?: string;
}

// Monthly Charts Types
export interface MonthlyChartData {
  month: string;
  errors: number;
  warnings: number;
  successRate: number;
}

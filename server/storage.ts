// Based on javascript_database blueprint
import { 
  users, 
  emailSchedules, 
  sessionSnapshots, 
  reportSchedules, 
  scheduleRecipients, 
  scheduleRuns,
  type User, 
  type InsertUser, 
  type EmailSchedule, 
  type InsertEmailSchedule, 
  type SessionSnapshot, 
  type InsertSessionSnapshot,
  type ReportSchedule,
  type InsertReportSchedule,
  type ScheduleRecipient,
  type InsertScheduleRecipient,
  type ScheduleRun,
  type InsertScheduleRun,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  createEmailSchedule(schedule: InsertEmailSchedule): Promise<EmailSchedule>;
  getEmailSchedulesByUser(userId: string): Promise<EmailSchedule[]>;
  createSessionSnapshot(snapshot: InsertSessionSnapshot): Promise<SessionSnapshot>;
  getSessionSnapshots(companyId: string, startDate: Date, endDate: Date): Promise<SessionSnapshot[]>;
  getSnapshotByDateAndCompany(companyId: string, date: Date): Promise<SessionSnapshot | undefined>;
  upsertSessionSnapshot(snapshot: InsertSessionSnapshot): Promise<SessionSnapshot>;
  
  // Report Schedules CRUD
  createReportSchedule(schedule: InsertReportSchedule): Promise<ReportSchedule>;
  getReportSchedules(userId: string): Promise<ReportSchedule[]>;
  getReportScheduleById(id: string): Promise<ReportSchedule | undefined>;
  updateReportSchedule(id: string, data: Partial<InsertReportSchedule>): Promise<ReportSchedule>;
  deleteReportSchedule(id: string): Promise<void>;
  getActiveSchedules(): Promise<ReportSchedule[]>;
  
  // Schedule Recipients CRUD
  addScheduleRecipient(recipient: InsertScheduleRecipient): Promise<ScheduleRecipient>;
  getScheduleRecipients(scheduleId: string): Promise<ScheduleRecipient[]>;
  deleteScheduleRecipients(scheduleId: string): Promise<void>;
  
  // Schedule Runs CRUD
  createScheduleRun(run: InsertScheduleRun): Promise<ScheduleRun>;
  getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]>;
  updateScheduleRun(id: string, data: Partial<InsertScheduleRun>): Promise<ScheduleRun>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    // Hash password before updating
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async createEmailSchedule(schedule: InsertEmailSchedule): Promise<EmailSchedule> {
    const [result] = await db
      .insert(emailSchedules)
      .values(schedule)
      .returning();
    return result;
  }

  async getEmailSchedulesByUser(userId: string): Promise<EmailSchedule[]> {
    return await db
      .select()
      .from(emailSchedules)
      .where(eq(emailSchedules.userId, userId));
  }

  async createSessionSnapshot(snapshot: InsertSessionSnapshot): Promise<SessionSnapshot> {
    const [result] = await db
      .insert(sessionSnapshots)
      .values(snapshot)
      .returning();
    return result;
  }

  async getSessionSnapshots(companyId: string, startDate: Date, endDate: Date): Promise<SessionSnapshot[]> {
    return await db
      .select()
      .from(sessionSnapshots)
      .where(
        and(
          eq(sessionSnapshots.companyId, companyId),
          gte(sessionSnapshots.date, startDate),
          lte(sessionSnapshots.date, endDate)
        )
      );
  }

  async getSnapshotByDateAndCompany(companyId: string, date: Date): Promise<SessionSnapshot | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [snapshot] = await db
      .select()
      .from(sessionSnapshots)
      .where(
        and(
          eq(sessionSnapshots.companyId, companyId),
          gte(sessionSnapshots.date, startOfDay),
          lte(sessionSnapshots.date, endOfDay)
        )
      );
    return snapshot || undefined;
  }

  async upsertSessionSnapshot(snapshot: InsertSessionSnapshot): Promise<SessionSnapshot> {
    const existing = await this.getSnapshotByDateAndCompany(snapshot.companyId, snapshot.date);
    
    if (existing) {
      const [updated] = await db
        .update(sessionSnapshots)
        .set({
          successCount: snapshot.successCount,
          warningCount: snapshot.warningCount,
          failedCount: snapshot.failedCount,
          totalCount: snapshot.totalCount,
        })
        .where(eq(sessionSnapshots.id, existing.id))
        .returning();
      return updated;
    }
    
    return this.createSessionSnapshot(snapshot);
  }

  // Report Schedules CRUD
  async createReportSchedule(schedule: InsertReportSchedule): Promise<ReportSchedule> {
    const [result] = await db
      .insert(reportSchedules)
      .values(schedule)
      .returning();
    return result;
  }

  async getReportSchedules(userId: string): Promise<ReportSchedule[]> {
    return await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.userId, userId))
      .orderBy(desc(reportSchedules.createdAt));
  }

  async getReportScheduleById(id: string): Promise<ReportSchedule | undefined> {
    const [schedule] = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.id, id));
    return schedule || undefined;
  }

  async updateReportSchedule(id: string, data: Partial<InsertReportSchedule>): Promise<ReportSchedule> {
    const [updated] = await db
      .update(reportSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated;
  }

  async deleteReportSchedule(id: string): Promise<void> {
    // First delete recipients and runs
    await db.delete(scheduleRecipients).where(eq(scheduleRecipients.scheduleId, id));
    await db.delete(scheduleRuns).where(eq(scheduleRuns.scheduleId, id));
    // Then delete the schedule
    await db.delete(reportSchedules).where(eq(reportSchedules.id, id));
  }

  async getActiveSchedules(): Promise<ReportSchedule[]> {
    return await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.isActive, true));
  }

  // Schedule Recipients CRUD
  async addScheduleRecipient(recipient: InsertScheduleRecipient): Promise<ScheduleRecipient> {
    const [result] = await db
      .insert(scheduleRecipients)
      .values(recipient)
      .returning();
    return result;
  }

  async getScheduleRecipients(scheduleId: string): Promise<ScheduleRecipient[]> {
    return await db
      .select()
      .from(scheduleRecipients)
      .where(eq(scheduleRecipients.scheduleId, scheduleId));
  }

  async deleteScheduleRecipients(scheduleId: string): Promise<void> {
    await db.delete(scheduleRecipients).where(eq(scheduleRecipients.scheduleId, scheduleId));
  }

  // Schedule Runs CRUD
  async createScheduleRun(run: InsertScheduleRun): Promise<ScheduleRun> {
    const [result] = await db
      .insert(scheduleRuns)
      .values(run)
      .returning();
    return result;
  }

  async getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
    return await db
      .select()
      .from(scheduleRuns)
      .where(eq(scheduleRuns.scheduleId, scheduleId))
      .orderBy(desc(scheduleRuns.startedAt));
  }

  async updateScheduleRun(id: string, data: Partial<InsertScheduleRun>): Promise<ScheduleRun> {
    const [updated] = await db
      .update(scheduleRuns)
      .set(data)
      .where(eq(scheduleRuns.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();

// Based on javascript_database blueprint
import { users, emailSchedules, sessionSnapshots, type User, type InsertUser, type EmailSchedule, type InsertEmailSchedule, type SessionSnapshot, type InsertSessionSnapshot } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();

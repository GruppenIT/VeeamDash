// Based on javascript_database blueprint
import { users, emailSchedules, type User, type InsertUser, type EmailSchedule, type InsertEmailSchedule } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  createEmailSchedule(schedule: InsertEmailSchedule): Promise<EmailSchedule>;
  getEmailSchedulesByUser(userId: string): Promise<EmailSchedule[]>;
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
}

export const storage = new DatabaseStorage();

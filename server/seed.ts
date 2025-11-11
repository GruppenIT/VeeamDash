import { storage } from "./storage";

export async function seedDatabase() {
  try {
    const existingUser = await storage.getUserByUsername("login@sistema.com");
    
    if (!existingUser) {
      await storage.createUser({
        username: "login@sistema.com",
        password: "admin",
        name: "Administrador Sistema",
      });
      console.log("✓ Usuário padrão criado: login@sistema.com / admin");
    }
  } catch (error) {
    console.error("Erro ao criar usuário padrão:", error);
  }
}

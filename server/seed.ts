import { storage } from "./storage";

export async function seedDatabase() {
  try {
    const existingUser = await storage.getUserByUsername("login@sistema.com");
    
    if (!existingUser) {
      // Password will be hashed automatically by storage.createUser
      await storage.createUser({
        username: "login@sistema.com",
        password: "admin",
        name: "Administrador Sistema",
      });
      console.log("✓ Usuário padrão criado: login@sistema.com / admin");
    } else {
      console.log("ℹ Usuário já existe: login@sistema.com");
    }
  } catch (error) {
    console.error("Erro ao criar usuário padrão:", error);
    throw error;
  }
}

// Executar seed quando rodado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("✅ Seed concluído com sucesso!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erro no seed:", error);
      process.exit(1);
    });
}

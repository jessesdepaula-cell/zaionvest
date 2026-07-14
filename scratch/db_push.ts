import { loadEnvConfig } from "@next/env";
import { execSync } from "child_process";

loadEnvConfig(process.cwd());

console.log("🚀 Iniciando prisma db push com as variáveis do Next.js...");
try {
  execSync("npx prisma db push", { stdio: "inherit", env: process.env });
  console.log("🎉 Prisma db push concluído com sucesso!");
} catch (err) {
  console.error("❌ Erro no prisma db push:", err);
  process.exit(1);
}

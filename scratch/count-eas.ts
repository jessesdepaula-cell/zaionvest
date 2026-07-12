import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const totalEAs = await prisma.eA.count();
  const approvedEAs = await prisma.eA.count({ where: { status: "APPROVED" } });
  const rejectedEAs = await prisma.eA.count({ where: { status: "REJECTED" } });
  const pendingEAs = await prisma.eA.count({ where: { status: "PENDING" } });
  const downloads = await prisma.eADownload.count();
  const validations = await prisma.eAValidation.count();

  console.log("=== STATUS DA TABELA DE EXPERT ADVISORS (EAs) ===");
  console.log(`Total de EAs cadastrados: ${totalEAs}`);
  console.log(`  └─ Aprovados (APPROVED): ${approvedEAs}`);
  console.log(`  └─ Reprovados (REJECTED): ${rejectedEAs}`);
  console.log(`  └─ Pendentes (PENDING): ${pendingEAs}`);
  console.log(`Total de downloads registrados: ${downloads}`);
  console.log(`Total de registros de validação (EAValidation): ${validations}`);

  if (totalEAs > 0) {
    const list = await prisma.eA.findMany({
      select: { id: true, name: true, symbol: true, timeframe: true, status: true }
    });
    console.log("\nLista de EAs:");
    list.forEach(ea => {
      console.log(`- [${ea.status}] ${ea.name} (${ea.symbol} ${ea.timeframe}) - ID: ${ea.id}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

async function main() {
  const staged = await prisma.eA.findMany({
    where: { status: "STAGED" },
    select: {
      id: true,
      name: true,
      slug: true,
      symbol: true,
      timeframe: true,
      oosRetDd: true,
      profitFactor: true,
      maxDrawdown: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  console.log(`EAs em STAGED no Banco (${staged.length}):`);
  for (const ea of staged) {
    console.log(`- ${ea.name} (${ea.symbol} ${ea.timeframe}) | Ret/DD OOS: ${ea.oosRetDd?.toFixed(2) ?? "N/A"} | Criado: ${ea.createdAt.toISOString()}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

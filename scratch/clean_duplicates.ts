import { loadEnvConfig } from "@next/env";
import * as path from "path";

loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando EAs no banco de dados...");
  const eas = await prisma.eA.findMany({
    orderBy: { createdAt: "asc" }
  });
  
  console.log(`📊 Total de EAs cadastrados: ${eas.length}`);
  
  const seen = new Set<string>();
  let deletedCount = 0;
  
  for (const ea of eas) {
    // Assinatura única baseada em Ativo, Timeframe, Fator de Lucro, Drawdown e Número de Trades
    // Se esses valores baterem idênticos, é a mesma estratégia física duplicada!
    const signature = `${ea.symbol}:${ea.timeframe}:${ea.profitFactor}:${ea.maxDrawdown}:${ea.totalTrades}`;
    
    if (seen.has(signature)) {
      console.log(`❌ Removendo duplicata: ${ea.name} (ID: ${ea.id})`);
      // Apaga registros relacionados primeiro para evitar restrições de chave estrangeira
      await prisma.eAValidation.deleteMany({ where: { eaId: ea.id } });
      await prisma.eADownload.deleteMany({ where: { eaId: ea.id } });
      await prisma.job.deleteMany({ where: { eaId: ea.id } });
      
      await prisma.eA.delete({ where: { id: ea.id } });
      deletedCount++;
    } else {
      seen.add(signature);
    }
  }
  
  console.log(`\n🎉 Limpeza concluída! Duplicatas removidas: ${deletedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

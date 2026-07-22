import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { prisma } from "../lib/prisma";

async function main() {
  const eas = await prisma.eA.findMany({
    where: { status: "APPROVED" },
    select: { symbol: true, timeframe: true }
  });

  const counts: Record<string, Record<string, number>> = {};
  for (const ea of eas) {
    counts[ea.symbol] = counts[ea.symbol] || {};
    counts[ea.symbol][ea.timeframe] = (counts[ea.symbol][ea.timeframe] || 0) + 1;
  }

  console.log("=== CONTAGEM DE EAs APROVADOS POR ATIVO E TIMEFRAME ===");
  let total = 0;
  for (const [sym, tfs] of Object.entries(counts)) {
    let symTotal = 0;
    const details = Object.entries(tfs).map(([tf, c]) => {
      symTotal += c;
      total += c;
      return `${tf}: ${c}`;
    }).join(" | ");
    console.log(`${sym} (${symTotal}/30 max) -> ${details}`);
  }
  console.log(`TOTAL DE EAs APROVADOS NO BANCO: ${total}`);
}

main().finally(() => prisma.$disconnect());

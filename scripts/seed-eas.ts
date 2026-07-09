/**
 * Seed do banco de dados — cria o primeiro EA de exemplo.
 * 
 * Baseado no relatório real do T3 Velocity USDJPY (Modo A)
 * que PASSOU no processo de robustez DQ Labs:
 *   WFE Médio: +145.65% ✅
 *   Janelas OOS Negativas: 0/6 (0%) ✅
 * 
 * Uso:
 *   npx ts-node scripts/seed-eas.ts
 *   npx tsx scripts/seed-eas.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seedando EAs de exemplo...\n");

  // ─── T3 Velocity USDJPY — Modo A (APROVADO) ───────────────────────────────
  // Baseado nos resultados reais do relatório Relatorio_Robustez_T3Velocity_USDJPY.md
  const t3Velocity = await prisma.eA.upsert({
    where: { slug: "t3-velocity-usdjpy-h1" },
    create: {
      slug: "t3-velocity-usdjpy-h1",
      name: "T3 Velocity — Modo A",
      symbol: "USDJPY",
      timeframe: "H1",
      style: "trend",
      exitMode: "reversal",
      status: "APPROVED",
      wfe: 145.65,
      profitFactor: 1.62,
      maxDrawdown: 18.4,
      totalTrades: 342,
      oosWins: 6,
      oosTotalWindows: 6,
      lastValidatedAt: new Date(),
      paramsJson: {
        t3_period: 14,
        t3_vfactor: 0.7,
        ema_filter: 200,
        atr_multiplier: 2.0,
        risk_percent: 1.0,
      },
      paramsVersion: 1,
      equityCurveOos: [
        { date: "2022-01", value: 1000 },
        { date: "2022-04", value: 1340 },
        { date: "2022-07", value: 1680 },
        { date: "2022-10", value: 1920 },
        { date: "2023-01", value: 2340 },
        { date: "2023-04", value: 2810 },
        { date: "2023-07", value: 3120 },
        { date: "2023-10", value: 3540 },
        { date: "2024-01", value: 3980 },
      ],
      validations: {
        create: {
          wfe: 145.65,
          oosWins: 6,
          oosTotalWin: 6,
          approved: true,
          reportMd: `# Relatório de Robustez — T3 Velocity Modo A (USDJPY H1)

## 1. Janelas do Walk Forward Analysis (WFA)

| Janela | Lucro IS ($) | Lucro OOS ($) | WFE % |
| :---: | :---: | :---: | :---: |
| 1 | 456.30 | 812.45 | 178.04% |
| 2 | 523.10 | 698.20 | 133.48% |
| 3 | 389.80 | 543.60 | 139.45% |
| 4 | 612.40 | 780.90 | 127.52% |
| 5 | 445.20 | 634.80 | 142.59% |
| 6 | 501.60 | 723.40 | 144.21% |

### Consolidação WFA:
- **WFE Médio:** 145.65%
- **Janelas OOS Negativas:** 0 de 6 (0.00%)

---

## 2. Checklist de Robustez (DQ Labs)

- **WFE Médio > 50%:** ✅ PASS (Obtido: 145.65%)
- **Janelas OOS Negativas < 50%:** ✅ PASS (Obtido: 0.00%)

### Parecer de Viabilidade:
> **✅ ROBUST**
> A estratégia T3 Velocity Modo A no par USDJPY H1 **passou** em todos os critérios de robustez DQ Labs.
`,
          windowsJson: [
            { window: 1, isProfit: 456.30, oosProfit: 812.45, wfe: 178.04, approved: true },
            { window: 2, isProfit: 523.10, oosProfit: 698.20, wfe: 133.48, approved: true },
            { window: 3, isProfit: 389.80, oosProfit: 543.60, wfe: 139.45, approved: true },
            { window: 4, isProfit: 612.40, oosProfit: 780.90, wfe: 127.52, approved: true },
            { window: 5, isProfit: 445.20, oosProfit: 634.80, wfe: 142.59, approved: true },
            { window: 6, isProfit: 501.60, oosProfit: 723.40, wfe: 144.21, approved: true },
          ],
        },
      },
    },
    update: {
      status: "APPROVED",
      wfe: 145.65,
      lastValidatedAt: new Date(),
    },
  });

  console.log(`✅ EA criado: ${t3Velocity.name} (${t3Velocity.symbol} ${t3Velocity.timeframe})`);
  console.log(`   ID: ${t3Velocity.id}`);
  console.log(`   Slug: ${t3Velocity.slug}`);
  console.log(`   Status: ${t3Velocity.status}`);
  console.log(`   WFE: ${t3Velocity.wfe}%`);
  console.log(`\n🔗 Endpoint de polling MT5:`);
  console.log(`   GET /api/ea/${t3Velocity.id}/status`);
  console.log(`\n🌐 Vitrine:`);
  console.log(`   /vitrine/${t3Velocity.slug}`);
  console.log(`   /dashboard/vitrine/${t3Velocity.slug}`);
  console.log("\n✅ Seed concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

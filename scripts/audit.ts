import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runAudit() {
  console.log("=========================================");
  console.log("        RELATÓRIO DE AUDITORIA");
  console.log(`        Data: ${new Date().toISOString()}`);
  console.log("=========================================");

  try {
    // 1. Conexão com o Banco
    await prisma.$queryRaw`SELECT 1`;
    console.log("✔ Conexão com o banco de dados: Saudável (OK)");

    // 2. Estatísticas de Usuários
    const totalUsers = await prisma.user.count();
    const trialingUsers = await prisma.user.count({ where: { subscriptionStatus: "trialing" } });
    const activeUsers = await prisma.user.count({ where: { subscriptionStatus: "active" } });
    console.log(`✔ Total de usuários: ${totalUsers}`);
    console.log(`   └─ Trial ativos: ${trialingUsers}`);
    console.log(`   └─ Assinaturas ativas: ${activeUsers}`);

    // 3. Watchlist
    const activeWatchlists = await prisma.watchlist.count({ where: { active: true } });
    console.log(`✔ Itens de Watchlist ativos: ${activeWatchlists}`);

    // 4. Sinais e Assertividade
    const totalSignals = await prisma.signal.count();
    const pendingSignals = await prisma.signal.count({ where: { status: "PENDING" } });
    const filledSignals = await prisma.signal.count({ where: { status: "FILLED" } });
    const winSignals = await prisma.signal.count({ where: { status: "WIN" } });
    const lossSignals = await prisma.signal.count({ where: { status: "LOSS" } });
    const expiredSignals = await prisma.signal.count({ where: { status: "EXPIRED" } });

    console.log(`✔ Total de Sinais gerados: ${totalSignals}`);
    console.log(`   ├─ Pendentes (Aguardando Entrada): ${pendingSignals}`);
    console.log(`   ├─ Executando (Filled): ${filledSignals}`);
    console.log(`   ├─ Ganhos (Win): ${winSignals}`);
    console.log(`   ├─ Perdas (Loss): ${lossSignals}`);
    console.log(`   └─ Expirados: ${expiredSignals}`);

    const completedTrades = winSignals + lossSignals;
    if (completedTrades > 0) {
      const assertividade = (winSignals / completedTrades) * 100;
      console.log(`✔ Taxa de Assertividade Geral: ${assertividade.toFixed(2)}% (${winSignals}/${completedTrades})`);
    } else {
      console.log("✔ Taxa de Assertividade Geral: N/A (Nenhuma operação concluída)");
    }

    // Assertividade por operacional (SMC vs CLÁSSICO)
    const smcWins = await prisma.signal.count({ where: { mode: "SMC", status: "WIN" } });
    const smcLosses = await prisma.signal.count({ where: { mode: "SMC", status: "LOSS" } });
    const smcTotal = smcWins + smcLosses;

    const classicoWins = await prisma.signal.count({ where: { mode: "CLASSICO", status: "WIN" } });
    const classicoLosses = await prisma.signal.count({ where: { mode: "CLASSICO", status: "LOSS" } });
    const classicoTotal = classicoWins + classicoLosses;

    if (smcTotal > 0) {
      console.log(`   └─ Assertividade SMC: ${((smcWins / smcTotal) * 100).toFixed(2)}% (${smcWins}/${smcTotal})`);
    }
    if (classicoTotal > 0) {
      console.log(`   └─ Assertividade Clássica: ${((classicoWins / classicoTotal) * 100).toFixed(2)}% (${classicoWins}/${classicoTotal})`);
    }

    // 5. Verificação do Status do Site (Frontend)
    console.log("✔ Verificando status dos links do projeto:");
    const urls = [
      "https://jessedepaula.com.br",
      "https://trade-vision-ai-zaionvest-7062s-projects.vercel.app"
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const html = await res.text();
          if (html.includes("Trade Vision") && html.includes("Análise institucional")) {
            console.log(`   └─ ${url} - ONLINE e CORRETO (OK)`);
          } else {
            console.log(`   └─ ${url} - ONLINE mas CONTEÚDO INCORRETO/ANTIGO (FALHA)`);
          }
        } else {
          console.log(`   └─ ${url} - OFFLINE (Status ${res.status}) (FALHA)`);
        }
      } catch (err: any) {
        console.log(`   └─ ${url} - INDISPONÍVEL (${err.message}) (FALHA)`);
      }
    }

  } catch (error) {
    console.error("❌ ERRO DURANTE A AUDITORIA:", error);
  } finally {
    await prisma.$disconnect();
    console.log("=========================================");
  }
}

runAudit();


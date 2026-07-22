import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "jessesdepaula@gmail.com" },
    include: {
      accounts: {
        include: {
          robots: true,
          positions: true,
          monitorTrades: {
            orderBy: { closeTime: "desc" },
            take: 20
          }
        }
      },
      eaDownloads: {
        include: {
          ea: true
        }
      }
    }
  });

  if (!user) {
    console.log("Usuário não encontrado!");
    return;
  }

  console.log(`Usuário: ${user.name} (${user.email})`);
  console.log(`Total Downloads: ${user.eaDownloads.length}`);
  console.log(`Contas MT5 Conectadas: ${user.accounts.length}`);

  for (const acc of user.accounts) {
    console.log(`\nConta MT5 Login: ${acc.login} | Corretora: ${acc.broker} | Servidor: ${acc.server} | Atualizada: ${acc.updatedAt}`);
    console.log(`Posições Abertas (${acc.positions.length}):`, acc.positions);
    console.log(`Robot Metrics (${acc.robots.length}):`, acc.robots);
    console.log(`Últimos 10 Trades Fechados:`);
    for (const t of acc.monitorTrades.slice(0, 10)) {
      console.log(`- Ticket: ${t.ticket} | Símbolo: ${t.symbol} | Magic: ${t.magic} | Comment: ${t.comment} | Lucro: ${t.netProfit} | Fechado: ${t.closeTime}`);
    }
  }

  console.log(`\nDownloads do Usuário:`);
  for (const d of user.eaDownloads) {
    console.log(`- EA ID: ${d.ea.id} | Nome: ${d.ea.name} | Par: ${d.ea.symbol} ${d.ea.timeframe} | Status: ${d.ea.status}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

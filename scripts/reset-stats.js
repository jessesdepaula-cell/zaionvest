const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpeza do banco de dados...");
  
  // Deleta todos os registros de Trades
  const tradesDeleted = await prisma.trade.deleteMany({});
  console.log(`✓ ${tradesDeleted.count} trades deletados com sucesso.`);
  
  // Deleta todos os registros de Sinais
  const signalsDeleted = await prisma.signal.deleteMany({});
  console.log(`✓ ${signalsDeleted.count} sinais deletados com sucesso.`);
  
  console.log("Limpeza concluída! Assertividade zerada para novos registros.");
}

main()
  .catch((e) => {
    console.error("Erro ao limpar banco de dados:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

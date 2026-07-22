import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { prisma } from "../lib/prisma";

async function main() {
  const login = "37368151";
  console.log(`Buscando conta com login: ${login}...`);

  const accounts = await prisma.account.findMany({
    where: { login: { contains: login } }
  });

  console.log(`Encontradas ${accounts.length} contas com login ${login}:`, accounts);

  for (const acc of accounts) {
    console.log(`Deletando conta ID: ${acc.id}, Login: ${acc.login}, Corretora: ${acc.broker}...`);
    await prisma.account.delete({
      where: { id: acc.id }
    });
    console.log(`Conta ${acc.login} deletada com sucesso!`);
  }
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());

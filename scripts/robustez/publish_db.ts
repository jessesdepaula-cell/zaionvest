import { loadEnvConfig } from "@next/env";
import * as path from "path";
import * as fs from "fs";

loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface PublishRow {
  table: "EA" | "EAValidation";
  data: any;
}

async function main() {
  const jsonPath = path.join(__dirname, "to_publish.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Arquivo ${jsonPath} não encontrado.`);
    process.exit(1);
  }

  const rows: PublishRow[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`\n🌱 Carregados ${rows.length} registros para publicação.`);

  let easCreated = 0;
  let validationsCreated = 0;

  for (const row of rows) {
    if (row.table === "EA") {
      const ea = row.data;
      console.log(`- Publicando EA: ${ea.name} (${ea.symbol} ${ea.timeframe})...`);
      
      // Upsert para evitar duplicidade de slug
      await prisma.eA.upsert({
        where: { slug: ea.slug },
        create: {
          id: ea.id,
          name: ea.name,
          slug: ea.slug,
          symbol: ea.symbol,
          timeframe: ea.timeframe,
          style: ea.style,
          exitMode: ea.exitMode,
          wfe: ea.wfe,
          profitFactor: ea.profitFactor,
          maxDrawdown: ea.maxDrawdown,
          totalTrades: ea.totalTrades,
          oosWins: ea.oosWins,
          oosTotalWindows: ea.oosTotalWindows,
          oosRetDd: ea.oosRetDd,
          status: ea.status,
          fileUrl: ea.fileUrl,
          strategyDef: ea.strategyDef,
          equityCurveOos: ea.equityCurveOos,
          lastValidatedAt: new Date(ea.lastValidatedAt),
          createdAt: new Date(ea.createdAt),
          updatedAt: new Date(ea.updatedAt),
        },
        // IMPORTANTE: no update NÃO mexemos em `status`. O bulk publisher roda
        // toda rodada da mineração; se ele reescrevesse status=STAGED, um EA que
        // o dono já promoveu (APPROVED) ou rejeitou (REJECTED) voltaria pra
        // STAGED. O status é da moderação (promover/rejeitar) e da revalidação,
        // não do publish. Só o CREATE define o status inicial (STAGED).
        update: {
          name: ea.name,
          status: ea.status,
          wfe: ea.wfe,
          profitFactor: ea.profitFactor,
          maxDrawdown: ea.maxDrawdown,
          totalTrades: ea.totalTrades,
          oosWins: ea.oosWins,
          oosTotalWindows: ea.oosTotalWindows,
          oosRetDd: ea.oosRetDd,
          fileUrl: ea.fileUrl,
          strategyDef: ea.strategyDef,
          equityCurveOos: ea.equityCurveOos,
          lastValidatedAt: new Date(ea.lastValidatedAt),
          updatedAt: new Date(ea.updatedAt),
        }
      });
      easCreated++;
    } else if (row.table === "EAValidation") {
      const val = row.data;
      try {
        await prisma.eAValidation.create({
          data: {
            id: val.id,
            ea: { connect: { id: val.eaId } },
            wfe: val.wfe ?? 0.0,
            oosWins: val.oosWins ?? 0,
            oosTotalWin: val.oosTotalWin ?? 0,
            approved: val.approved ?? true,
            reportMd: val.reportMd,
            windowsJson: val.windowsJson,
            validatedAt: new Date(val.validatedAt),
          }
        });
        validationsCreated++;
      } catch (err: any) {
        console.warn(`⚠️ Não foi possível vincular EAValidation ao eaId ${val.eaId}: ${err.message}`);
      }
    }
  }

  console.log(`\n🎉 Publicação concluída!`);
  console.log(`   └─ EAs publicados/atualizados: ${easCreated}`);
  console.log(`   └─ Registros de validação inseridos: ${validationsCreated}`);

  // Opcional: deletar arquivo temporário to_publish.json
  try {
    fs.unlinkSync(jsonPath);
    console.log(`🧹 Arquivo temporário to_publish.json removido.`);
  } catch (err) {
    // ignora se não conseguir apagar
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

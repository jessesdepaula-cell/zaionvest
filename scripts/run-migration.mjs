import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = resolve(__dirname, "migrate-to-user-scoped.sql");
const sql = readFileSync(sqlPath, "utf8");

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ DIRECT_URL/DATABASE_URL ausente. Use dotenv-cli -e .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const counts = async (label) => {
  const r = await client.query(`
    SELECT 'Signal'     AS t, COUNT(*)::int AS n FROM "Signal"
    UNION ALL SELECT 'Watchlist',  COUNT(*) FROM "Watchlist"
    UNION ALL SELECT 'MarketTick', COUNT(*) FROM "MarketTick"
    UNION ALL SELECT 'User',       COUNT(*) FROM "User"
    UNION ALL SELECT 'Trade',      COUNT(*) FROM "Trade"
  `);
  console.log(`\n--- ${label} ---`);
  for (const row of r.rows) console.log(`  ${row.t.padEnd(12)} ${row.n}`);
};

try {
  await client.connect();
  console.log("✓ Conectado");

  await counts("ANTES");

  console.log("\n▶ Aplicando migração…");
  const t0 = Date.now();
  await client.query(sql);
  console.log(`✓ Migração concluída em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await counts("DEPOIS");

  console.log("\n✓ Tudo certo.");
} catch (e) {
  console.error("\n✗ Erro:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

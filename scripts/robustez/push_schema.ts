import { execSync } from "child_process";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

console.log("Pushing Prisma schema to Supabase database...");
try {
  const output = execSync("npx prisma db push --accept-data-loss", {
    env: process.env,
    encoding: "utf-8"
  });
  console.log(output);
} catch (err: any) {
  console.error("Error pushing schema:", err.message);
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.log(err.stderr);
}

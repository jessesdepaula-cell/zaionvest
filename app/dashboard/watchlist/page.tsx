import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getOrCreateUser, isOwner } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { WatchlistEditor } from "@/components/dashboard/WatchlistEditor";
import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { seedWatchlist } from "@/app/actions/watchlist";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await getOrCreateUser();
  if (!user) return null;
  // Watchlist MESTRA: só o dono gerencia os pares que geram os sinais globais.
  // Assinante comum não tem acesso (nem pela URL direta).
  if (!isOwner(user)) notFound();

  const existing = await prisma.watchlist.count({ where: { userId: user.id } });
  if (existing === 0) {
    await seedWatchlist(user.id);
  }

  const items = await prisma.watchlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-emerald-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Cotações puxadas direto do mercado (Binance para cripto, Twelve Data para forex).
          Sem instalação de robô.
        </p>
      </div>

      <WatchlistEditor
        items={items.map((it) => ({
          id: it.id,
          symbol: it.symbol,
          timeframe: it.timeframe,
          mode: it.mode,
          active: it.active,
          lastScanAt: it.lastScanAt,
        }))}
        symbols={SUPPORTED_SYMBOLS.map((s) => ({
          symbol: s.symbol,
          label: s.label,
          assetClass: s.assetClass,
        }))}
      />

      <div className="mt-6 rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">
          Símbolos suportados
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SUPPORTED_SYMBOLS.map((s) => (
            <div
              key={s.symbol}
              className="flex items-center justify-between rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02] px-3 py-2 text-sm"
            >
              <div>
                <span className="num text-offwhite">{s.symbol}</span>
                <span className="ml-2 text-xs text-zinc-500">{s.label}</span>
              </div>
              <span
                className={
                  s.assetClass === "crypto"
                    ? "rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-300"
                    : "rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300"
                }
              >
                {s.assetClass}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

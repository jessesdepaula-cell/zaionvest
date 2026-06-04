import { BookOpen } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { TradeFormButton } from "@/components/dashboard/TradeForm";
import { TradeRow } from "@/components/dashboard/TradeRow";

export const dynamic = "force-dynamic";

export default async function DiarioPage() {
  const user = await getOrCreateUser();
  if (!user) return null;

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    orderBy: { openedAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Diário de trades</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Catalogue cada operação. Acompanhe performance por modo (Clássico × SMC).
          </p>
        </div>
        <TradeFormButton />
      </div>

      {trades.length === 0 ? (
        <div className="glass grid min-h-[280px] place-items-center rounded-xl p-10 text-center">
          <div>
            <BookOpen className="mx-auto h-5 w-5 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">Nenhum trade catalogado ainda.</p>
            <p className="mt-1 text-xs text-zinc-500">
              Use o botão acima ou clique em <span className="text-zinc-300">Registrar trade</span> ao terminar uma análise.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {trades.map((t) => (
            <TradeRow
              key={t.id}
              trade={{
                ...t,
                openedAt: new Date(t.openedAt),
                closedAt: t.closedAt ? new Date(t.closedAt) : null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

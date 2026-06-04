import { Download, Plus, Zap } from "lucide-react";
import { getOrCreateUser } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { createMt5Account } from "@/app/actions/mt5";
import { Mt5AccountCard } from "@/components/dashboard/Mt5AccountCard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Mt5Page() {
  const user = await getOrCreateUser();
  if (!user) return null;

  const accounts = await prisma.mT5Account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const accountIds = accounts.map((a) => a.id);
  const orders = accountIds.length
    ? await prisma.mT5Order.findMany({
        where: { accountId: { in: accountIds } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MetaTrader 5</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Envie ordens da análise direto para sua conta MT5 via Expert Advisor.
          </p>
        </div>
        <form action={createMt5Account}>
          <input type="hidden" name="label" value="Conta MT5" />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-xs font-medium text-charcoal transition hover:bg-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Conectar nova conta
          </button>
        </form>
      </div>

      {/* Como funciona */}
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <Step n={1} title="Crie uma conta">
          Gera um token único pra sua conta MT5. Cada token = um terminal MT5.
        </Step>
        <Step n={2} title="Instale o EA">
          Baixa o <span className="num text-zinc-200">TradeVisionBridge.mq5</span>, cola na pasta <span className="num">MQL5/Experts</span> e arrasta pro gráfico.
        </Step>
        <Step n={3} title="Envie ordens">
          Na análise, clica em <span className="text-emerald-400">Enviar para MT5</span>. O EA executa em ≤3s.
        </Step>
      </section>

      {/* Download EA */}
      <section className="mb-8">
        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.03]">
              <Zap className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-offwhite">TradeVisionBridge.mq5</p>
              <p className="num text-[11px] text-zinc-500">
                Expert Advisor MQL5 · v1.0 · polling 3s
              </p>
            </div>
          </div>
          <a
            href="/mt5/TradeVisionBridge.mq5"
            download
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-offwhite hover:bg-white/[0.08]"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar EA
          </a>
        </div>
        <details className="mt-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-zinc-300">
          <summary className="cursor-pointer text-zinc-300 hover:text-offwhite">Instruções de instalação</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-400">
            <li>No MT5 abra <span className="num text-zinc-200">Arquivo → Abrir Pasta de Dados</span>.</li>
            <li>Cole o arquivo em <span className="num text-zinc-200">MQL5/Experts/</span>.</li>
            <li>No MT5 abra <span className="num text-zinc-200">Ferramentas → Opções → Expert Advisors</span> e marque <span className="num text-zinc-200">Permitir WebRequest para os endereços</span>. Adicione: <span className="num text-emerald-300">https://tradevision-app.vercel.app</span></li>
            <li>Reinicie o MT5. No Navegador, arraste <span className="num text-zinc-200">TradeVisionBridge</span> para qualquer gráfico.</li>
            <li>Na janela do EA, cole seu <span className="num text-zinc-200">ApiToken</span> (botão copiar acima) e clique OK.</li>
            <li>Ative o botão <span className="num text-zinc-200">AutoTrading</span> na barra superior.</li>
            <li>O selo "EA online" aparece no card quando a conexão estabiliza (até 30s).</li>
          </ol>
        </details>
      </section>

      {/* Contas */}
      {accounts.length === 0 ? (
        <div className="glass grid min-h-[180px] place-items-center rounded-xl p-8 text-center">
          <div>
            <Zap className="mx-auto h-5 w-5 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              Nenhuma conta MT5 conectada ainda.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Clique em <span className="text-zinc-300">Conectar nova conta</span> acima para começar.
            </p>
          </div>
        </div>
      ) : (
        <section className="mb-8 grid gap-3">
          {accounts.map((a) => (
            <Mt5AccountCard key={a.id} account={a} />
          ))}
        </section>
      )}

      {/* Histórico de ordens */}
      {orders.length > 0 && (
        <section>
          <h2 className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">
            Últimas ordens enviadas
          </h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="glass grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="num text-sm text-offwhite">
                    {o.symbol}{" "}
                    <span
                      className={cn(
                        "ml-1 rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
                        o.side === "BUY"
                          ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
                          : "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
                      )}
                    >
                      {o.side === "BUY" ? "Compra" : "Venda"}
                    </span>
                  </p>
                  <p className="num mt-0.5 text-[11px] text-zinc-500">
                    {o.entryType} · vol {o.volume}
                    {o.entryPrice ? ` · entrada ${o.entryPrice}` : ""}
                    {o.stopLoss ? ` · SL ${o.stopLoss}` : ""}
                    {o.takeProfit ? ` · TP ${o.takeProfit}` : ""}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Criada</p>
                  <p className="num text-[11px] text-zinc-300">
                    {new Date(o.createdAt).toLocaleTimeString("pt-BR")}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">Ticket</p>
                  <p className="num text-[11px] text-zinc-300">
                    {o.mt5Ticket ? `#${o.mt5Ticket}` : "—"}
                  </p>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span className="num grid h-6 w-6 place-items-center rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] text-[11px] text-emerald-300">
          {n}
        </span>
        <span className="text-sm font-medium text-offwhite">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{children}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "Pendente", cls: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300" },
    SENT: { label: "Enviada", cls: "border-blue-500/30 bg-blue-500/[0.08] text-blue-300" },
    FILLED: { label: "Executada", cls: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300" },
    REJECTED: { label: "Rejeitada", cls: "border-rose-500/30 bg-rose-500/[0.08] text-rose-300" },
    EXPIRED: { label: "Expirada", cls: "border-white/10 bg-white/[0.03] text-zinc-400" },
  };
  const m = meta[status] ?? meta.PENDING;
  return (
    <span className={cn("rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest", m.cls)}>
      {m.label}
    </span>
  );
}

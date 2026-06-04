import { cn } from "@/lib/utils";

type Account = {
  id: string;
  label: string | null;
  accountNumber: bigint | null;
  accountName: string | null;
  accountServer: string | null;
  accountCompany: string | null;
  accountCurrency: string | null;
  leverage: number | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  freeMargin: number | null;
  marginLevel: number | null;
  pingMs: number | null;
  connectedAt: Date | null;
  lastSeenAt: Date | null;
};

type Tick = { symbol: string; bid: number; ask: number; spread: number; updatedAt: Date };

export function Mt5LiveAccount({
  account,
  ticks,
}: {
  account: Account;
  ticks: Tick[];
}) {
  const online =
    account.lastSeenAt && Date.now() - new Date(account.lastSeenAt).getTime() < 60_000;
  const uptime = account.connectedAt
    ? humanDuration(Date.now() - new Date(account.connectedAt).getTime())
    : "—";

  return (
    <div className="glass overflow-hidden rounded-xl">
      {/* Header */}
      <div className="grid grid-cols-1 gap-4 border-b border-white/5 p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-offwhite">
              {account.label ?? "Conta MT5"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                online
                  ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  online ? "animate-pulse bg-emerald-400" : "bg-zinc-500",
                )}
              />
              {online ? "Conectado" : "Desconectado"}
            </span>
          </div>
          <p className="num mt-1 text-[11px] text-zinc-500">
            {account.accountCompany ?? "—"}
            {account.accountServer && (
              <>
                {" · "}
                Servidor <span className="text-zinc-300">{account.accountServer}</span>
              </>
            )}
            {account.accountName && (
              <>
                {" · "}
                {account.accountName}
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
          <Mini label="Conta" value={account.accountNumber ? `#${account.accountNumber}` : "—"} />
          <Mini label="Alavanc." value={account.leverage ? `1:${account.leverage}` : "—"} />
          <Mini
            label="Ping"
            value={account.pingMs !== null ? `${account.pingMs}ms` : "—"}
            tone={account.pingMs && account.pingMs < 200 ? "emerald" : account.pingMs && account.pingMs < 600 ? "amber" : "muted"}
          />
        </div>
      </div>

      {/* Equity strip */}
      <div className="grid grid-cols-2 gap-4 border-b border-white/5 p-5 sm:grid-cols-4">
        <Big
          label="Saldo"
          value={fmtMoney(account.balance, account.accountCurrency)}
        />
        <Big
          label="Equity"
          value={fmtMoney(account.equity, account.accountCurrency)}
          tone={
            account.equity !== null && account.balance !== null
              ? account.equity >= account.balance
                ? "emerald"
                : "rose"
              : "default"
          }
        />
        <Big
          label="Margem usada"
          value={fmtMoney(account.margin, account.accountCurrency)}
        />
        <Big
          label="Margem livre"
          value={fmtMoney(account.freeMargin, account.accountCurrency)}
          tone="default"
        />
      </div>

      {/* Margin level + uptime */}
      <div className="grid grid-cols-2 gap-4 border-b border-white/5 p-5 sm:grid-cols-3">
        <Mini
          label="Nível margem"
          value={account.marginLevel !== null ? `${account.marginLevel.toFixed(1)}%` : "—"}
          tone={
            account.marginLevel !== null
              ? account.marginLevel >= 500
                ? "emerald"
                : account.marginLevel >= 200
                  ? "amber"
                  : "rose"
              : "muted"
          }
        />
        <Mini label="Permanência" value={uptime} />
        <Mini
          label="Último ping"
          value={
            account.lastSeenAt
              ? new Date(account.lastSeenAt).toLocaleTimeString("pt-BR")
              : "—"
          }
        />
      </div>

      {/* Spreads / cotações */}
      {ticks.length > 0 && (
        <div className="p-5">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">
            Cotações ao vivo
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ticks.map((t) => (
              <div
                key={t.symbol}
                className="rounded-md border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                  <span className="num text-zinc-300">{t.symbol}</span>
                  <span className="num">spread {fmtSpread(t.spread, t.symbol)}</span>
                </div>
                <div className="num mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-zinc-500">Bid</div>
                    <div className="text-rose-300">{fmtPrice(t.bid, t.symbol)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-widest text-zinc-500">Ask</div>
                    <div className="text-emerald-300">{fmtPrice(t.ask, t.symbol)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "rose" | "amber" | "muted";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div
        className={cn(
          "num mt-0.5 text-sm font-medium",
          tone === "emerald" && "text-emerald-400",
          tone === "rose" && "text-rose-400",
          tone === "amber" && "text-amber-400",
          tone === "muted" && "text-zinc-400",
          tone === "default" && "text-offwhite",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Big({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "rose";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div
        className={cn(
          "num mt-1 text-2xl font-medium tabular-nums",
          tone === "emerald" && "text-emerald-400",
          tone === "rose" && "text-rose-400",
          tone === "default" && "text-offwhite",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function fmtMoney(v: number | null, currency: string | null): string {
  if (v === null) return "—";
  try {
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${currency ?? ""} ${v.toFixed(2)}`;
  }
}

function fmtPrice(v: number, symbol: string): string {
  const isXau = symbol.includes("XAU") || symbol.includes("GOLD");
  const isJpy = symbol.includes("JPY");
  const digits = isXau ? 2 : isJpy ? 3 : 5;
  return v.toFixed(digits);
}

function fmtSpread(spread: number, symbol: string): string {
  const isJpy = symbol.includes("JPY");
  const isXau = symbol.includes("XAU");
  if (isXau) return `${(spread * 100).toFixed(0)} pts`;
  const pip = isJpy ? 0.01 : 0.0001;
  return `${(spread / pip).toFixed(1)} pips`;
}

function humanDuration(ms: number): string {
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

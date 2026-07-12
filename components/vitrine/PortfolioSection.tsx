import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";

interface EAItem {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  timeframe: string;
  wfe: number | null;
}

interface PortfolioView {
  profile: string;
  label: string;
  ddTolerated: number;
  eas: EAItem[];
}

const ACCENT: Record<string, string> = {
  conservador: "#22c55e",
  moderado: "#eab308",
  agressivo: "#2563EB",
};

export function PortfolioSection({ portfolios }: { portfolios: PortfolioView[] }) {
  const hasAny = portfolios.some((p) => p.eas.length > 0);
  if (!hasAny) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Portfólios prontos
        </h2>
        <span className="text-[11px] text-zinc-600">
          cestos descorrelacionados por perfil de risco
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((p) => {
          const accent = ACCENT[p.profile] ?? "#2563EB";
          return (
            <div
              key={p.profile}
              className="rounded-2xl border border-[#f5f5f5]/10 bg-[#0A0A0A] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-[#F5F5F5]">{p.label}</span>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{ color: accent, backgroundColor: `${accent}18` }}
                >
                  DD até {p.ddTolerated}%
                </span>
              </div>

              <ul className="space-y-2 mb-4">
                {p.eas.map((ea) => (
                  <li
                    key={ea.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <Link
                      href="/sign-up"
                      className="text-zinc-300 hover:text-white transition truncate"
                    >
                      {ea.name}
                    </Link>
                    <span className="text-zinc-600 shrink-0 ml-2">
                      {ea.symbol} {ea.timeframe}
                    </span>
                  </li>
                ))}
                {p.eas.length === 0 && (
                  <li className="text-[11px] text-zinc-600">
                    Sem estratégias suficientes ainda.
                  </li>
                )}
              </ul>

              <div className="flex items-center justify-between border-t border-[#f5f5f5]/5 pt-3">
                <span className="text-[11px] text-zinc-600">
                  {p.eas.length} {p.eas.length === 1 ? "estratégia" : "estratégias"}
                </span>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: accent }}
                >
                  Baixar portfólio <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

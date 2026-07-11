import { Map, CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Roadmap — ZaionVest" };

const COLS = [
  {
    key: "done",
    title: "Entregue",
    icon: CheckCircle2,
    cls: "border-emerald-500/30 text-emerald-300",
    items: [
      "Vitrine de robôs validados",
      "Kill-switch remoto",
      "Revalidação mensal automática",
      "Drawdown real e transparente",
      "Meus Downloads com status de revalidação",
    ],
  },
  {
    key: "doing",
    title: "Em desenvolvimento",
    icon: Loader2,
    cls: "border-[#2563EB]/30 text-[#2563EB]",
    items: [
      "Academia — tutoriais em vídeo",
      "Notificações automáticas de revalidação",
      "Mais robôs e ativos na vitrine",
    ],
  },
  {
    key: "next",
    title: "Planejado",
    icon: Circle,
    cls: "border-zinc-500/30 text-zinc-400",
    items: [
      "Portfólios prontos com 1 clique",
      "Relatórios de performance da sua conta",
      "App mobile",
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Map className="h-6 w-6 text-[#2563EB]" />
          Roadmap
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          O que já entregamos e o que vem por aí. Tem uma ideia? Fale com a gente no Suporte.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="rounded-2xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-5">
              <div className={cn("mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest", c.cls)}>
                <Icon className="h-3.5 w-3.5" />
                {c.title}
              </div>
              <ul className="space-y-2.5">
                {c.items.map((it, i) => (
                  <li key={i} className="rounded-lg border border-[#f5f5f5]/[0.06] bg-[#f5f5f5]/[0.02] px-3 py-2 text-xs text-zinc-300">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

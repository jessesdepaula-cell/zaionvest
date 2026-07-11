import { Bell, RefreshCw, Sparkles, Megaphone } from "lucide-react";

export const metadata = { title: "Notificações — ZaionVest" };

export default function NotificacoesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bell className="h-6 w-6 text-[#2563EB]" />
          Notificações
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Avisos importantes sobre seus robôs e a plataforma aparecem aqui.
        </p>
      </div>

      {/* Estado vazio (ainda sem notificações). */}
      <div className="rounded-2xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-10 text-center">
        <Bell className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-4 text-sm text-zinc-400">Você está em dia — nenhuma notificação no momento.</p>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">O que você vai receber aqui</p>
        <div className="space-y-2">
          {[
            { icon: RefreshCw, t: "Revalidação de um robô que você baixou", d: "Se um robô for reprovado no ciclo mensal, avisamos aqui (e o kill-switch o desliga na sua conta)." },
            { icon: Sparkles, t: "Novos robôs na vitrine", d: "Quando um robô novo é aprovado e publicado." },
            { icon: Megaphone, t: "Comunicados da plataforma", d: "Manutenções, novidades e mudanças importantes." },
          ].map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.015] p-4">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02]">
                  <Icon className="h-4 w-4 text-zinc-500" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-offwhite">{n.t}</h2>
                  <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">{n.d}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

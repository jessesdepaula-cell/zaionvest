import { cn } from "@/lib/utils";

/**
 * Bolinha "?" com tooltip ao passar o mouse. Puro CSS (group-hover) — funciona
 * em componentes de servidor e cliente. Usada ao lado de nomenclaturas para o
 * usuário entender o sistema sem sair da tela.
 */
export function InfoTip({
  text,
  align = "left",
}: {
  text: string;
  align?: "left" | "right";
}) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <span
        className="flex h-3.5 w-3.5 cursor-help select-none items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-[9px] font-bold leading-none text-zinc-400 transition group-hover/tip:border-emerald-400/50 group-hover/tip:text-emerald-300"
        aria-label="Ajuda"
      >
        ?
      </span>
      <span
        className={cn(
          "pointer-events-none invisible absolute top-full z-50 mt-1.5 w-64 rounded-lg border border-white/10 bg-[#101014] p-2.5 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-zinc-300 shadow-2xl group-hover/tip:visible",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {text}
      </span>
    </span>
  );
}

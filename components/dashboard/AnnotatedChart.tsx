"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type Alvo = { nivel?: number; preco?: string; rr?: string };

export type AnnotationData = {
  precoTopo: number;
  precoBase: number;
  entrada?: number;
  stop?: number;
  alvos: { nivel: number; preco: number; rr?: string; recomendado?: boolean }[];
};

export function parsePrice(s?: string | null): number | null {
  if (!s || typeof s !== "string") return null;
  // tira tudo que não for número, ponto, vírgula ou hífen
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "");
  const normalized = cleaned.replace(",", ".");
  const n = parseFloat(normalized);
  return isFinite(n) ? n : null;
}

export function buildAnnotationData(result: {
  analise?: {
    entrada?: { preco?: string };
    stop_loss?: { preco?: string };
    alvos?: Alvo[];
    alvo_recomendado?: number;
  };
  escala_visivel?: { preco_topo?: string; preco_base?: string };
}): AnnotationData | null {
  const a = result.analise ?? {};
  const escala = result.escala_visivel ?? {};

  let topo = parsePrice(escala.preco_topo);
  let base = parsePrice(escala.preco_base);

  const entrada = parsePrice(a.entrada?.preco);
  const stop = parsePrice(a.stop_loss?.preco);
  const alvos = (a.alvos ?? [])
    .map((al) => ({
      nivel: Number(al.nivel),
      preco: parsePrice(al.preco),
      rr: al.rr,
      recomendado: a.alvo_recomendado === Number(al.nivel),
    }))
    .filter((al) => al.preco !== null)
    .map((al) => ({ ...al, preco: al.preco as number }));

  // fallback: deduz escala dos preços do plano
  if (topo === null || base === null) {
    const pts = [entrada, stop, ...alvos.map((a) => a.preco)].filter(
      (p): p is number => p !== null,
    );
    if (pts.length < 2) return null;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const pad = (max - min) * 0.2 || max * 0.001;
    topo = max + pad;
    base = min - pad;
  }

  if (topo <= base) return null;

  return { precoTopo: topo, precoBase: base, entrada: entrada ?? undefined, stop: stop ?? undefined, alvos };
}

function yPct(price: number, topo: number, base: number): number {
  // y=0 = topo, y=100 = base
  const range = topo - base;
  return ((topo - price) / range) * 100;
}

export function AnnotatedChart({
  src,
  data,
  alt,
}: {
  src: string;
  data: AnnotationData | null;
  alt: string;
}) {
  if (!data) {
    return (
      <Image
        src={src}
        alt={alt}
        width={1400}
        height={800}
        className="w-full rounded-md border border-[#f0ddb0]/10 object-contain"
        unoptimized
      />
    );
  }

  const { precoTopo, precoBase, entrada, stop, alvos } = data;

  const lines: {
    y: number;
    color: "emerald" | "rose" | "amber" | "emerald-bright";
    label: string;
    price: number;
  }[] = [];

  if (entrada !== undefined) {
    lines.push({ y: yPct(entrada, precoTopo, precoBase), color: "emerald", label: "ENTRADA", price: entrada });
  }
  if (stop !== undefined) {
    lines.push({ y: yPct(stop, precoTopo, precoBase), color: "rose", label: "STOP", price: stop });
  }
  alvos.forEach((al) => {
    lines.push({
      y: yPct(al.preco, precoTopo, precoBase),
      color: al.recomendado ? "emerald-bright" : "amber",
      label: `ALVO ${al.nivel}${al.recomendado ? " ★" : ""}`,
      price: al.preco,
    });
  });

  return (
    <div className="relative w-full">
      <Image
        src={src}
        alt={alt}
        width={1400}
        height={800}
        className="w-full rounded-md border border-[#f0ddb0]/10 object-contain"
        unoptimized
      />
      <div className="pointer-events-none absolute inset-0">
        {lines.map((l, i) => {
          // ignora linhas fora da área visível
          if (l.y < -2 || l.y > 102) return null;
          const colors = colorMap[l.color];
          return (
            <div key={i}>
              <div
                style={{ top: `${l.y}%` }}
                className={cn(
                  "absolute left-0 right-0 h-px border-t border-dashed",
                  colors.border,
                )}
              />
              <div
                style={{ top: `${l.y}%` }}
                className={cn(
                  "absolute -translate-y-1/2 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide shadow-md",
                  colors.bg,
                  colors.text,
                  i % 2 === 0 ? "left-2" : "right-2"
                )}
                // alterna lado para não sobrepor: pares à direita, ímpares à esquerda
              >
                {l.label} · {formatPrice(l.price)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatPrice(n: number): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  let digits = 2;
  if (abs < 0.01) digits = 6;
  else if (abs < 1) digits = 5;
  else if (abs < 100) digits = 4;
  else if (abs < 10000) digits = 2;
  else digits = 0;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const colorMap = {
  emerald: {
    border: "border-emerald-500/80",
    bg: "bg-emerald-500/90",
    text: "text-charcoal",
  },
  "emerald-bright": {
    border: "border-emerald-400",
    bg: "bg-emerald-400",
    text: "text-charcoal",
  },
  rose: {
    border: "border-rose-500/80",
    bg: "bg-rose-500/90",
    text: "text-offwhite",
  },
  amber: {
    border: "border-amber-500/70",
    bg: "bg-amber-500/90",
    text: "text-charcoal",
  },
} as const;

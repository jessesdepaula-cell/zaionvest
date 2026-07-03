"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * AutoRefresh:
 * 1. A cada 30s: reavalia sinais abertos (/api/signals/track) e atualiza a página.
 * 2. Dispara scan individualizado de cada ativo da watchlist (POST /api/scan/run)
 *    enquanto a aba está aberta — SMC a cada 5 min (determinístico, sem custo),
 *    CLÁSSICO a cada 15 min (usa IA; respeita limites de taxa).
 */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastScanRef = useRef<number>(0);
  const isScanningRef = useRef<boolean>(false);

  useEffect(() => {
    // A cada 30s: (1) avalia os sinais abertos contra as velas mais recentes
    // (entrada tocada? alvo/stop atingido?) e (2) atualiza os dados da página.
    // Assim o status Aguardando → Em execução → Ganho/Perda acompanha o mercado
    // em quase tempo real, sem esperar o próximo scan de 15 minutos.
    async function trackAndRefresh() {
      try {
        await fetch("/api/signals/track", { method: "POST" });
      } catch {
        // silencioso: tracking é best-effort; o refresh acontece mesmo assim
      }
      router.refresh();
    }
    trackAndRefresh();
    const refreshId = setInterval(trackAndRefresh, intervalMs);

    // Intervalos de scan POR MODO:
    // - SMC: motor determinístico (sem custo de IA) → escaneia a cada 5 min,
    //   detectando o Order Block bem antes de o preço chegar (antecipação real).
    // - CLÁSSICO: ainda usa IA → mantém 15 min para respeitar limites de taxa.
    const SCAN_INTERVAL_SMC = 5 * 60 * 1000;
    const SCAN_INTERVAL_CLASSICO = 15 * 60 * 1000;

    async function triggerScan(modes: Array<"SMC" | "CLASSICO">) {
      if (isScanningRef.current || modes.length === 0) return;
      isScanningRef.current = true;

      try {
        // 1. Obter a lista de itens ativos da watchlist
        const listRes = await fetch("/api/scan/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listOnly: true }),
        });

        if (!listRes.ok) throw new Error("Falha ao listar watchlist");
        const { items } = (await listRes.json()) as {
          items: Array<{ id: string; symbol: string; mode: string }>;
        };

        const due = (items ?? []).filter((it) =>
          modes.includes((it.mode === "SMC" ? "SMC" : "CLASSICO") as "SMC" | "CLASSICO"),
        );
        if (due.length === 0) return;

        // 2. Escanear cada item individualmente em sequência com intervalo de 1s
        for (let i = 0; i < due.length; i++) {
          const item = due[i];
          try {
            await fetch("/api/scan/run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ watchlistId: item.id }),
            });
            // Atualiza a interface a cada item escaneado para feedback imediato
            router.refresh();
          } catch (itemErr) {
            console.error(`Erro ao escanear ${item.symbol}:`, itemErr);
          }

          // Aguarda 1 segundo antes de disparar o próximo ativo para respeitar limites de taxa (RPM)
          if (i < due.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        const nowTime = Date.now().toString();
        for (const m of modes) localStorage.setItem(`tv:lastScanTime:${m}`, nowTime);
      } catch (err) {
        console.error("Erro no fluxo do scanner automático:", err);
      } finally {
        isScanningRef.current = false;
      }
    }

    function dueModes(): Array<"SMC" | "CLASSICO"> {
      const now = Date.now();
      const out: Array<"SMC" | "CLASSICO"> = [];
      const lastSmc = parseInt(localStorage.getItem("tv:lastScanTime:SMC") ?? "0", 10);
      const lastCla = parseInt(localStorage.getItem("tv:lastScanTime:CLASSICO") ?? "0", 10);
      if (now - lastSmc > SCAN_INTERVAL_SMC) out.push("SMC");
      if (now - lastCla > SCAN_INTERVAL_CLASSICO) out.push("CLASSICO");
      return out;
    }

    // Primeiro disparo na montagem (só os modos vencidos) + verificação a cada 60s
    triggerScan(dueModes());
    const scanId = setInterval(() => triggerScan(dueModes()), 60 * 1000);

    return () => {
      clearInterval(refreshId);
      clearInterval(scanId);
    };
  }, [router, intervalMs]);

  return null;
}

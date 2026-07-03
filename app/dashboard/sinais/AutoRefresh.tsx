"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * AutoRefresh:
 * 1. Atualiza os dados da página (router.refresh) a cada 30s
 * 2. Dispara um scan individualizado de cada ativo da watchlist (POST /api/scan/run)
 *    a cada 15 minutos enquanto o usuário está com a aba aberta. Isso evita
 *    timeouts de 10s da Vercel Hobby e conflitos de limite de taxa (429).
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

    // Scan automático a cada 15 minutos
    const SCAN_INTERVAL = 15 * 60 * 1000; // 15 min

    async function triggerScan() {
      if (isScanningRef.current) return;
      isScanningRef.current = true;

      try {
        // 1. Obter a lista de itens ativos da watchlist
        const listRes = await fetch("/api/scan/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listOnly: true }),
        });

        if (!listRes.ok) throw new Error("Falha ao listar watchlist");
        const { items } = (await listRes.json()) as { items: Array<{ id: string; symbol: string }> };

        if (!items || items.length === 0) {
          isScanningRef.current = false;
          return;
        }

        // 2. Escanear cada item individualmente em sequência com intervalo de 1s
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
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
          if (i < items.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        const nowTime = Date.now();
        localStorage.setItem("tv:lastScanTime", nowTime.toString());
      } catch (err) {
        console.error("Erro no fluxo do scanner automático:", err);
      } finally {
        isScanningRef.current = false;
      }
    }

    // Dispara o primeiro scan na montagem do componente
    // (apenas se já passou mais de 15 min desde o último scan registrado)
    const storedLastScan = localStorage.getItem("tv:lastScanTime");
    const lastScanTime = storedLastScan ? parseInt(storedLastScan, 10) : 0;
    const now = Date.now();

    if (now - lastScanTime > SCAN_INTERVAL) {
      triggerScan();
    }

    // Scan recorrente a cada 15 min
    const scanId = setInterval(triggerScan, SCAN_INTERVAL);

    return () => {
      clearInterval(refreshId);
      clearInterval(scanId);
    };
  }, [router, intervalMs]);

  return null;
}

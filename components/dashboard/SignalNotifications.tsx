"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SignalLite = {
  id: string;
  symbol: string;
  mode: string;
  direction: string | null;
  probability: number | null;
  confidence: string | null;
  hasSetup: boolean;
  status: string;
  scannedAt: string;
};

type NotificationPerm = "default" | "granted" | "denied" | "unsupported";

const SEEN_KEY = "tv_last_seen_signal_ids";
const ENABLED_KEY = "tv_notifications_enabled";
const MIN_PROB_KEY = "tv_min_probability";

export function SignalNotifications({ signals }: { signals: SignalLite[] }) {
  const [perm, setPerm] = useState<NotificationPerm>("default");
  const [enabled, setEnabled] = useState(true);
  const [minProb, setMinProb] = useState(65);
  const [lastNotified, setLastNotified] = useState<SignalLite | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const initRef = useRef(false);

  // setup inicial
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPerm("unsupported");
    } else {
      setPerm(Notification.permission as NotificationPerm);
    }
    const en = localStorage.getItem(ENABLED_KEY);
    if (en === "false") setEnabled(false);
    const mp = localStorage.getItem(MIN_PROB_KEY);
    if (mp) {
      const n = parseInt(mp, 10);
      if (isFinite(n)) setMinProb(n);
    }
  }, []);

  // observa sinais novos
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!initRef.current) {
      // Primeira renderização: marca tudo como visto (sem disparar nada)
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) {
        try {
          const arr = JSON.parse(raw) as string[];
          arr.forEach((id) => seenRef.current.add(id));
        } catch {}
      }
      signals.forEach((s) => seenRef.current.add(s.id));
      persist();
      initRef.current = true;
      return;
    }

    if (!enabled) {
      signals.forEach((s) => seenRef.current.add(s.id));
      persist();
      return;
    }

    // detecta novos sinais qualificados
    const novos = signals.filter(
      (s) =>
        !seenRef.current.has(s.id) &&
        s.hasSetup &&
        s.status === "PENDING" &&
        s.probability !== null &&
        s.probability >= minProb,
    );

    novos.forEach((s) => seenRef.current.add(s.id));
    signals.forEach((s) => seenRef.current.add(s.id));
    persist();

    if (novos.length > 0) {
      novos.forEach((s) => fireNotification(s));
      setLastNotified(novos[novos.length - 1]);
      setTimeout(() => setLastNotified(null), 6000);
    }
  }, [signals, enabled, minProb]);

  function persist() {
    if (typeof window === "undefined") return;
    const list = Array.from(seenRef.current).slice(-400);
    localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  }

  async function requestPerm() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      alert("Notificações não são suportadas neste navegador.");
      return;
    }
    try {
      const p = await new Promise<string>((resolve) => {
        const res = Notification.requestPermission(resolve);
        if (res && typeof res.then === "function") {
          res.then(resolve);
        }
      });
      setPerm(p as NotificationPerm);
      if (p === "denied") {
        alert("As notificações foram bloqueadas no navegador. Para ativá-las, clique no ícone de configurações/cadeado na barra de endereços do seu navegador e ative a permissão de Notificações.");
      }
    } catch (e) {
      Notification.requestPermission((p) => {
        setPerm(p as NotificationPerm);
        if (p === "denied") {
          alert("As notificações foram bloqueadas no navegador. Ative-as nas configurações do site na barra de endereços.");
        }
      });
    }
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(ENABLED_KEY, String(next));
  }

  function changeMinProb(v: number) {
    setMinProb(v);
    localStorage.setItem(MIN_PROB_KEY, String(v));
  }

  function testNotification() {
    const sample: SignalLite = {
      id: "test-" + Date.now(),
      symbol: "EURUSD",
      mode: "SMC",
      direction: "COMPRA_FORTE",
      probability: 75,
      confidence: "ALTA",
      hasSetup: true,
      status: "PENDING",
      scannedAt: new Date().toISOString(),
    };
    fireNotification(sample);
    setLastNotified(sample);
    setTimeout(() => setLastNotified(null), 4000);
  }

  const canEnable = perm === "default";
  const granted = perm === "granted";

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          "grid h-8 w-8 place-items-center rounded-md border",
          granted && enabled
            ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400"
            : "border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.03] text-zinc-500",
        )}>
          {granted && enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-sm text-offwhite">
            {perm === "unsupported"
              ? "Notificações não suportadas neste navegador"
              : perm === "denied"
                ? "Notificações bloqueadas no navegador"
                : granted && enabled
                  ? "Notificações ativas"
                  : granted && !enabled
                    ? "Notificações silenciadas"
                    : "Receba alerta de sinal forte"}
          </p>
          <p className="text-[11px] text-zinc-500">
            {granted
              ? `Toca som + abre notificação quando aparece sinal acima de ${minProb}%`
              : "Permita pra receber notificação assim que um setup forte aparecer"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {granted && (
          <label className="flex items-center gap-2 rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.02] px-2 py-1.5 text-[10px] uppercase tracking-widest text-zinc-400">
            Prob. mínima
            <select
              value={minProb}
              onChange={(e) => changeMinProb(parseInt(e.target.value, 10))}
              className="num rounded bg-charcoal px-1.5 py-0.5 text-xs text-emerald-300 outline-none"
            >
              <option value={50}>50%</option>
              <option value={60}>60%</option>
              <option value={65}>65%</option>
              <option value={70}>70%</option>
              <option value={75}>75%</option>
              <option value={80}>80%</option>
            </select>
          </label>
        )}

        {granted && (
          <button
            onClick={testNotification}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.04] px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-[#f5f5f5]/[0.08]"
          >
            <Volume2 className="h-3 w-3" />
            Testar
          </button>
        )}

        {granted && (
          <button
            onClick={toggleEnabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] uppercase tracking-widest transition",
              enabled
                ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.14]"
                : "border-[#f5f5f5]/10 bg-[#f5f5f5]/[0.04] text-zinc-400 hover:text-offwhite",
            )}
          >
            {enabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
            {enabled ? "Ativas" : "Silenciadas"}
          </button>
        )}

        {canEnable && (
          <button
            onClick={requestPerm}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-emerald-400"
          >
            <Bell className="h-3.5 w-3.5" />
            Ativar notificações
          </button>
        )}
      </div>

      {/* Toast in-page para sinal novo (fallback ou complemento) */}
      {lastNotified && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-emerald-500/40 bg-charcoal/95 p-4 shadow-glow backdrop-blur-md">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Novo sinal
          </div>
          <p className="num mt-1 text-sm font-medium text-offwhite">
            {lastNotified.symbol} ·{" "}
            <span
              className={cn(
                lastNotified.direction?.startsWith("VENDA")
                  ? "text-rose-300"
                  : "text-emerald-300",
              )}
            >
              {directionText(lastNotified.direction)}
            </span>
          </p>
          <p className="num mt-0.5 text-xs text-zinc-400">
            {lastNotified.mode} · {lastNotified.probability}% prob ·{" "}
            {lastNotified.confidence}
          </p>
        </div>
      )}
    </div>
  );
}

function fireNotification(s: SignalLite) {
  if (typeof window === "undefined") return;

  // Som via WebAudio (sem asset)
  try {
    const AC = (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      const now = ctx.currentTime;
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.frequency.value = 880;
      o1.type = "sine";
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(0.15, now + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      o1.connect(g1);
      g1.connect(ctx.destination);
      o1.start(now);
      o1.stop(now + 0.42);

      // segundo tom
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.frequency.value = 1320;
      o2.type = "sine";
      g2.gain.setValueAtTime(0, now + 0.15);
      g2.gain.linearRampToValueAtTime(0.12, now + 0.17);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start(now + 0.15);
      o2.stop(now + 0.57);

      // fecha contexto após o som
      setTimeout(() => ctx.close().catch(() => {}), 800);
    }
  } catch {}

  // Notificação do browser
  try {
    if (Notification.permission === "granted") {
      const dirText = directionText(s.direction);
      new Notification(`ZaionVest · ${s.symbol}`, {
        body: `${dirText} · Modo ${s.mode === "SMC" ? "SMC" : "Clássico"} · ${s.probability}% prob · ${s.confidence ?? ""}`,
        tag: s.id,
        silent: false,
      });
    }
  } catch {}
}

function directionText(d: string | null): string {
  switch (d) {
    case "COMPRA_FORTE":
      return "Compra forte";
    case "COMPRA_FRACA":
      return "Compra fraca";
    case "VENDA_FORTE":
      return "Venda forte";
    case "VENDA_FRACA":
      return "Venda fraca";
    default:
      return "Sinal";
  }
}

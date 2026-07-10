"""
Backtest vetorizado das famílias base (DQ Labs cap. 1) sobre candles reais.
Famílias v1: trend (cruzamento EMA), mean_reversion (RSI), breakout (Donchian).
Cada família roda em 2 modos de saída: "reversal" e "fixed_sltp".

Simulação bar-a-bar, 1 posição por vez, lote fixo. Custos (spread+comissão)
descontados por trade — backtest sem custo mente (DQ Labs cap. 2).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from wfa import Trade


# ─── Indicadores (pandas/numpy, sem TA-Lib) ──────────────────────────────────

def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def _rsi(close: pd.Series, n: int) -> pd.Series:
    delta = close.diff()
    up = delta.clip(lower=0.0)
    down = -delta.clip(upper=0.0)
    roll_up = up.ewm(alpha=1 / n, adjust=False).mean()
    roll_down = down.ewm(alpha=1 / n, adjust=False).mean()
    rs = roll_up / roll_down.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50.0)


def _atr(df: pd.DataFrame, n: int) -> pd.Series:
    h, l, c = df["high"], df["low"], df["close"]
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean()


# ─── Sinais por família ──────────────────────────────────────────────────────

def _signals(df: pd.DataFrame, family: str, p: dict) -> np.ndarray:
    """Retorna array de sinal por barra: +1 long, -1 short, 0 nada."""
    close = df["close"]
    sig = np.zeros(len(df), dtype=int)

    if family == "trend":
        fast = _ema(close, int(p.get("ema_fast", 12)))
        slow = _ema(close, int(p.get("ema_slow", 48)))
        filt = _ema(close, int(p.get("ema_filter", 200)))
        long_ = (fast > slow) & (close > filt)
        short_ = (fast < slow) & (close < filt)
        sig[long_.values] = 1
        sig[short_.values] = -1

    elif family == "mean_reversion":
        rsi = _rsi(close, int(p.get("rsi_period", 14)))
        os_, ob = p.get("rsi_os", 30), p.get("rsi_ob", 70)
        sig[(rsi < os_).values] = 1
        sig[(rsi > ob).values] = -1

    elif family == "breakout":
        n = int(p.get("lookback", 20))
        hh = df["high"].rolling(n).max().shift(1)
        ll = df["low"].rolling(n).min().shift(1)
        sig[(close > hh).fillna(False).values] = 1
        sig[(close < ll).fillna(False).values] = -1
    else:
        raise ValueError(f"família desconhecida: {family}")

    return sig


# ─── Backtest ────────────────────────────────────────────────────────────────

def run_backtest(
    df: pd.DataFrame,
    family: str,
    params: dict,
    *,
    exit_mode: str = "reversal",
    point: float = 1e-5,
    contract_size: float = 100_000.0,
    lot: float = 0.1,
    spread_points: float = 12.0,
    commission_per_trade: float = 0.7,
) -> list[Trade]:
    """Roda a estratégia e devolve a lista de trades (com profit em $ e data)."""
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values
    times = df["time"].values
    sig = _signals(df, family, params)
    atr = _atr(df, int(params.get("atr_period", 14))).values

    sl_mult = float(params.get("sl_atr", 2.0))
    tp_mult = float(params.get("tp_atr", 3.0))
    cost_per_trade = spread_points * point * contract_size * lot + commission_per_trade
    value = contract_size * lot  # $ por 1.0 de variação de preço

    trades: list[Trade] = []
    pos = 0            # 0 flat, +1 long, -1 short
    entry_px = 0.0
    sl = tp = 0.0

    def close_trade(exit_px: float, i: int):
        nonlocal pos
        gross = pos * (exit_px - entry_px) * value
        trades.append(Trade(profit=round(float(gross) - cost_per_trade, 2),
                            date=str(pd.Timestamp(times[i]).date())))
        pos = 0

    for i in range(1, len(df)):
        s = sig[i]

        # Gestão de posição aberta
        if pos != 0:
            if exit_mode == "fixed_sltp":
                # checa SL/TP intrabar (SL primeiro, conservador)
                if pos == 1:
                    if low[i] <= sl:
                        close_trade(sl, i)
                    elif high[i] >= tp:
                        close_trade(tp, i)
                else:  # short
                    if high[i] >= sl:
                        close_trade(sl, i)
                    elif low[i] <= tp:
                        close_trade(tp, i)
            # saída por sinal contrário (reversal, ou fallback do fixed)
            if pos != 0 and s == -pos:
                close_trade(close[i], i)
                if exit_mode == "reversal":
                    # inverte imediatamente
                    pos = s
                    entry_px = close[i]

        # Abre nova posição se está flat e há sinal
        if pos == 0 and s != 0:
            pos = s
            entry_px = close[i]
            if exit_mode == "fixed_sltp":
                a = atr[i] if not np.isnan(atr[i]) else 0.0
                sl = entry_px - pos * sl_mult * a
                tp = entry_px + pos * tp_mult * a

    return trades


def count_params(family: str) -> int:
    """Nº de parâmetros otimizáveis por família (pra mín. trades DQ Labs)."""
    return {"trend": 3, "mean_reversion": 3, "breakout": 2}.get(family, 3)

"""
Motor de backtest VETORIZADO (multi/famílias simples, fixed_sltp + reversal).
=============================================================================
Substitui o loop Python barra-a-barra por um loop sobre TRADES (~centenas) com
busca de saída vetorizada em numpy. Objetivo: 10-30x mais rápido, produzindo
resultado IDÊNTICO ao run_backtest de referência (trades + equity_bar).

Semântica replicada EXATAMENTE (ver backtest.run_backtest):
  Por barra: friday(fecha, sem entrada) > [fixed] SL antes de TP > sinal
  contrário (fecha a mercado; reversal+both reabre). Entrada quando flat e
  sinal!=0 e não-sexta, no close da barra; SL/TP do ATR da barra de entrada.
  Mesma barra pode fechar E reabrir (menos em sexta). Equity mark-to-market
  por barra = realizado + flutuante.

NÃO cobre grid/grid_hedge/nv7 (mantêm o motor de referência).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from backtest import (Trade, BacktestResult, _atr, _signals, normalized_lot,
                      START_CAPITAL)


def run_backtest_fast(
    df: pd.DataFrame, family: str, params: dict, *,
    exit_mode: str = "reversal", direction: str = "both",
    point: float = 1e-5, contract_size: float = 100_000.0,
    lot: float | None = None, spread_points: float = 12.0,
    commission_per_trade: float = 0.7,
) -> BacktestResult:
    close = df["close"].to_numpy(dtype=float)
    high = df["high"].to_numpy(dtype=float)
    low = df["low"].to_numpy(dtype=float)
    atr = _atr(df, int(params.get("atr_period", 14))).to_numpy(dtype=float)
    if lot is None:
        lot = normalized_lot(float(np.nanmean(atr)), contract_size)

    sig = _signals(df, family, params).astype(np.int64)
    if direction == "long":
        sig[sig == -1] = 0
    elif direction == "short":
        sig[sig == 1] = 0

    dt = pd.DatetimeIndex(df["time"])
    friday = np.asarray((dt.weekday == 4) & (dt.hour >= 20))
    date_strs = np.asarray(dt.strftime("%Y-%m-%d"))

    sl_mult = float(params.get("sl_atr", 2.0))
    tp_mult = float(params.get("tp_atr", 3.0))
    cost = spread_points * point * contract_size * lot + commission_per_trade
    value = contract_size * lot
    fixed = exit_mode == "fixed_sltp"
    reopen_reversal = (exit_mode == "reversal" and direction == "both")

    n = len(close)
    atr_nan = np.isnan(atr)

    # Máscara de entrada candidata (flat): sinal != 0 e não-sexta.
    entry_ok = (sig != 0) & (~friday)

    # ── loop sobre trades ──────────────────────────────────────────────────
    t_entry: list[int] = []   # barra de entrada
    t_exit: list[int] = []    # barra de saída
    t_pos: list[int] = []     # +1/-1
    t_entrypx: list[float] = []
    t_exitpx: list[float] = []
    t_profit: list[float] = []
    realized = START_CAPITAL

    CHUNK = 1024   # varredura para frente em blocos (sem re-escanear)
    i = 1
    while i < n:
        # acha próxima entrada (flat): 1º bar >= i com entry_ok, por chunks
        e = -1
        jj = i
        while jj < n:
            end = min(jj + CHUNK, n)
            w = entry_ok[jj:end]
            if w.any():
                e = jj + int(np.argmax(w)); break
            jj = end
        if e < 0:
            break
        pos = int(sig[e]); entry_px = close[e]
        if fixed:
            a = atr[e] if not atr_nan[e] else 0.0
            sl = entry_px - pos * sl_mult * a
            tp = entry_px + pos * tp_mult * a

        # busca de saída em j > e (chunks; prioridade friday > SL > TP > reversal)
        x = -1; exit_px = 0.0; is_friday_exit = False
        jj = e + 1
        while jj < n:
            end = min(jj + CHUNK, n)
            fr = friday[jj:end]
            rev = (sig[jj:end] == -pos)
            if fixed:
                if pos == 1:
                    slh = low[jj:end] <= sl
                    tph = high[jj:end] >= tp
                else:
                    slh = high[jj:end] >= sl
                    tph = low[jj:end] <= tp
                exit_any = fr | slh | tph | rev
            else:
                slh = tph = None
                exit_any = fr | rev
            if exit_any.any():
                rel_x = int(np.argmax(exit_any)); x = jj + rel_x
                if fr[rel_x]:
                    exit_px = close[x]; is_friday_exit = True
                elif fixed and slh[rel_x]:
                    exit_px = sl
                elif fixed and tph[rel_x]:
                    exit_px = tp
                else:
                    exit_px = close[x]
                break
            jj = end

        if x < 0:
            # nunca sai: posição fica aberta até o fim (sem trade fechado),
            # mas a equity flutuante segue — igual ao motor de referência.
            t_entry.append(e); t_exit.append(n); t_pos.append(pos)
            t_entrypx.append(entry_px); t_exitpx.append(float("nan"))
            t_profit.append(0.0)
            break

        profit = round(float(pos * (exit_px - entry_px) * value) - cost, 2)
        realized += profit
        t_entry.append(e); t_exit.append(x); t_pos.append(pos)
        t_entrypx.append(entry_px); t_exitpx.append(exit_px); t_profit.append(profit)

        # mesma barra pode reabrir (menos em sexta) → próximo candidato = barra x
        i = (x + 1) if is_friday_exit else x

    # ── reconstrução vetorizada da equity + trades ─────────────────────────
    trades: list[Trade] = []
    delta = np.zeros(n)
    floating = np.zeros(n)
    for k in range(len(t_entry)):
        e = t_entry[k]; x = t_exit[k]; pos = t_pos[k]; epx = t_entrypx[k]
        if x < n:  # trade fechado
            delta[x] += t_profit[k]
            trades.append(Trade(profit=t_profit[k], date=str(date_strs[x]), side=pos))
            floating[e:x] = pos * (close[e:x] - epx) * value
        else:      # trade aberto até o fim (sem realizar)
            floating[e:n] = pos * (close[e:n] - epx) * value

    realized_arr = START_CAPITAL + np.cumsum(delta)
    equity = np.round(realized_arr + floating, 2)

    equity_bar = [float(v) for v in equity[1:]]
    equity_dates = [str(d) for d in date_strs[1:]]
    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot)

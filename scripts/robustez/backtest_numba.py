"""
Motor de backtest com KERNEL NUMBA (@njit) — multi/famílias simples.
====================================================================
Porta o loop barra-a-barra do run_backtest de referência para um kernel numba
compilado. Ganho de 10-50x INDEPENDENTE da frequência de trades (ao contrário
do trade-loop vetorizado). Lógica é cópia FIEL do backtest.run_backtest →
resultado idêntico (verificado por teste de equivalência).

Só roda onde numba está disponível (venv .venv-numba). O backtest.py importa
este módulo em try/except e usa o kernel quando presente; senão, cai no loop
Python puro. NÃO cobre grid/grid_hedge/nv7.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from numba import njit

from backtest import (Trade, BacktestResult, _atr, _signals, normalized_lot,
                      START_CAPITAL)


@njit(cache=False, fastmath=False)
def _sim(sig, close, high, low, atr, friday, fixed, reopen_rev,
         sl_mult, tp_mult, cost, value, start_cap):
    n = close.shape[0]
    prof = np.empty(n, dtype=np.float64)
    exiti = np.empty(n, dtype=np.int64)
    sides = np.empty(n, dtype=np.int64)
    equity = np.empty(n - 1, dtype=np.float64)   # barras 1..n-1
    nt = 0
    realized = start_cap
    pos = 0
    entry_px = 0.0
    sl = 0.0
    tp = 0.0
    for i in range(1, n):
        s = sig[i]
        if friday[i]:
            if pos != 0:
                p = round(pos * (close[i] - entry_px) * value - cost, 2)
                realized += p
                prof[nt] = p; exiti[nt] = i; sides[nt] = pos; nt += 1
                pos = 0
            equity[i - 1] = round(realized, 2)
            continue
        if pos != 0:
            if fixed:
                if pos == 1:
                    if low[i] <= sl:
                        p = round(pos * (sl - entry_px) * value - cost, 2)
                        realized += p; prof[nt] = p; exiti[nt] = i; sides[nt] = pos; nt += 1; pos = 0
                    elif high[i] >= tp:
                        p = round(pos * (tp - entry_px) * value - cost, 2)
                        realized += p; prof[nt] = p; exiti[nt] = i; sides[nt] = pos; nt += 1; pos = 0
                else:
                    if high[i] >= sl:
                        p = round(pos * (sl - entry_px) * value - cost, 2)
                        realized += p; prof[nt] = p; exiti[nt] = i; sides[nt] = pos; nt += 1; pos = 0
                    elif low[i] <= tp:
                        p = round(pos * (tp - entry_px) * value - cost, 2)
                        realized += p; prof[nt] = p; exiti[nt] = i; sides[nt] = pos; nt += 1; pos = 0
            if pos != 0 and s == -pos:
                p = round(pos * (close[i] - entry_px) * value - cost, 2)
                realized += p; prof[nt] = p; exiti[nt] = i; sides[nt] = pos; nt += 1; pos = 0
                if reopen_rev:
                    pos = s; entry_px = close[i]
        if pos == 0 and s != 0:
            pos = s; entry_px = close[i]
            if fixed:
                a = atr[i]
                if a != a:   # NaN
                    a = 0.0
                sl = entry_px - pos * sl_mult * a
                tp = entry_px + pos * tp_mult * a
        floating = pos * (close[i] - entry_px) * value if pos != 0 else 0.0
        equity[i - 1] = round(realized + floating, 2)
    return nt, prof, exiti, sides, equity


def run_backtest_numba(
    df: pd.DataFrame, family: str, params: dict, *,
    exit_mode: str = "reversal", direction: str = "both",
    point: float = 1e-5, contract_size: float = 100_000.0,
    lot: float | None = None, spread_points: float = 12.0,
    commission_per_trade: float = 0.7,
) -> BacktestResult:
    close = np.ascontiguousarray(df["close"].to_numpy(dtype=np.float64))
    high = np.ascontiguousarray(df["high"].to_numpy(dtype=np.float64))
    low = np.ascontiguousarray(df["low"].to_numpy(dtype=np.float64))
    atr = np.ascontiguousarray(_atr(df, int(params.get("atr_period", 14))).to_numpy(dtype=np.float64))
    if lot is None:
        lot = normalized_lot(float(np.nanmean(atr)), contract_size)

    sig = np.ascontiguousarray(_signals(df, family, params).astype(np.int64))
    if direction == "long":
        sig[sig == -1] = 0
    elif direction == "short":
        sig[sig == 1] = 0

    dt = pd.DatetimeIndex(df["time"])
    friday = np.ascontiguousarray(np.asarray((dt.weekday == 4) & (dt.hour >= 20)))
    date_strs = np.asarray(dt.strftime("%Y-%m-%d"))

    sl_mult = float(params.get("sl_atr", 2.0))
    tp_mult = float(params.get("tp_atr", 3.0))
    cost = spread_points * point * contract_size * lot + commission_per_trade
    value = contract_size * lot
    fixed = exit_mode == "fixed_sltp"
    reopen_rev = (exit_mode == "reversal" and direction == "both")

    nt, prof, exiti, sides, equity = _sim(
        sig, close, high, low, atr, friday, fixed, reopen_rev,
        sl_mult, tp_mult, cost, value, float(START_CAPITAL))

    trades = [Trade(profit=float(prof[k]), date=str(date_strs[int(exiti[k])]),
                    side=int(sides[k])) for k in range(nt)]
    equity_bar = [float(v) for v in equity]
    equity_dates = [str(d) for d in date_strs[1:]]
    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot)

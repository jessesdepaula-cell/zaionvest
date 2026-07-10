"""
Minerador de estratégias (DQ Labs) — grid systematic sobre dados reais do MT5.

Fluxo (cap. 3-7 DQ Labs):
  1. Para cada (símbolo, TF, família, modo de saída): gera um GRID de parâmetros.
  2. Backtesta cada combo (reusando os candles) — screen barato descarta lixo.
  3. Candidatos que passam no screen vão pro funil completo (WFA + Monte Carlo +
     todos os gates) via pipeline.evaluate.
  4. Sobreviventes = estratégias publicáveis (com strategyDef pra compilar .ex5).

Sem dependência externa (vectorbt quebrou com numpy 2.4 nesta máquina) — usa o
nosso backtest vetorizado, que roda um backtest de 2 anos praticamente na hora.
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import mt5_data
from backtest import run_backtest, count_params, START_CAPITAL
from metrics import (compute_metrics, min_trades_required,
                     equity_r_squared, drawdown_of_curve)
import pipeline

V1_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "EURAUD", "XAUUSD"]
V1_TIMEFRAMES = ["H1", "H4"]
FAMILIES = ["trend", "mean_reversion", "breakout", "grid"]
EXIT_MODES = ["reversal", "fixed_sltp"]
DIRECTIONS = ["both", "long", "short"]

# ─── Grids de parâmetros por família (otimização por contexto, DQ Labs cap. 3) ─

def _grid(family: str, exit_mode: str) -> list[dict]:
    combos: list[dict] = []
    sltp = ([{"sl_atr": s, "tp_atr": t} for s in (1.5, 2.5) for t in (2.0, 3.0)]
            if exit_mode == "fixed_sltp" else [{}])

    if family == "trend":
        for fast in (8, 12, 16, 20):
            for slow in (40, 50, 60, 80):
                if fast >= slow:
                    continue
                for ex in sltp:
                    combos.append({"ema_fast": fast, "ema_slow": slow,
                                   "ema_filter": 200, "atr_period": 14, **ex})
    elif family == "mean_reversion":
        for rsi_p in (7, 14, 21):
            for os_ in (20, 25, 30):
                for ex in sltp:
                    combos.append({"rsi_period": rsi_p, "rsi_os": os_,
                                   "rsi_ob": 100 - os_, "atr_period": 14, **ex})
    elif family == "breakout":
        for lb in (10, 20, 30, 40, 55):
            for ex in sltp:
                combos.append({"lookback": lb, "atr_period": 14, **ex})
    elif family == "grid":
        # grid não usa SL/TP por ordem — o cesto fecha no retorno ao médio
        for spacing in (0.8, 1.2, 1.6):
            for levels in (3, 4, 5):
                for tp in (0.4, 0.6):
                    combos.append({"rsi_period": 14, "rsi_os": 30, "rsi_ob": 70,
                                   "atr_period": 14, "grid_spacing": spacing,
                                   "grid_levels": levels, "grid_tp": tp})
    return combos


def _cheap_screen(profits: list[float], equity_bar: list[float], min_trades: int) -> bool:
    """Descarta lixo antes do WFA caro: trades, lucro, PF>1 E qualidade de
    curva (DD flutuante, linearidade, recovery) — os gates que o Jessé pediu."""
    if len(profits) < min_trades:
        return False
    m = compute_metrics(profits)
    pf = m.profit_factor if m.profit_factor != float("inf") else 999.0
    if m.net_profit <= 0 or pf <= 1.0:
        return False
    dd_abs, dd_pct = drawdown_of_curve(equity_bar, START_CAPITAL)
    if dd_pct > pipeline.MAX_DD_PCT:
        return False
    if equity_r_squared(equity_bar) < 0.80:  # folga; o gate final exige 0.85
        return False
    recovery = (m.net_profit / dd_abs) if dd_abs > 0 else 0.0
    return recovery >= 1.5


def mine(
    symbols: list[str],
    timeframes: list[str],
    families: list[str] = FAMILIES,
    modes: list[str] = EXIT_MODES,
    directions: list[str] = DIRECTIONS,
    years: float = 2.0,
    verbose: bool = True,
) -> list[dict]:
    survivors: list[dict] = []
    tested = screened = 0

    mt5_data.connect()
    try:
        for symbol in symbols:
            for tf in timeframes:
                try:
                    df, resolved = mt5_data.get_candles(symbol, tf, years=years)
                    info = mt5_data.symbol_info(resolved)
                except Exception as e:  # noqa: BLE001
                    if verbose:
                        print(f"[miner] pulei {symbol} {tf}: {e}", file=sys.stderr)
                    continue

                for family in families:
                    min_trades = min_trades_required(count_params(family))
                    # grid tem cesto próprio; só faz sentido no modo próprio
                    fam_modes = ["reversal"] if family == "grid" else modes
                    for mode in fam_modes:
                        for direction in directions:
                            for params in _grid(family, mode):
                                tested += 1
                                bt = run_backtest(
                                    df, family, params, exit_mode=mode,
                                    direction=direction,
                                    point=info.point, contract_size=info.contract_size,
                                )
                                profits = [t.profit for t in bt.trades]
                                if not _cheap_screen(profits, bt.equity_bar, min_trades):
                                    continue
                                screened += 1
                                # Funil completo DQ Labs + gates de curva
                                res = pipeline.evaluate(
                                    bt.trades, ea_id=f"mine-{symbol}-{tf}-{family}",
                                    ea_name=f"{family} {symbol} {tf}",
                                    symbol=resolved, timeframe=tf,
                                    family=family, exit_mode=mode, source="mine",
                                    equity_bar=bt.equity_bar,
                                )
                                if res["approved"]:
                                    survivors.append({
                                        "symbol": resolved, "timeframe": tf,
                                        "family": family, "exit_mode": mode,
                                        "direction": direction,
                                        "params": params,
                                        "lot": bt.lot,
                                        "strategyDef": {"family": family, "exit_mode": mode,
                                                        "direction": direction, "lot": bt.lot,
                                                        **params},
                                        "wfe": res["wfe"], "metrics": res["metrics"],
                                        "curve": res["curve"],
                                        "montecarlo": res["montecarlo"],
                                        "reportMd": res["reportMd"],
                                    })
                                    if verbose:
                                        c = res["curve"]
                                        print(f"[miner] ✔ SOBREVIVENTE: {family} {resolved} {tf} "
                                              f"{mode}/{direction} WFE={res['wfe']:.1f}% "
                                              f"DD={c['dd_pct_mtm']:.1f}% R2={c['r2']:.2f}",
                                              file=sys.stderr)
    finally:
        mt5_data.shutdown()

    if verbose:
        print(f"[miner] testados={tested} screenados={screened} sobreviventes={len(survivors)}",
              file=sys.stderr)
    return survivors


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="Minerador de estratégias DQ Labs (grid)")
    ap.add_argument("--symbols", default="EURUSD", help="lista separada por vírgula, ou 'v1'")
    ap.add_argument("--timeframes", default="H1", help="lista separada por vírgula, ou 'v1'")
    ap.add_argument("--families", default=",".join(FAMILIES))
    ap.add_argument("--modes", default=",".join(EXIT_MODES))
    ap.add_argument("--years", type=float, default=2.0)
    ap.add_argument("--json-out", help="salva sobreviventes em .json")
    args = ap.parse_args()

    symbols = V1_SYMBOLS if args.symbols == "v1" else args.symbols.split(",")
    timeframes = V1_TIMEFRAMES if args.timeframes == "v1" else args.timeframes.split(",")

    survivors = mine(symbols, timeframes, args.families.split(","),
                     args.modes.split(","), years=args.years)
    print(f"\n=== {len(survivors)} sobrevivente(s) ===")
    for s in survivors:
        cap = s["montecarlo"]["recommended_capital"]
        c = s["curve"]
        print(f"  {s['family']:14s} {s['symbol']:8s} {s['timeframe']:3s} "
              f"{s['exit_mode']:10s} {s['direction']:5s} "
              f"WFE={s['wfe']:.1f}% PF={s['metrics']['profit_factor']} "
              f"DD={c['dd_pct_mtm']:.1f}% R2={c['r2']:.2f} "
              f"cap(mod)=${cap.get('moderado', 0):,.0f}")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(survivors, f, ensure_ascii=False, indent=2)
        print(f"salvo: {args.json_out}")


if __name__ == "__main__":
    main()

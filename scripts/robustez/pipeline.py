"""
Pipeline de Robustez ZaionVest (DQ Labs) — orquestrador.
=========================================================
dados reais do MT5 → backtest → WFA + gates + Monte Carlo → veredito + relatório.

Chamado pelo worker (stdin JSON) ou via CLI. Se o MT5 não estiver disponível,
cai num fallback de trades sintéticos pra o pipeline seguir rodando.

Gates de aprovação (DQ Labs):
  - mínimo de trades IS = 50 + 50 * nº de params
  - WFE médio > 50%
  - janelas OOS negativas < 50%
  - Profit Factor > 1.0
  - lucro líquido > 0
Monte Carlo define o capital recomendado por perfil de risco (20/40/60% DD).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from wfa import Trade, walk_forward_analysis, generate_report_md
from metrics import (compute_metrics, min_trades_required,
                     equity_r_squared, drawdown_of_curve)
from montecarlo import monte_carlo, RISK_PROFILES
from backtest import run_backtest, count_params, START_CAPITAL

# Gates calibrados pelos filtros REAIS do SQX do Jessé (prints 2026-07-10):
# Ranking: PF > 1.3, Ret/DD > 4, trades/mês > 2; Stability aceita 0.67-0.86.
# Base $10k (START_CAPITAL) — DD% na régua SQX/QuantMiner.
MAX_DD_PCT = 10.0       # DD flutuante m2m máximo (melhores SQX: 3-5%)
MIN_R2 = 0.80           # linearidade (SQX "Stability" aceitava até 0.67)
MIN_RECOVERY = 4.0      # Ret/DD — filtro literal do SQX (aceitos: 4.9-7.5)
MIN_PF = 1.3            # Profit Factor — filtro literal do SQX
MIN_TRADES_PER_MONTH = 2.0  # filtro literal do SQX

# Params default por família (ponto de partida; a otimização refina depois).
DEFAULT_PARAMS = {
    "trend": {"ema_fast": 12, "ema_slow": 48, "ema_filter": 200, "atr_period": 14, "sl_atr": 2.0, "tp_atr": 3.0},
    "mean_reversion": {"rsi_period": 14, "rsi_os": 30, "rsi_ob": 70, "atr_period": 14, "sl_atr": 2.0, "tp_atr": 3.0},
    "breakout": {"lookback": 20, "atr_period": 14, "sl_atr": 2.0, "tp_atr": 3.0},
    "grid": {"rsi_period": 14, "rsi_os": 30, "rsi_ob": 70, "atr_period": 14,
             "grid_spacing": 1.0, "grid_levels": 4, "grid_tp": 0.5},
    "macd_cross": {"macd_fast": 12, "macd_slow": 26, "macd_signal": 9,
                   "atr_period": 14, "sl_atr": 2.0, "tp_atr": 3.0},
    "bollinger_fade": {"bb_period": 20, "bb_dev": 2.0, "atr_period": 14,
                       "sl_atr": 2.0, "tp_atr": 3.0},
    "bollinger_break": {"bb_period": 20, "bb_dev": 2.0, "atr_period": 14,
                        "sl_atr": 2.0, "tp_atr": 3.0},
    "stochastic": {"stoch_k": 14, "stoch_smooth": 3, "stoch_os": 20,
                   "stoch_ob": 80, "atr_period": 14, "sl_atr": 2.0, "tp_atr": 3.0},
}


def _stub_trades(ea_id: str, n: int = 500) -> list[Trade]:
    import random
    rng = random.Random(sum(ord(c) for c in ea_id) % 10000)
    out = []
    for _ in range(n):
        win = rng.random() < 0.55
        out.append(Trade(profit=round(rng.uniform(10, 150) if win else -rng.uniform(8, 80), 2)))
    return out


def _get_result(symbol: str, timeframe: str, family: str, params: dict,
                exit_mode: str, direction: str, years: float):
    """Backtest real no MT5; retorna (BacktestResult|None, trades, fonte)."""
    try:
        import mt5_data
        mt5_data.connect()
        df, resolved = mt5_data.get_candles(symbol, timeframe, years=years)
        info = mt5_data.symbol_info(resolved)
        bt = run_backtest(
            df, family, params,
            exit_mode=exit_mode,
            direction=direction,
            point=info.point,
            contract_size=info.contract_size,
        )
        mt5_data.shutdown()
        return bt, bt.trades, f"MT5:{resolved}"
    except Exception as e:  # noqa: BLE001 — fallback consciente
        print(f"[Pipeline] MT5 indisponível ({e}); usando stub.", file=sys.stderr)
        return None, _stub_trades(family + symbol), "stub"


def run_pipeline(
    ea_id: str,
    ea_name: str,
    symbol: str,
    timeframe: str,
    family: str = "trend",
    exit_mode: str = "reversal",
    direction: str = "both",
    params: dict | None = None,
    n_windows: int = 6,
    years: float = 10.0,
) -> dict:
    params = {**DEFAULT_PARAMS.get(family, {}), **(params or {})}
    bt, trades, source = _get_result(symbol, timeframe, family, params,
                                     exit_mode, direction, years)
    print(f"[Pipeline] {len(trades)} trades ({source}) — {ea_name} {symbol} {timeframe}", file=sys.stderr)
    return evaluate(trades, ea_id, ea_name, symbol, timeframe, family, exit_mode,
                    n_windows=n_windows, source=source,
                    equity_bar=bt.equity_bar if bt else None)


def evaluate(
    trades: list[Trade],
    ea_id: str,
    ea_name: str,
    symbol: str,
    timeframe: str,
    family: str,
    exit_mode: str,
    n_windows: int = 6,
    source: str = "backtest",
    equity_bar: list[float] | None = None,
) -> dict:
    """Aplica os gates DQ Labs a um backtest JÁ rodado.
    equity_bar (mark-to-market por barra) habilita os gates de curva:
    DD flutuante ≤ MAX_DD_PCT, R² ≥ MIN_R2, Recovery Factor ≥ MIN_RECOVERY."""
    profits = [t.profit for t in trades]
    m = compute_metrics(profits)
    n_params = count_params(family)
    min_trades = min_trades_required(n_params)

    try:
        wfa = walk_forward_analysis(trades, n_windows=n_windows)
    except ValueError as e:
        return {
            "ea_id": ea_id, "wfe": 0.0, "oosWins": 0, "oosTotalWin": n_windows,
            "approved": False, "reportMd": f"# {ea_name}\n\nReprovado: {e}",
            "windowsJson": [], "metrics": m.__dict__, "source": source,
            "validated_at": datetime.now().isoformat(),
        }

    mc = monte_carlo(profits)

    # Métricas de curva (mark-to-market quando disponível; senão por trade)
    if equity_bar:
        dd_abs, dd_pct = drawdown_of_curve(equity_bar, START_CAPITAL)
        r2 = equity_r_squared(equity_bar)
    else:
        dd_abs, dd_pct = m.max_drawdown_abs, m.max_drawdown_pct
        eq, acc = [], START_CAPITAL
        for p in profits:
            acc += p
            eq.append(acc)
        r2 = equity_r_squared(eq)
    recovery = (m.net_profit / dd_abs) if dd_abs > 0 else 0.0

    # trades/mês (SQX): meses entre primeiro e último trade datado
    months = 1.0
    dated = [t.date for t in trades if t.date]
    if len(dated) >= 2:
        from datetime import date
        d0 = date.fromisoformat(dated[0])
        d1 = date.fromisoformat(dated[-1])
        months = max(1.0, (d1 - d0).days / 30.44)
    tpm = m.total_trades / months

    # ── Gates DQ Labs + filtros SQX ───────────────────────────────────────────
    pf = m.profit_factor if m.profit_factor != float("inf") else 999.0
    gates = {
        "min_trades": (m.total_trades >= min_trades, f"{m.total_trades} ≥ {min_trades}"),
        "trades_per_month": (tpm >= MIN_TRADES_PER_MONTH, f"{tpm:.1f} ≥ {MIN_TRADES_PER_MONTH}"),
        "wfe_gt_50": (wfa.wfe_avg > 50.0, f"{wfa.wfe_avg:.1f}%"),
        "oos_neg_lt_50": (wfa.oos_negative_pct < 50.0, f"{wfa.oos_negative_pct:.1f}%"),
        "pf_min": (pf > MIN_PF, f"{pf:.2f} > {MIN_PF}"),
        "net_positive": (m.net_profit > 0, f"${m.net_profit:.2f}"),
        "dd_max": (dd_pct <= MAX_DD_PCT, f"{dd_pct:.1f}% ≤ {MAX_DD_PCT:.0f}%"),
        "linearity_r2": (r2 >= MIN_R2, f"{r2:.3f} ≥ {MIN_R2}"),
        "recovery": (recovery >= MIN_RECOVERY, f"{recovery:.2f} ≥ {MIN_RECOVERY}"),
    }
    approved = all(ok for ok, _ in gates.values())
    # sobrescreve o DD reportado com o flutuante (o honesto)
    m.max_drawdown_abs, m.max_drawdown_pct = dd_abs, dd_pct

    report_md = _report(ea_name, symbol, timeframe, exit_mode, wfa, m, mc, gates, min_trades, approved)

    return {
        "ea_id": ea_id,
        "wfe": wfa.wfe_avg,
        "oosWins": wfa.oos_wins,
        "oosTotalWin": wfa.oos_total,
        "approved": approved,
        "reportMd": report_md,
        "windowsJson": [
            {"window": w.window, "isProfit": w.is_profit, "oosProfit": w.oos_profit,
             "wfe": w.wfe, "approved": w.approved} for w in wfa.windows
        ],
        "metrics": m.__dict__,
        "curve": {"r2": r2, "recovery_factor": round(recovery, 2),
                  "dd_pct_mtm": dd_pct},
        "montecarlo": {"dd_p95_abs": mc.dd_p95_abs, "recommended_capital": mc.recommended_capital},
        "gates": {k: ok for k, (ok, _) in gates.items()},
        "source": source,
        "validated_at": datetime.now().isoformat(),
    }


def _report(ea_name, symbol, timeframe, exit_mode, wfa, m, mc, gates, min_trades, approved) -> str:
    base = generate_report_md(wfa, ea_name=ea_name, symbol=symbol, timeframe=timeframe, exit_mode=exit_mode)
    cap = mc.recommended_capital
    extra = f"""

---

## 3. Backtest 2 anos — Métricas

- **Profit Factor:** {m.profit_factor}
- **Drawdown máx:** {m.max_drawdown_pct:.2f}% (${m.max_drawdown_abs:.2f})
- **Trades:** {m.total_trades} · **Win rate:** {m.win_rate*100:.1f}% · **Payoff:** {m.payoff}
- **Expectativa/trade:** ${m.expectancy:.2f} · **Lucro líquido:** ${m.net_profit:.2f}

## 4. Monte Carlo — Capital recomendado por perfil (DD p95 = ${mc.dd_p95_abs:.2f})

- **Conservador (≤{RISK_PROFILES['conservador']:.0f}% DD):** ${cap.get('conservador', 0):,.2f}
- **Moderado (≤{RISK_PROFILES['moderado']:.0f}% DD):** ${cap.get('moderado', 0):,.2f}
- **Agressivo (≤{RISK_PROFILES['agressivo']:.0f}% DD):** ${cap.get('agressivo', 0):,.2f}

## 5. Checklist completo DQ Labs

- **Mín. trades ({min_trades}):** {'✅' if gates['min_trades'][0] else '❌'} ({gates['min_trades'][1]})
- **Trades/mês ≥ {MIN_TRADES_PER_MONTH:.0f} (SQX):** {'✅' if gates['trades_per_month'][0] else '❌'} ({gates['trades_per_month'][1]})
- **WFE consolidado > 50%:** {'✅' if gates['wfe_gt_50'][0] else '❌'} ({gates['wfe_gt_50'][1]})
- **OOS negativas < 50%:** {'✅' if gates['oos_neg_lt_50'][0] else '❌'} ({gates['oos_neg_lt_50'][1]})
- **Profit Factor > {MIN_PF} (SQX):** {'✅' if gates['pf_min'][0] else '❌'} ({gates['pf_min'][1]})
- **Lucro líquido > 0:** {'✅' if gates['net_positive'][0] else '❌'} ({gates['net_positive'][1]})
- **DD flutuante ≤ {MAX_DD_PCT:.0f}%:** {'✅' if gates['dd_max'][0] else '❌'} ({gates['dd_max'][1]})
- **Curva linear (R² ≥ {MIN_R2}):** {'✅' if gates['linearity_r2'][0] else '❌'} ({gates['linearity_r2'][1]})
- **Ret/DD ≥ {MIN_RECOVERY:.0f} (SQX):** {'✅' if gates['recovery'][0] else '❌'} ({gates['recovery'][1]})

### Veredito final: {'✅ ROBUSTA — publicável' if approved else '⚠️ REPROVADA'}
"""
    return base + extra


# ─── Entry points ─────────────────────────────────────────────────────────────

def main_stdin():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "Empty stdin"})); sys.exit(1)
    p = json.loads(raw)
    out = run_pipeline(
        ea_id=p.get("ea_id", "unknown"), ea_name=p.get("ea_name", "EA"),
        symbol=p.get("symbol", "EURUSD"), timeframe=p.get("timeframe", "H1"),
        family=p.get("family", "trend"), exit_mode=p.get("exit_mode", "reversal"),
        params=p.get("params"), years=p.get("years", 10.0),
    )
    print(json.dumps(out, ensure_ascii=False))


def main_cli():
    ap = argparse.ArgumentParser(description="Pipeline de Robustez ZaionVest (DQ Labs)")
    ap.add_argument("--ea-id", default="cli-test")
    ap.add_argument("--ea-name", default="EA")
    ap.add_argument("--symbol", default="EURUSD")
    ap.add_argument("--timeframe", default="H1")
    ap.add_argument("--family", default="trend", choices=["trend", "mean_reversion", "breakout"])
    ap.add_argument("--exit-mode", default="reversal", choices=["reversal", "fixed_sltp"])
    ap.add_argument("--years", type=float, default=10.0)
    ap.add_argument("--output-md")
    args = ap.parse_args()

    out = run_pipeline(
        ea_id=args.ea_id, ea_name=args.ea_name, symbol=args.symbol,
        timeframe=args.timeframe, family=args.family, exit_mode=args.exit_mode, years=args.years,
    )
    print(f"\nFonte: {out['source']} | Trades: {out['metrics']['total_trades']}")
    print(f"WFE: {out['wfe']:.1f}% | OOS wins: {out['oosWins']}/{out['oosTotalWin']} | PF: {out['metrics']['profit_factor']}")
    print(f"Veredito: {'✅ ROBUSTA' if out['approved'] else '❌ REPROVADA'}")
    print(f"Capital recomendado: {out.get('montecarlo', {}).get('recommended_capital')}")
    if args.output_md:
        with open(args.output_md, "w", encoding="utf-8") as f:
            f.write(out["reportMd"])
        print(f"Relatório salvo: {args.output_md}")


if __name__ == "__main__":
    # Console Windows é cp1252; força UTF-8 pra emoji/acentos e pro JSON do worker.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if len(sys.argv) > 1 and sys.argv[1].startswith("--"):
        main_cli()
    else:
        main_stdin()

"""
Métricas de robustez a partir de uma lista de resultados de trades ($).
DQ Labs cap. 2: nenhuma métrica isolada conta a história — o conjunto sim.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Metrics:
    total_trades: int
    net_profit: float
    profit_factor: float
    win_rate: float          # 0..1
    payoff: float            # ganho médio / perda média
    expectancy: float        # $ esperado por trade
    max_drawdown_abs: float  # queda pico→vale em $
    max_drawdown_pct: float  # % sobre o pico de equity (a partir de capital inicial)


def compute_metrics(profits: list[float], start_capital: float = 1000.0) -> Metrics:
    n = len(profits)
    if n == 0:
        return Metrics(0, 0, 0, 0, 0, 0, 0, 0)

    gains = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]
    gross_win = sum(gains)
    gross_loss = -sum(losses)  # positivo

    net = sum(profits)
    pf = (gross_win / gross_loss) if gross_loss > 0 else float("inf") if gross_win > 0 else 0.0
    win_rate = len(gains) / n
    avg_win = (gross_win / len(gains)) if gains else 0.0
    avg_loss = (gross_loss / len(losses)) if losses else 0.0
    payoff = (avg_win / avg_loss) if avg_loss > 0 else float("inf") if avg_win > 0 else 0.0
    expectancy = net / n

    # Drawdown sobre a curva de equity (capital inicial + acumulado).
    equity = start_capital
    peak = start_capital
    max_dd_abs = 0.0
    max_dd_pct = 0.0
    for p in profits:
        equity += p
        if equity > peak:
            peak = equity
        dd = peak - equity
        if dd > max_dd_abs:
            max_dd_abs = dd
        if peak > 0:
            max_dd_pct = max(max_dd_pct, dd / peak * 100.0)

    return Metrics(
        total_trades=n,
        net_profit=round(net, 2),
        profit_factor=round(pf, 3) if pf != float("inf") else pf,
        win_rate=round(win_rate, 4),
        payoff=round(payoff, 3) if payoff != float("inf") else payoff,
        expectancy=round(expectancy, 3),
        max_drawdown_abs=round(max_dd_abs, 2),
        max_drawdown_pct=round(max_dd_pct, 2),
    )


def min_trades_required(n_params: int) -> int:
    """DQ Labs: significância mínima IS = 50 + 50 * nº de parâmetros."""
    return 50 + 50 * n_params

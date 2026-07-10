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


def equity_r_squared(equity: list[float]) -> float:
    """R² da curva de capital contra uma reta (regressão linear simples).
    1.0 = perfeitamente linear. Gate de 'curva suave ascendente'."""
    n = len(equity)
    if n < 3:
        return 0.0
    xs = range(n)
    mx = (n - 1) / 2.0
    my = sum(equity) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, equity))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in equity)
    if sxx == 0 or syy == 0:
        return 0.0
    return round((sxy * sxy) / (sxx * syy), 4)


def drawdown_of_curve(equity: list[float], start_capital: float = 1000.0) -> tuple[float, float]:
    """(dd_abs, dd_pct) da curva mark-to-market — pega o DD FLUTUANTE,
    essencial pra grid, onde o DD só-realizado mente."""
    peak = start_capital
    dd_abs = 0.0
    dd_pct = 0.0
    for v in equity:
        if v > peak:
            peak = v
        dd = peak - v
        if dd > dd_abs:
            dd_abs = dd
        if peak > 0:
            dd_pct = max(dd_pct, dd / peak * 100.0)
    return round(dd_abs, 2), round(dd_pct, 2)

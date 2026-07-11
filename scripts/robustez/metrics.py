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


# ─── Suíte completa (vocabulário do StrategyQuant databank) ───────────────────

@dataclass
class SqxMetrics:
    sharpe: float            # anualizado (retornos mensais)
    r_expectancy: float      # Van Tharp: R médio por trade
    sqn: float               # System Quality Number
    symmetry: float          # 0-100: lucro distribuído no tempo (1ª vs 2ª metade)
    ret_dd: float            # lucro líq / DD máx abs (= Recovery Factor)
    cagr: float              # % ao ano composto
    annual_return: float     # % média por ano (linear)
    avg_trades_month: float
    win_loss_ratio: float    # payoff (ganho médio / perda média)
    long_short_balance: float  # 0-100: equilíbrio long vs short (100 = perfeito)


def _months_span(dates: list[str]) -> float:
    d = [s for s in dates if s]
    if len(d) < 2:
        return 1.0
    import datetime as _dt
    try:
        a = _dt.date.fromisoformat(min(d))
        b = _dt.date.fromisoformat(max(d))
        return max(1.0, (b - a).days / 30.4375)
    except ValueError:
        return 1.0


def sqx_metrics(
    profits: list[float],
    dates: list[str],
    directions: list[int],   # +1 long / -1 short por trade (paralelo a profits)
    dd_abs: float,
    dd_pct: float,
    start_capital: float = 1000.0,
) -> SqxMetrics:
    n = len(profits)
    if n == 0:
        return SqxMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

    net = sum(profits)
    months = _months_span(dates)
    years = months / 12.0

    # Sharpe anualizado a partir de retornos mensais
    import collections
    monthly = collections.defaultdict(float)
    for p, d in zip(profits, dates):
        key = d[:7] if d else "0000-00"   # AAAA-MM
        monthly[key] += p
    mret = [v / start_capital for v in monthly.values()]
    if len(mret) >= 2:
        mu = sum(mret) / len(mret)
        var = sum((x - mu) ** 2 for x in mret) / (len(mret) - 1)
        sd = var ** 0.5
        sharpe = (mu / sd * (12 ** 0.5)) if sd > 0 else 0.0
    else:
        sharpe = 0.0

    # R-expectancy (Van Tharp) usando perda média como unidade de risco (R)
    losses = [-p for p in profits if p < 0]
    avg_loss = (sum(losses) / len(losses)) if losses else 0.0
    if avg_loss > 0:
        r_mult = [p / avg_loss for p in profits]
        mr = sum(r_mult) / n
        vr = sum((x - mr) ** 2 for x in r_mult) / n
        sr = vr ** 0.5
        r_expectancy = mr
        sqn = (mr / sr * (min(n, 100) ** 0.5)) if sr > 0 else 0.0
    else:
        r_expectancy = sqn = 0.0

    # Symmetry: lucro distribuído no tempo (1ª metade vs 2ª metade dos trades)
    half = n // 2
    p1, p2 = sum(profits[:half]), sum(profits[half:])
    denom = abs(p1) + abs(p2)
    symmetry = 100.0 * (1 - abs(p1 - p2) / denom) if denom > 0 else 0.0

    # Equilíbrio long/short (mercado real: robô que só ganha num lado é frágil)
    lp = sum(p for p, d in zip(profits, directions) if d > 0)
    sp = sum(p for p, d in zip(profits, directions) if d < 0)
    if lp > 0 and sp > 0:
        long_short_balance = 100.0 * min(lp, sp) / max(lp, sp)
    elif lp > 0 or sp > 0:
        long_short_balance = 100.0  # estratégia intencionalmente unidirecional
    else:
        long_short_balance = 0.0

    ret_dd = (net / dd_abs) if dd_abs > 0 else 0.0
    final = start_capital + net
    cagr = ((final / start_capital) ** (1 / years) - 1) * 100 if final > 0 and years > 0 else -100.0
    annual_return = (net / start_capital / years * 100) if years > 0 else 0.0
    avg_trades_month = n / months
    gains = [p for p in profits if p > 0]
    lsr = ((sum(gains) / len(gains)) / avg_loss) if gains and avg_loss > 0 else 0.0

    return SqxMetrics(
        sharpe=round(sharpe, 3),
        r_expectancy=round(r_expectancy, 3),
        sqn=round(sqn, 3),
        symmetry=round(symmetry, 2),
        ret_dd=round(ret_dd, 2),
        cagr=round(cagr, 2),
        annual_return=round(annual_return, 2),
        avg_trades_month=round(avg_trades_month, 2),
        win_loss_ratio=round(lsr, 3),
        long_short_balance=round(long_short_balance, 2),
    )

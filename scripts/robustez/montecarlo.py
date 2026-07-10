"""
Monte Carlo (DQ Labs cap. 8): embaralha a ordem dos trades milhares de vezes,
mede o drawdown de cada cenário e define o capital recomendado por perfil de
risco a partir do pior DD provável (percentil 95).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

# Perfis de risco → DD máximo tolerado (%). Decisão da spec.
RISK_PROFILES = {"conservador": 20.0, "moderado": 40.0, "agressivo": 60.0}


@dataclass
class MonteCarloResult:
    simulations: int
    dd_p50_abs: float          # DD mediano ($)
    dd_p95_abs: float          # DD do percentil 95 ($) — pior caso "realista"
    dd_max_abs: float          # pior DD observado ($)
    recommended_capital: dict[str, float] = field(default_factory=dict)


def _max_drawdown_abs(profits: list[float]) -> float:
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for p in profits:
        equity += p
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    return max_dd


def monte_carlo(
    profits: list[float],
    n_sims: int = 2000,
    seed: int = 42,
) -> MonteCarloResult:
    if not profits:
        return MonteCarloResult(0, 0, 0, 0, {k: 0.0 for k in RISK_PROFILES})

    rng = random.Random(seed)
    dds: list[float] = []
    trades = list(profits)
    for _ in range(n_sims):
        rng.shuffle(trades)
        dds.append(_max_drawdown_abs(trades))

    dds.sort()
    p50 = dds[int(0.50 * (len(dds) - 1))]
    p95 = dds[int(0.95 * (len(dds) - 1))]
    dd_max = dds[-1]

    # Capital recomendado: para o DD do p95 (em $) não estourar o DD% tolerado,
    # capital = dd_p95_abs / (dd_pct_tolerado / 100). Lote fixo ⇒ mais capital = DD% menor.
    recommended: dict[str, float] = {}
    for profile, dd_pct in RISK_PROFILES.items():
        recommended[profile] = round(p95 / (dd_pct / 100.0), 2) if dd_pct > 0 else 0.0

    return MonteCarloResult(
        simulations=n_sims,
        dd_p50_abs=round(p50, 2),
        dd_p95_abs=round(p95, 2),
        dd_max_abs=round(dd_max, 2),
        recommended_capital=recommended,
    )

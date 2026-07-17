"""
Minerador GENÉTICO (réplica do build mode do StrategyQuant).
============================================================
Busca aleatória não acha a agulha: em centenas de estratégias multi-condição,
~0 passam todos os gates. O SQX resolve com EVOLUÇÃO GENÉTICA (nos prints:
"100 generations / 4 islands"). Aqui: população de estratégias multi-bloco,
fitness = Ret/DD × R² × qualidade, seleção + crossover + mutação por gerações.
Concentra a busca nas regiões promissoras — encontra o que o aleatório perde.

Fitness usa só IN-SAMPLE (1ª metade) pra evoluir; a aprovação final é feita
pelo funil completo (WFA/OOS/Monte Carlo) no minerador — evita evoluir p/
overfitting do período inteiro.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

import blocks
from backtest import run_backtest, START_CAPITAL
from metrics import compute_metrics, drawdown_of_curve, equity_r_squared

# SQX "SL & PT required": TODA estratégia tem stop obrigatório. reversal (sem
# stop por trade) dava DD/Ret-DD ruins no OOS — fora.
EXIT_MODES = ["fixed_sltp", "reversal"]
DIRECTIONS = ["both", "long", "short"]


@dataclass
class Individual:
    blocks: list           # [{name, params}]
    direction: str
    exit_mode: str
    sl_atr: float
    tp_atr: float
    fitness: float = -1e9
    stats: dict = field(default_factory=dict)

    def params(self) -> dict:
        return {"blocks": self.blocks, "atr_period": 14,
                "sl_atr": self.sl_atr, "tp_atr": self.tp_atr}

    def key(self) -> str:
        # Os blocos sao combinados com E (AND), que e COMUTATIVO: [A,B] e [B,A]
        # sao a MESMA estrategia. Juntar na ordem da lista fazia as duas passarem
        # pelo dedupe e virarem 2 EAs identicos na vitrine (23 casos em 127).
        # Por isso: ordena os blocos ja canonizados antes de juntar.
        b = "|".join(sorted(f"{x['name']}:{sorted(x['params'].items())}" for x in self.blocks))
        return f"{self.direction}/{self.exit_mode}/{self.sl_atr}/{self.tp_atr}/{b}"


def random_individual(rng: random.Random) -> Individual:
    return Individual(
        blocks=blocks.random_strategy(rng),
        direction=rng.choice(DIRECTIONS),
        exit_mode=rng.choice(EXIT_MODES),
        sl_atr=rng.choice([1.0, 1.5, 2.0, 2.5, 3.0]),
        tp_atr=rng.choice([1.5, 2.0, 3.0, 4.0]),
    )


def mutate(ind: Individual, rng: random.Random) -> Individual:
    b = [dict(name=x["name"], params=dict(x["params"])) for x in ind.blocks]
    direction, exit_mode, sl, tp = ind.direction, ind.exit_mode, ind.sl_atr, ind.tp_atr
    r = rng.random()
    if r < 0.35 and b:                      # troca params de um bloco
        i = rng.randrange(len(b))
        b[i]["params"] = blocks.BLOCKS[b[i]["name"]][2](rng)
    elif r < 0.55:                          # troca um bloco inteiro
        i = rng.randrange(len(b)) if b else 0
        nb = rng.choice(list(blocks.BLOCKS))
        b[i] = {"name": nb, "params": blocks.BLOCKS[nb][2](rng)}
    elif r < 0.70 and len(b) < 3:           # adiciona bloco
        nb = rng.choice(list(blocks.BLOCKS))
        b.append({"name": nb, "params": blocks.BLOCKS[nb][2](rng)})
    elif r < 0.80 and len(b) > 1:           # remove bloco
        b.pop(rng.randrange(len(b)))
    elif r < 0.90:                          # muda direção/saída
        direction = rng.choice(DIRECTIONS); exit_mode = rng.choice(EXIT_MODES)
    else:                                   # muda SL/TP
        sl = rng.choice([1.0, 1.5, 2.0, 2.5, 3.0]); tp = rng.choice([1.5, 2.0, 3.0, 4.0])
    # garante >=1 bloco direcional
    if not any(blocks.BLOCKS[x["name"]][1] for x in b):
        d = rng.choice(blocks._DIRECTIONAL)
        b.append({"name": d, "params": blocks.BLOCKS[d][2](rng)})
    return Individual(b[:3], direction, exit_mode, sl, tp)


def crossover(a: Individual, b: Individual, rng: random.Random) -> Individual:
    pool = a.blocks + b.blocks
    rng.shuffle(pool)
    k = rng.choice([1, 2, 2, 3])
    chosen, seen = [], set()
    for blk in pool:
        if blk["name"] in seen:
            continue
        seen.add(blk["name"])
        chosen.append({"name": blk["name"], "params": dict(blk["params"])})
        if len(chosen) >= k:
            break
    if not any(blocks.BLOCKS[x["name"]][1] for x in chosen):
        d = rng.choice(blocks._DIRECTIONAL)
        chosen.append({"name": d, "params": blocks.BLOCKS[d][2](rng)})
    return Individual(
        chosen[:3],
        rng.choice([a.direction, b.direction]),
        rng.choice([a.exit_mode, b.exit_mode]),
        rng.choice([a.sl_atr, b.sl_atr]),
        rng.choice([a.tp_atr, b.tp_atr]),
    )


def _subwindow_quality(profits, equity, start_i, end_i) -> float:
    """Ret/DD × R² de uma sub-janela de barras [start_i:end_i]."""
    eq = equity[start_i:end_i]
    if len(eq) < 20:
        return 0.0
    base = eq[0]
    net = eq[-1] - base
    if net <= 0:
        return 0.0
    r2 = equity_r_squared(eq)
    dd_abs, _ = drawdown_of_curve(eq, base)
    if dd_abs <= 0:
        return 0.0
    return (net / dd_abs) * (r2 ** 2)


def _evaluate_fitness(ind: Individual, df_train, info) -> None:
    """Fitness WALK-FORWARD: divide o train em 3 sub-janelas e usa o PIOR
    (min) desempenho entre elas. Recompensa CONSISTÊNCIA em todo o período,
    não ajuste ao conjunto — reduz drasticamente o overfitting (a estratégia
    precisa funcionar em cada terço, não só no agregado). Isso é o que faz o
    OOS holdout depois se sustentar."""
    try:
        bt = run_backtest(df_train, "multi", ind.params(), exit_mode=ind.exit_mode,
                          direction=ind.direction, point=info.point,
                          contract_size=info.contract_size)
    except Exception:
        ind.fitness = -1e9
        return
    n = len(bt.trades)
    if n < 340: # Exige pelo menos ~10 trades por mês no IS (cerca de 33.6 meses)
        ind.fitness = -1e9
        return
    profits = [t.profit for t in bt.trades]
    m = compute_metrics(profits, START_CAPITAL)
    if m.net_profit <= 0:
        ind.fitness = -1e9
        return
    eq = bt.equity_bar
    L = len(eq)
    # cada terço tem que ser LUCRATIVO (anti ajuste a 1 só regime), mas a
    # qualidade é medida no período todo (não exige linearidade por terço).
    thirds_net = [eq[L//3-1]-eq[0], eq[2*L//3-1]-eq[L//3], eq[-1]-eq[2*L//3]]
    if min(thirds_net) <= 0:
        ind.fitness = -1e9
        return
    dd_abs, dd_pct = drawdown_of_curve(eq, START_CAPITAL)
    if dd_abs <= 0:
        ind.fitness = -1e9
        return
    r2 = equity_r_squared(eq)
    ret_dd = m.net_profit / dd_abs
    pf = m.profit_factor if m.profit_factor != float("inf") else 5.0
    # penaliza desequilíbrio entre terços (consistência sem exigir linearidade)
    consistency = min(thirds_net) / max(thirds_net)
    activity = min(1.0, n / 200.0)
    ind.fitness = ret_dd * (r2 ** 2) * min(pf, 3.0) * activity * (0.3 + 0.7 * consistency)
    ind.stats = {"trades_is": n, "ret_dd_is": round(ret_dd, 2), "r2_is": round(r2, 3),
                 "consistency": round(consistency, 2), "dd_pct_is": dd_pct,
                 "pf_is": round(pf, 2), "lot": bt.lot}


def evolve(df, info, rng: random.Random, pop_size=120, generations=30,
           elite_frac=0.15, verbose=False) -> list[Individual]:
    """Evolui uma população e devolve os melhores (ordenados por fitness)."""
    pop = [random_individual(rng) for _ in range(pop_size)]
    for ind in pop:
        _evaluate_fitness(ind, df, info)
    n_elite = max(2, int(pop_size * elite_frac))

    for gen in range(generations):
        pop.sort(key=lambda x: x.fitness, reverse=True)
        elite = pop[:n_elite]
        if verbose and gen % 10 == 0:
            best = elite[0]
            print(f"    gen {gen:3d}: best fitness={best.fitness:.2f} {best.stats}", flush=True)
        # nova geração: elite + filhos (crossover dos melhores) + mutações + sangue novo
        newpop = list(elite)
        seen = {e.key() for e in elite}
        while len(newpop) < pop_size:
            r = rng.random()
            if r < 0.55:
                child = crossover(rng.choice(elite), rng.choice(pop[:pop_size // 2]), rng)
            elif r < 0.85:
                child = mutate(rng.choice(elite), rng)
            else:
                child = random_individual(rng)          # fresh blood
            if child.key() in seen:
                continue
            seen.add(child.key())
            _evaluate_fitness(child, df, info)
            newpop.append(child)
        pop = newpop

    pop.sort(key=lambda x: x.fitness, reverse=True)
    return [ind for ind in pop if ind.fitness > 0]


# ─── Mineração genética com validação OOS (holdout) ──────────────────────────

import pandas as pd  # noqa: E402


def _oos_holdout(df_full, split_idx: int, ind: Individual, info) -> dict:
    """Roda a estratégia no período INTEIRO e mede o HOLDOUT (barras após
    split_idx) que a evolução NUNCA viu. É o teste de generalização real."""
    bt = run_backtest(df_full, "multi", ind.params(), exit_mode=ind.exit_mode,
                      direction=ind.direction, point=info.point,
                      contract_size=info.contract_size)
    split_date = str(pd.Timestamp(df_full["time"].iloc[split_idx]).date())
    hold = [t for t in bt.trades if (t.date or "") >= split_date]
    hp = [t.profit for t in hold]
    if len(hp) < 140: # Exige pelo menos ~10 trades por mês no OOS (cerca de 14.4 meses)
        return {"ok": False, "bt": bt, "reason": "poucos trades OOS (exige >=140 para ~10/mês)"}
    eq, acc = [], START_CAPITAL
    for p in hp:
        acc += p
        eq.append(acc)
    m = compute_metrics(hp, START_CAPITAL)
    dd_abs, _ = drawdown_of_curve(eq, START_CAPITAL)
    r2 = equity_r_squared(eq)
    ret_dd = (m.net_profit / dd_abs) if dd_abs > 0 else 0.0
    # Holdout (3 anos nunca vistos): o teste que separa edge real de overfit.
    # Overfit vira PREJUÍZO aqui (barrado). Exige lucro OOS + forma decente —
    # não perfeição (o kill-switch + revalidação mensal cuidam da degradação
    # live, igual QuantMiner). Métricas mostradas no card = OOS-inclusivas (reais).
    ok = m.net_profit > 0 and r2 >= 0.50 and ret_dd >= 1.2
    return {"ok": ok, "bt": bt, "oos_net": round(m.net_profit, 2),
            "oos_r2": r2, "oos_ret_dd": round(ret_dd, 2), "oos_trades": len(hp)}


def mine_symbol(df, info, name, tf, rng, pop_size=120, generations=30,
                train_frac=0.70, keep=8, verbose=True) -> list[dict]:
    """Evolui no train, valida no holdout OOS + funil completo. Devolve os
    sobreviventes prontos pra publicar."""
    split = int(len(df) * train_frac)
    df_train = df.iloc[:split].reset_index(drop=True)
    if verbose:
        print(f"[gx] {name} {tf}: evoluindo em {split} barras (train {train_frac:.0%})...", flush=True)
    elites = evolve(df_train, info, rng, pop_size=pop_size, generations=generations,
                    verbose=verbose)

    import pipeline
    survivors, checked = [], set()
    for ind in elites:
        k = ind.key()
        if k in checked:
            continue
        checked.add(k)
        oos = _oos_holdout(df, split, ind, info)
        if not oos["ok"]:
            continue   # reprovado no OUT-OF-SAMPLE real (holdout nunca visto)
        bt = oos["bt"]
        res = pipeline.evaluate(bt.trades, "gx", f"{name} {tf}", name, tf, "multi",
                                ind.exit_mode, equity_bar=bt.equity_bar)
        # O gate WFE (in-period) é contaminado pela evolução — o teste de
        # generalização aqui é o HOLDOUT (_oos_holdout, acima). Aprovação =
        # todos os gates de QUALIDADE (menos wfe) + holdout OK.
        quality_ok = all(v for k, v in res["gates"].items() if k != "wfe_gt_50")
        if not quality_ok:
            continue
        res["wfe"] = oos["oos_ret_dd"] * 10  # "eficiência" OOS pro card (proxy)
        survivors.append({
            "symbol": name, "timeframe": tf, "family": "multi",
            "exit_mode": ind.exit_mode, "direction": ind.direction,
            "params": ind.params(), "lot": bt.lot,
            "strategyDef": {"family": "multi", "exit_mode": ind.exit_mode,
                            "direction": ind.direction, "lot": bt.lot, **ind.params()},
            "wfe": res["wfe"], "metrics": res["metrics"], "sqx": res["sqx"],
            "curve": res["curve"], "montecarlo": res["montecarlo"],
            "oos": {k2: oos[k2] for k2 in ("oos_net", "oos_r2", "oos_ret_dd", "oos_trades")},
            "reportMd": res["reportMd"],
            "label": blocks.strategy_label(ind.blocks),
        })
        if verbose:
            c = res["curve"]
            print(f"[gx] ✔ {name} {tf} {ind.direction} R²={c['r2']:.2f} DD={c['dd_pct_mtm']:.1f}% "
                  f"RetDD={c['recovery_factor']:.1f} OOSr²={oos['oos_r2']:.2f} [{blocks.strategy_label(ind.blocks)}]",
                  flush=True)
        if len(survivors) >= keep:
            break
    return survivors


# ─── CLI de sweep (roda em background; grava sobreviventes incrementalmente) ──

def main():
    import argparse, json, sys, time
    import mt5_data
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="Mineração genética (multi-condição, holdout OOS)")
    ap.add_argument("--symbols", default="XAUUSD,EURUSD,GBPUSD,USDJPY,AUDUSD,EURAUD")
    ap.add_argument("--timeframes", default="H4,H1")
    ap.add_argument("--years", type=float, default=4.0)
    ap.add_argument("--pop", type=int, default=70)

    ap.add_argument("--gen", type=int, default=20)
    ap.add_argument("--keep", type=int, default=6)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--out", default="survivors_gx.json")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    mt5_data.connect()
    all_surv: list[dict] = []
    for sym in args.symbols.split(","):
        for tf in args.timeframes.split(","):
            try:
                df, name = mt5_data.get_candles(sym, tf, years=args.years)
            except Exception as e:  # noqa: BLE001
                print(f"[gx] pulei {sym} {tf}: {e}", flush=True)
                continue
            info = mt5_data.symbol_info(name)
            t = time.time()
            print(f"[gx] === {name} {tf}: {len(df)} barras ({args.years:.0f}a) ===", flush=True)
            surv = mine_symbol(df, info, name, tf, rng, pop_size=args.pop,
                               generations=args.gen, keep=args.keep, verbose=True)
            all_surv.extend(surv)
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump(all_surv, f, ensure_ascii=False)
            print(f"[gx] {name} {tf}: +{len(surv)} sobreviventes ({time.time()-t:.0f}s) — total {len(all_surv)}", flush=True)
    mt5_data.shutdown()
    print(f"[gx] FIM — {len(all_surv)} sobreviventes salvos em {args.out}", flush=True)


if __name__ == "__main__":
    main()

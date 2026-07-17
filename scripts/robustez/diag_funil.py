"""
Diagnóstico do FUNIL de mineração — onde os candidatos estão morrendo?
=====================================================================
Roda uma evolução normal e, em vez de descartar em silêncio, registra POR QUE
cada elite foi eliminado: no holdout OOS ou em qual gate específico.

Existe porque a mineração de USDJPY rodou 7h / 49 rodadas e devolveu ZERO
sobreviventes — com fitness in-sample ótimo (Ret/DD 6.5, R² 0.95). Ou o ativo
não tem edge no espaço de blocos, ou algum gate ficou impossível.

Uso:
    python diag_funil.py --symbol USDJPY --timeframe H1 --pop 70 --gen 20
"""
from __future__ import annotations

import argparse
import os
import random
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbol", default="USDJPY")
    ap.add_argument("--timeframe", default="H1")
    ap.add_argument("--years", type=float, default=4.0)
    ap.add_argument("--pop", type=int, default=70)
    ap.add_argument("--gen", type=int, default=20)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    import mt5_data
    import genetic
    import pipeline
    from backtest import run_backtest

    mt5_data.connect()
    df, name = mt5_data.get_candles(args.symbol, args.timeframe, years=args.years)
    info = mt5_data.symbol_info(name)
    mt5_data.shutdown()

    split = int(len(df) * 0.70)
    df_train = df.iloc[:split].reset_index(drop=True)
    rng = random.Random(args.seed)
    print(f"[diag] {name} {args.timeframe}: {len(df)} barras | evoluindo em {split}\n")

    elites = genetic.evolve(df_train, info, rng, pop_size=args.pop,
                            generations=args.gen, verbose=False)
    print(f"[diag] {len(elites)} elites saíram da evolução\n")

    mortes = Counter()
    detalhes = []
    for ind in elites:
        oos = genetic._oos_holdout(df, split, ind, info)
        rotulo = " + ".join(sorted(b["name"] for b in ind.blocks))
        if not oos["ok"]:
            r = oos.get("reason")
            if r:
                mortes["holdout: " + r] += 1
                detalhes.append((rotulo, "holdout", r, None))
            else:
                # net<=0 | r2<0.50 | ret_dd<1.2 — qual foi?
                quais = []
                if oos.get("oos_net", 0) <= 0: quais.append(f"lucro OOS {oos.get('oos_net')}")
                if oos.get("oos_r2", 0) < 0.50: quais.append(f"R² OOS {oos.get('oos_r2')}")
                if oos.get("oos_ret_dd", 0) < 1.2: quais.append(f"Ret/DD OOS {oos.get('oos_ret_dd')}")
                for q in quais: mortes["holdout: " + q.split()[0] + " " + q.split()[1]] += 1
                detalhes.append((rotulo, "holdout", ", ".join(quais), oos))
            continue

        bt = oos["bt"]
        res = pipeline.evaluate(bt.trades, "diag", "diag", name, args.timeframe,
                                "multi", ind.exit_mode, equity_bar=bt.equity_bar,
                                start_capital=bt.start_capital)
        falhou = [k for k, v in res["gates"].items() if not v and k != "wfe_gt_50"]
        if falhou:
            for f in falhou:
                mortes["gate: " + f] += 1
            detalhes.append((rotulo, "gates", ", ".join(falhou), res))
        else:
            mortes["PASSOU"] += 1
            detalhes.append((rotulo, "PASSOU", "", res))

    print("=" * 66)
    print(" ONDE OS CANDIDATOS MORRERAM")
    print("=" * 66)
    for motivo, n in mortes.most_common():
        print(f"  {n:3d}x  {motivo}")

    print("\n" + "=" * 66)
    print(" DETALHE POR ELITE")
    print("=" * 66)
    for rotulo, fase, motivo, obj in detalhes:
        marca = "OK " if fase == "PASSOU" else "XX "
        print(f" {marca}[{rotulo}]")
        if fase != "PASSOU":
            print(f"      morreu em {fase}: {motivo}")
        if obj and fase == "gates":
            m = obj["metrics"]
            print(f"      trades {m['total_trades']} | DD {m['max_drawdown_pct']:.1f}% | "
                  f"PF {m['profit_factor']:.2f} | R² {obj['curve']['r2']:.2f}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()

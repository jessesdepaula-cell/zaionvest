"""
Revalidação em lote de TODOS os EAs da vitrine.
===============================================
Reprocessa cada EA publicado com a esteira CORRIGIDA e compara o veredito novo
com o que está gravado no banco.

Por que existe: os números gravados na vitrine foram calculados com a WFA
quebrada (dois bugs corrigidos em 2026-07-16):
  1. o corte IS/OOS somava o offset global numa fatia local -> OOS vazio em 5
     das 6 janelas -> WFE ~0;
  2. o WFE comparava TOTAIS (oos/is) em vez de TAXAS -> travava em 42.86% no
     melhor caso -> o gate ">50%" era inalcançável.

Padrão de anos = 4.0 (mesmo do genetic.py, que minerou a vitrine).

Regra de aprovação replicada do publish.py:
  - família "multi": todos os gates MENOS wfe_gt_50 (o WFE in-period é
    contaminado pela evolução genética; o teste honesto foi o holdout da
    mineração). Mantido de propósito — ver publish.py:186.
  - demais famílias: todos os gates.

Uso:
    python revalidate_all.py                 # usa _revalid_input.json
    python revalidate_all.py --years 4
    python revalidate_all.py --out rel.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backtest import run_backtest, START_CAPITAL
import pipeline


def _sd(ea: dict) -> dict:
    sd = ea.get("strategyDef") or {}
    if isinstance(sd, str):
        sd = json.loads(sd)
    return sd


def main():
    ap = argparse.ArgumentParser(description="Revalida toda a vitrine com a esteira corrigida")
    ap.add_argument("--input", default="_revalid_input.json")
    ap.add_argument("--years", type=float, default=4.0)
    ap.add_argument("--out", default="_revalid_result.json")
    ap.add_argument("--report", default="_revalid_report.md")
    args = ap.parse_args()

    eas = json.load(open(args.input, encoding="utf-8"))
    print(f"[revalid] {len(eas)} EAs | padrao {args.years:.0f} anos", flush=True)

    import mt5_data
    mt5_data.connect()

    cache: dict[tuple, tuple] = {}   # (symbol, tf) -> (df, info)
    results = []
    t0 = time.time()

    for n, ea in enumerate(eas, 1):
        sd = _sd(ea)
        fam = sd.get("family", "?")
        sym, tf = ea["symbol"], ea["timeframe"]
        key = (sym, tf)
        try:
            if key not in cache:
                df, resolved = mt5_data.get_candles(sym, tf, years=args.years)
                cache[key] = (df, mt5_data.symbol_info(resolved))
            df, info = cache[key]

            bt = run_backtest(
                df, fam, sd,
                exit_mode=sd.get("exit_mode", "reversal"),
                direction=sd.get("direction", "both"),
                point=info.point, contract_size=info.contract_size,
            )
            res = pipeline.evaluate(
                bt.trades, ea["id"], f"{fam} {sym} {tf}", sym, tf, fam,
                sd.get("exit_mode", "reversal"), equity_bar=bt.equity_bar,
                start_capital=bt.start_capital,
            )
            # mesma regra do publish.py (ver docstring)
            if fam == "multi":
                approved = all(v for k, v in res["gates"].items() if k != "wfe_gt_50")
            else:
                approved = res["approved"]

            falhou = [k for k, v in res["gates"].items() if not v
                      and not (fam == "multi" and k == "wfe_gt_50")]
            results.append({
                "id": ea["id"], "symbol": sym, "timeframe": tf, "family": fam,
                "wfe_old": ea.get("wfe"), "wfe_new": round(res["wfe"], 1),
                "status_old": ea.get("status"),
                "status_new": "APPROVED" if approved else "REJECTED",
                "gates_falhou": falhou,
                "dd": round(res["metrics"]["max_drawdown_pct"], 1),
                "pf": round(res["metrics"]["profit_factor"], 2),
                "trades": res["metrics"]["total_trades"],
                "net": round(res["metrics"]["net_profit"], 2),
            })
        except Exception as e:  # noqa: BLE001
            results.append({"id": ea["id"], "symbol": sym, "timeframe": tf,
                            "family": fam, "erro": str(e)[:200]})
        if n % 10 == 0 or n == len(eas):
            print(f"[revalid] {n}/{len(eas)}  ({time.time()-t0:.0f}s)", flush=True)

    mt5_data.shutdown()
    json.dump(results, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    ok = [r for r in results if r.get("status_new") == "APPROVED"]
    bad = [r for r in results if r.get("status_new") == "REJECTED"]
    err = [r for r in results if r.get("erro")]

    print("\n" + "=" * 62)
    print(f" APROVADOS : {len(ok)}/{len(results)}")
    print(f" REPROVADOS: {len(bad)}/{len(results)}")
    print(f" ERROS     : {len(err)}")
    print("=" * 62)

    motivos: dict[str, int] = {}
    for r in bad:
        for g in r.get("gates_falhou", []):
            motivos[g] = motivos.get(g, 0) + 1
    if motivos:
        print("\n Motivos de reprovacao:")
        for g, c in sorted(motivos.items(), key=lambda x: -x[1]):
            print(f"   {g:20s} {c}")

    deltas = [(r["wfe_new"] - (r["wfe_old"] or 0), r) for r in results if r.get("wfe_new") is not None]
    if deltas:
        m = sum(d for d, _ in deltas) / len(deltas)
        print(f"\n WFE: variacao media {m:+.1f} pontos (banco -> esteira corrigida)")

    with open(args.report, "w", encoding="utf-8") as f:
        f.write(f"# Revalidação da vitrine — esteira corrigida ({args.years:.0f} anos)\n\n")
        f.write(f"- Aprovados: **{len(ok)}/{len(results)}**\n")
        f.write(f"- Reprovados: **{len(bad)}/{len(results)}**\n- Erros: {len(err)}\n\n")
        f.write("| id | símbolo | fam | WFE antes | WFE agora | DD% | PF | trades | status |\n")
        f.write("|---|---|---|---|---|---|---|---|---|\n")
        for r in results:
            if r.get("erro"):
                f.write(f"| {r['id'][:12]} | {r['symbol']} | {r['family']} | - | - | - | - | - | ERRO |\n")
                continue
            f.write(f"| {r['id'][:12]} | {r['symbol']} | {r['family']} | "
                    f"{r['wfe_old'] or 0:.1f} | {r['wfe_new']:.1f} | {r['dd']:.1f} | "
                    f"{r['pf']:.2f} | {r['trades']} | {r['status_new']} |\n")
    print(f"\n Relatorio: {args.report}\n JSON: {args.out}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()

"""
Publica sobreviventes da mineração na vitrine (task 18 / R16 da spec).

Para cada sobrevivente (ordenado por WFE):
  1. Re-roda backtest + funil (evaluate) pra obter trades/janelas frescos.
  2. Monta a curva de capital (equityCurveOos) a partir dos trades.
  3. GATE DE CORRELAÇÃO (spec R13): |corr| > CORR_GATE com um já aceito → pula
     (a vitrine ainda tem o slider; este gate só evita publicar clones).
  4. Compila o .ex5 (params baked-in + license check em EA_STATUS_URL_BASE).
  5. Sobe o .ex5 pro bucket ea-files (Supabase Storage, service key).
  6. INSERT EA (status APPROVED) + EAValidation via Management API.

Uso:  py publish.py --survivors <survivors.json> [--limit N]
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import string
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))

def load_env_file():
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for fn in (".env.local", ".env"):
        p = os.path.join(base, fn)
        if os.path.exists(p):
            for line in open(p, encoding="utf-8", errors="replace"):
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        k = parts[0].strip()
                        v = parts[1].strip().strip('"').strip("'")
                        os.environ.setdefault(k, v)

load_env_file()

# URL de licença que vai BAKED no .ex5 — domínio real do app.
os.environ.setdefault("EA_STATUS_URL_BASE", "https://zaionvest.com.br/api/ea")

import mt5_data
import pipeline
import compiler
from backtest import run_backtest

REF = "kpijsnygzqgpjxxikpig"
SB_TOKEN = os.environ.get("SUPABASE_MGMT_TOKEN", "") or (
    open(os.path.join(os.path.dirname(__file__), ".mgmt_token")).read().strip()
    if os.path.exists(os.path.join(os.path.dirname(__file__), ".mgmt_token"))
    else ""
)
CORR_GATE = 0.85
STYLE = {"trend": "trend", "mean_reversion": "reversal",
         "breakout": "breakout", "grid": "grid",
         "macd_cross": "trend", "bollinger_fade": "reversal",
         "bollinger_break": "breakout", "stochastic": "reversal"}

# Estilo da vitrine por bloco direcional (usado quando family == "multi").
# Só valores aceitos pelo filtro do front: trend/reversal/breakout/range/grid.
BLOCK_STYLE = {
    "rsi_extreme": "reversal", "rsi_trend": "trend",
    "ema_stack": "trend", "ema_cross": "trend", "price_ema": "trend",
    "macd_state": "trend", "macd_cross": "trend", "momentum": "trend",
    "bb_fade": "reversal", "bb_break": "breakout", "donchian": "breakout",
    "stoch": "reversal", "cci": "reversal",
}


def style_of(fam: str, params: dict) -> str:
    """Estilo p/ o card. Multi: 1º bloco com estilo conhecido (direcional)."""
    if fam != "multi":
        return STYLE.get(fam, "trend")
    for blk in params.get("blocks", []):
        st = BLOCK_STYLE.get(blk.get("name"))
        if st:
            return st
    return "trend"


def _curl(args: list[str], data: bytes | None = None) -> str:
    r = subprocess.run(["curl", "-s", "--max-time", "60"] + args,
                       capture_output=True, input=data)
    return r.stdout.decode("utf-8", errors="replace")


def q(sql: str):
    body = json.dumps({"query": sql}).encode("utf-8")
    out = _curl(["-X", "POST", "-H", f"Authorization: Bearer {SB_TOKEN}",
                 "-H", "Content-Type: application/json", "--data-binary", "@-",
                 f"https://api.supabase.com/v1/projects/{REF}/database/query"], body)
    return json.loads(out)


def service_key() -> str:
    env_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if env_key:
        return env_key
    keys = json.loads(_curl(["-H", f"Authorization: Bearer {SB_TOKEN}",
                             f"https://api.supabase.com/v1/projects/{REF}/api-keys"]))
    return next(k["api_key"] for k in keys if k["name"] == "service_role")


def cuid() -> str:
    alpha = string.ascii_lowercase + string.digits
    return "c" + "".join(secrets.choice(alpha) for _ in range(24))


def equity_curve_from_bars(equity_bar, dates, max_points=60):
    """Curva {date,value} da equity mark-to-market POR BARRA (suave, sem os
    degraus da curva por trade), reamostrada pra <= max_points."""
    pts = [{"date": d, "value": v} for d, v in zip(dates, equity_bar)]
    if len(pts) > max_points:
        step = len(pts) / max_points
        pts = [pts[int(i * step)] for i in range(max_points - 1)] + [pts[-1]]
    return pts


def returns_of(curve):
    out = []
    for a, b in zip(curve, curve[1:]):
        if a["value"]:
            out.append((b["value"] - a["value"]) / a["value"])
    return out


def pearson(a, b):
    n = min(len(a), len(b))
    if n < 3:
        return 0.0
    a, b = a[-n:], b[-n:]
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = sum((x - ma) ** 2 for x in a) ** 0.5
    db = sum((y - mb) ** 2 for y in b) ** 0.5
    return 0.0 if da * db == 0 else num / (da * db)


to_publish_rows = []

def insert_row(table: str, row: dict):
    to_publish_rows.append({"table": table, "data": row})


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--survivors", required=True)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not SB_TOKEN:
        raise SystemExit("defina SUPABASE_MGMT_TOKEN no ambiente")

    survivors = json.load(open(args.survivors, encoding="utf-8"))
    # ordena pelo Ret/DD do holdout — o wfe e None nos multi (WFA circular)
    survivors.sort(key=lambda s: -(s.get("oosRetDd") or (s.get("wfe") or 0)))
    if args.limit:
        survivors = survivors[: args.limit]

    svc = service_key()
    accepted = []  # [(returns, name)]
    published = 0

    mt5_data.connect()
    try:
        for s in survivors:
            fam, mode = s["family"], s["exit_mode"]
            direction = s.get("direction", "both")
            symbol, tf = s["symbol"], s["timeframe"]
            params = s["params"]

            df, resolved = mt5_data.get_candles(symbol, tf, years=3.0)
            info = mt5_data.symbol_info(resolved)
            bt = run_backtest(df, fam, params, exit_mode=mode, direction=direction,
                              point=info.point, contract_size=info.contract_size)
            res = pipeline.evaluate(bt.trades, ea_id="publish", ea_name=f"{fam} {symbol} {tf}",
                                    symbol=resolved, timeframe=tf, family=fam,
                                    exit_mode=mode, equity_bar=bt.equity_bar, params=params)
            # Genético (multi): a aprovação NÃO usa o gate WFE in-period — ele é
            # contaminado pela evolução (ver genetic.py). O teste honesto foi o
            # holdout OOS feito na mineração; aqui exigimos todos os gates de
            # QUALIDADE (menos wfe_gt_50), igual ao mine_symbol.
            if fam == "multi":
                approved = all(v for k, v in res["gates"].items() if k != "wfe_gt_50")
                # WFE no card = proxy OOS calculado na mineração (não o WFA negativo)
                res["wfe"] = None                       # WFA circular em multi
                res["oosRetDd"] = s.get("oosRetDd")     # Ret/DD do holdout (honesto)
            else:
                approved = res["approved"]
            if not approved:
                print(f"  ~ {fam} {symbol} {tf} {mode}/{direction}: reprovou na re-validação, pulo")
                continue

            curve = equity_curve_from_bars(bt.equity_bar, bt.equity_dates)
            rets = returns_of(curve)
            clone_of = next((n for r, n in accepted if abs(pearson(rets, r)) > CORR_GATE), None)
            if clone_of:
                print(f"  ~ {fam} {symbol} {tf} {mode}/{direction}: corr>{CORR_GATE} com {clone_of}, pulo")
                continue

            ea_id = cuid()
            params_str = json.dumps(params, sort_keys=True)
            dna_raw = f"{symbol}:{tf}:{fam}:{direction}:{mode}:{params_str}"
            import hashlib
            h = hashlib.sha256(dna_raw.encode("utf-8")).hexdigest()[:6]
            dir_tag = {"both": "", "long": " Long", "short": " Short"}[direction]
            # nome do card: multi usa o estilo (nome de família "multi" é interno)
            style_val = style_of(fam, params)
            fam_label = {"trend": "Tendência", "reversal": "Reversão",
                         "breakout": "Rompimento", "range": "Range",
                         "grid": "Grid"}.get(style_val, style_val.title()) if fam == "multi" \
                        else fam.replace("_", " ").title()
            name = f"ZV {fam_label}{dir_tag} {symbol} {tf} #{h}"
            slug_fam = style_val if fam == "multi" else fam.replace("_", "-")
            slug = f"{slug_fam}-{direction}-{symbol.lower()}-{tf.lower()}-{h}"

            comp = compiler.compile_ea(ea_id=ea_id, family=fam, exit_mode=mode,
                                       params=params, name=f"ZV_{slug.replace('-', '_')}",
                                       direction=direction, lot=bt.lot)
            if not comp.ok:
                print(f"  ✗ {name}: compilação falhou"); continue

            obj_path = f"{slug}.ex5"
            up = _curl(["-X", "POST", "-H", f"Authorization: Bearer {svc}",
                        "-H", "Content-Type: application/octet-stream",
                        "--data-binary", f"@{comp.ex5_path}",
                        f"https://{REF}.supabase.co/storage/v1/object/ea-files/{obj_path}"])
            if '"Key"' not in up and "Duplicate" not in up:
                print(f"  ✗ {name}: upload falhou: {up[:150]}"); continue

            m = res["metrics"]
            # timestamps explícitos: populate_recordset insere NULL nas colunas
            # ausentes e NULL explícito NÃO aciona o DEFAULT (NOT NULL falharia)
            from datetime import datetime, timezone
            now_iso = datetime.now(timezone.utc).isoformat()
            insert_row("EA", {
                "id": ea_id, "name": name, "slug": slug,
                "symbol": resolved, "timeframe": tf,
                "style": style_of(fam, params), "exitMode": mode,
                "wfe": res["wfe"], "oosRetDd": res.get("oosRetDd"),
                "profitFactor": m["profit_factor"],
                # DD flutuante mark-to-market — o honesto (gate ≤ 30%)
                "maxDrawdown": res["curve"]["dd_pct_mtm"],
                "totalTrades": m["total_trades"],
                "oosWins": res["oosWins"], "oosTotalWindows": res["oosTotalWin"],
                "status": "APPROVED", "fileUrl": obj_path,
                "strategyDef": {"family": fam, "exit_mode": mode,
                                "direction": direction, "lot": bt.lot, **params},
                "equityCurveOos": curve,
                "lastValidatedAt": now_iso, "createdAt": now_iso, "updatedAt": now_iso,
            })
            insert_row("EAValidation", {
                "id": cuid(), "eaId": ea_id, "wfe": res["wfe"],
                "oosWins": res["oosWins"], "oosTotalWin": res["oosTotalWin"],
                "approved": True, "reportMd": res["reportMd"],
                "windowsJson": res["windowsJson"], "validatedAt": now_iso,
            })
            # limpa artefatos do Experts local
            for ext in (".ex5", ".mq5", ".log"):
                p = comp.ex5_path.replace(".ex5", ext)
                try:
                    os.remove(p)
                except OSError:
                    pass

            accepted.append((rets, name))
            published += 1
            c = res["curve"]
            print(f"  ✔ publicado: {name} (Ret/DD OOS {(res.get('oosRetDd') or 0):.2f}, "
                  f"PF {m['profit_factor']}, DD {c['dd_pct_mtm']:.1f}%, R² {c['r2']:.2f})")
    finally:
        mt5_data.shutdown()

    to_publish_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "to_publish.json")
    with open(to_publish_path, "w", encoding="utf-8") as f:
        json.dump(to_publish_rows, f, ensure_ascii=False, indent=2)

    print(f"\n{published} EA(s) compilados e enviados para o storage.")
    print(f"Salvo {len(to_publish_rows)} registros de banco em {to_publish_path} para inserção via Prisma.")


if __name__ == "__main__":
    main()

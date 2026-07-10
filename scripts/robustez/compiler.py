"""
Compilador de EA (Modelo A): renderiza o template .mq5 com os params baked-in
de uma estratégia aprovada e compila para .ex5 via MetaEditor64 do RoboForex.

Envs:
  MT5_METAEDITOR    — caminho do MetaEditor64.exe
  MT5_EXPERTS_DIR   — pasta MQL5/Experts do terminal RoboForex (destino do .mq5/.ex5)
  EA_STATUS_URL_BASE— base do endpoint de licença (ex: https://app/api/ea)
"""
from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass

_HERE = os.path.dirname(__file__)
TEMPLATE = os.path.join(_HERE, "templates", "qm_ea_template.mq5")

METAEDITOR = os.environ.get(
    "MT5_METAEDITOR",
    r"C:\Program Files\RoboForex MT5 Terminal\MetaEditor64.exe",
)
EXPERTS_DIR = os.environ.get(
    "MT5_EXPERTS_DIR",
    r"C:\Users\Jesse\AppData\Roaming\MetaQuotes\Terminal"
    r"\5FFA568149E88FCD5B44D926DCFEAA79\MQL5\Experts",
)
STATUS_URL_BASE = os.environ.get("EA_STATUS_URL_BASE", "https://zaionvest.com.br/api/ea")

FAMILY_CODE = {"trend": 0, "mean_reversion": 1, "breakout": 2, "grid": 3}
EXIT_CODE = {"reversal": 0, "fixed_sltp": 1}
DIRECTION_CODE = {"both": 0, "long": 1, "short": 2}

# Defaults por token — garante que todo placeholder é substituído mesmo se o
# param não vier no dict da estratégia.
_TOKEN_DEFAULTS = {
    "EMA_FAST": 12, "EMA_SLOW": 48, "EMA_FILTER": 200,
    "RSI_PERIOD": 14, "RSI_OS": 30, "RSI_OB": 70,
    "LOOKBACK": 20, "ATR_PERIOD": 14, "SL_ATR": 2.0, "TP_ATR": 3.0,
    "GRID_SPACING": 1.0, "GRID_LEVELS": 4, "GRID_TP": 0.5,
}


@dataclass
class CompileResult:
    ok: bool
    ex5_path: str | None
    mq5_path: str
    log: str


def _magic_of(ea_id: str) -> int:
    """Magic number determinístico do id (distingue as posições deste EA)."""
    h = 0
    for ch in ea_id:
        h = (h * 131 + ord(ch)) % 2_000_000_000
    return 100_000_000 + h % 900_000_000


def render(ea_id: str, family: str, exit_mode: str, params: dict,
           direction: str = "both", lot: float = 0.1) -> str:
    tpl = open(TEMPLATE, encoding="utf-8").read()
    subs = {
        "__EA_ID__": ea_id,
        "__STATUS_URL__": f"{STATUS_URL_BASE}/{ea_id}/status",
        "__FAMILY__": FAMILY_CODE[family],
        "__EXIT_MODE__": EXIT_CODE[exit_mode],
        "__DIRECTION__": DIRECTION_CODE.get(direction, 0),
        "__LOT__": lot,
        "__MAGIC__": _magic_of(ea_id),
    }
    for key, default in _TOKEN_DEFAULTS.items():
        subs[f"__{key}__"] = params.get(key.lower(), default)
    for token, val in subs.items():
        tpl = tpl.replace(token, str(val))
    return tpl


def _read_log(path: str) -> str:
    for enc in ("utf-16", "utf-16-le", "utf-8", "cp1252"):
        try:
            return open(path, encoding=enc).read()
        except (UnicodeError, FileNotFoundError):
            continue
    return ""


def compile_ea(
    ea_id: str, family: str, exit_mode: str, params: dict,
    name: str | None = None, direction: str = "both", lot: float = 0.1,
) -> CompileResult:
    name = name or f"QM_{ea_id}".replace("-", "_")
    os.makedirs(EXPERTS_DIR, exist_ok=True)
    mq5 = os.path.join(EXPERTS_DIR, f"{name}.mq5")
    ex5 = os.path.join(EXPERTS_DIR, f"{name}.ex5")
    log = os.path.join(EXPERTS_DIR, f"{name}.log")

    with open(mq5, "w", encoding="utf-8") as f:
        f.write(render(ea_id, family, exit_mode, params, direction, lot))

    before = os.path.getmtime(ex5) if os.path.exists(ex5) else 0
    # MetaEditor compila em modo CLI e grava um log.
    subprocess.run(
        [METAEDITOR, f"/compile:{mq5}", f"/log:{log}"],
        timeout=120, capture_output=True,
    )
    after = os.path.getmtime(ex5) if os.path.exists(ex5) else 0
    ok = os.path.exists(ex5) and after > before
    return CompileResult(ok=ok, ex5_path=ex5 if ok else None, mq5_path=mq5, log=_read_log(log))


if __name__ == "__main__":
    import argparse, json
    ap = argparse.ArgumentParser(description="Compila um EA da vitrine para .ex5")
    ap.add_argument("--ea-id", default="TEST-0001")
    ap.add_argument("--family", default="trend", choices=list(FAMILY_CODE))
    ap.add_argument("--exit-mode", default="reversal", choices=list(EXIT_CODE))
    ap.add_argument("--params", default="{}", help="JSON com params baked-in")
    args = ap.parse_args()

    res = compile_ea(args.ea_id, args.family, args.exit_mode, json.loads(args.params))
    print("OK:", res.ok)
    print("ex5:", res.ex5_path)
    if not res.ok:
        print("--- log ---")
        print(res.log[-2000:])

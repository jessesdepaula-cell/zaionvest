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
MULTI_TEMPLATE = os.path.join(_HERE, "templates", "qm_multi_template.mq5")

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

FAMILY_CODE = {"trend": 0, "mean_reversion": 1, "breakout": 2, "grid": 3,
               "macd_cross": 4, "bollinger_fade": 5, "bollinger_break": 6,
               "stochastic": 7}
EXIT_CODE = {"reversal": 0, "fixed_sltp": 1}
DIRECTION_CODE = {"both": 0, "long": 1, "short": 2}

# Defaults por token — garante que todo placeholder é substituído mesmo se o
# param não vier no dict da estratégia.
_TOKEN_DEFAULTS = {
    "EMA_FAST": 12, "EMA_SLOW": 48, "EMA_FILTER": 200,
    "RSI_PERIOD": 14, "RSI_OS": 30, "RSI_OB": 70,
    "LOOKBACK": 20, "ATR_PERIOD": 14, "SL_ATR": 2.0, "TP_ATR": 3.0,
    "GRID_SPACING": 1.0, "GRID_LEVELS": 4, "GRID_TP": 0.5,
    "MACD_FAST": 12, "MACD_SLOW": 26, "MACD_SIGNAL": 9,
    "BB_PERIOD": 20, "BB_DEV": 2.0,
    "STOCH_K": 14, "STOCH_SMOOTH": 3, "STOCH_OS": 20, "STOCH_OB": 80,
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


# ─── Geração de EA MULTI-BLOCO (estilo StrategyQuant) ─────────────────────────
# O corpo do RawSignal() e a init de handles são GERADOS a partir da lista de
# blocos, espelhando bloco-a-bloco blocks.py / build_signals() do backtest —
# assim o .ex5 opera EXATAMENTE como a estratégia validada na esteira.

def _d(x) -> str:
    """Literal double MQL5 (30 -> '30.0', 2.5 -> '2.5')."""
    return repr(float(x))


def _gen_multi(blocks_list: list[dict]) -> tuple[str, str, str]:
    """Retorna (declarações de handles, init dos handles, corpo do RawSignal)."""
    reg: dict[str, str] = {}          # expr MQL5 -> nome da variável de handle
    decls: list[str] = []
    inits: list[str] = []

    def H(expr: str) -> str:
        if expr not in reg:
            var = f"hB{len(reg)}"
            reg[expr] = var
            decls.append(f"int      {var}=INVALID_HANDLE;")
            inits.append(f"   {var} = {expr};")
        return reg[expr]

    body: list[str] = []
    for blk in blocks_list:
        name = blk["name"]
        p = blk.get("params", {})
        body.append(f"   // bloco: {name} {p}")

        if name == "rsi_extreme":
            h = H(f"iRSI(_Symbol,_Period,{int(p['period'])},PRICE_CLOSE)")
            lv = float(p["level"])
            body.append(f"   {{ double v=Buf({h},1); long_ok=long_ok&&(v<{_d(lv)}); "
                        f"short_ok=short_ok&&(v>{_d(100-lv)}); }}")

        elif name == "rsi_trend":
            h = H(f"iRSI(_Symbol,_Period,{int(p['period'])},PRICE_CLOSE)")
            body.append(f"   {{ double v=Buf({h},1); long_ok=long_ok&&(v>50.0); "
                        f"short_ok=short_ok&&(v<50.0); }}")

        elif name == "ema_stack":
            hf = H(f"iMA(_Symbol,_Period,{int(p['fast'])},0,MODE_EMA,PRICE_CLOSE)")
            hs = H(f"iMA(_Symbol,_Period,{int(p['slow'])},0,MODE_EMA,PRICE_CLOSE)")
            body.append(f"   {{ double f=Buf({hf},1),s=Buf({hs},1); long_ok=long_ok&&(f>s); "
                        f"short_ok=short_ok&&(f<s); }}")

        elif name == "ema_cross":
            hf = H(f"iMA(_Symbol,_Period,{int(p['fast'])},0,MODE_EMA,PRICE_CLOSE)")
            hs = H(f"iMA(_Symbol,_Period,{int(p['slow'])},0,MODE_EMA,PRICE_CLOSE)")
            body.append(f"   {{ double f1=Buf({hf},1),s1=Buf({hs},1),f2=Buf({hf},2),s2=Buf({hs},2); "
                        f"long_ok=long_ok&&(f1>s1&&f2<=s2); short_ok=short_ok&&(f1<s1&&f2>=s2); }}")

        elif name == "price_ema":
            h = H(f"iMA(_Symbol,_Period,{int(p['period'])},0,MODE_EMA,PRICE_CLOSE)")
            body.append(f"   {{ double e=Buf({h},1); long_ok=long_ok&&(c>e); short_ok=short_ok&&(c<e); }}")

        elif name == "macd_state":
            h = H(f"iMACD(_Symbol,_Period,{int(p['fast'])},{int(p['slow'])},{int(p['signal'])},PRICE_CLOSE)")
            body.append(f"   {{ double m=Buf({h},1,0),sg=Buf({h},1,1); long_ok=long_ok&&(m>sg); "
                        f"short_ok=short_ok&&(m<sg); }}")

        elif name == "macd_cross":
            h = H(f"iMACD(_Symbol,_Period,{int(p['fast'])},{int(p['slow'])},{int(p['signal'])},PRICE_CLOSE)")
            body.append(f"   {{ double m1=Buf({h},1,0),s1=Buf({h},1,1),m2=Buf({h},2,0),s2=Buf({h},2,1); "
                        f"long_ok=long_ok&&(m1>s1&&m2<=s2); short_ok=short_ok&&(m1<s1&&m2>=s2); }}")

        elif name == "bb_fade":
            h = H(f"iBands(_Symbol,_Period,{int(p['period'])},0,{_d(p['dev'])},PRICE_CLOSE)")
            body.append(f"   {{ double up=Buf({h},1,1),lo=Buf({h},1,2); long_ok=long_ok&&(c<lo); "
                        f"short_ok=short_ok&&(c>up); }}")

        elif name == "bb_break":
            h = H(f"iBands(_Symbol,_Period,{int(p['period'])},0,{_d(p['dev'])},PRICE_CLOSE)")
            body.append(f"   {{ double up=Buf({h},1,1),lo=Buf({h},1,2); long_ok=long_ok&&(c>up); "
                        f"short_ok=short_ok&&(c<lo); }}")

        elif name == "donchian":
            lb = int(p["lookback"])
            body.append(f"   {{ int ih=iHighest(_Symbol,_Period,MODE_HIGH,{lb},2); "
                        f"int il=iLowest(_Symbol,_Period,MODE_LOW,{lb},2); "
                        f"long_ok=long_ok&&(ih>=0&&c>iHigh(_Symbol,_Period,ih)); "
                        f"short_ok=short_ok&&(il>=0&&c<iLow(_Symbol,_Period,il)); }}")

        elif name == "stoch":
            h = H(f"iStochastic(_Symbol,_Period,{int(p['k'])},3,3,MODE_SMA,STO_LOWHIGH)")
            lv = float(p["level"])
            body.append(f"   {{ double st=Buf({h},1,0); long_ok=long_ok&&(st<{_d(lv)}); "
                        f"short_ok=short_ok&&(st>{_d(100-lv)}); }}")

        elif name == "cci":
            h = H(f"iCCI(_Symbol,_Period,{int(p['period'])},PRICE_TYPICAL)")
            lv = float(p["level"])
            body.append(f"   {{ double cc=Buf({h},1); long_ok=long_ok&&(cc<{_d(-lv)}); "
                        f"short_ok=short_ok&&(cc>{_d(lv)}); }}")

        elif name == "momentum":
            per = int(p["period"])
            body.append(f"   {{ double mo=c-iClose(_Symbol,_Period,{1+per}); "
                        f"long_ok=long_ok&&(mo>0.0); short_ok=short_ok&&(mo<0.0); }}")

        elif name == "adx_filter":
            h = H(f"iADX(_Symbol,_Period,{int(p['period'])})")
            lv = float(p["level"])
            body.append(f"   {{ bool a=(Buf({h},1,0)>{_d(lv)}); long_ok=long_ok&&a; short_ok=short_ok&&a; }}")

        elif name == "trend_filter":
            h = H("iMA(_Symbol,_Period,200,0,MODE_EMA,PRICE_CLOSE)")
            body.append(f"   {{ double e=Buf({h},1); long_ok=long_ok&&(c>e); short_ok=short_ok&&(c<e); }}")

        else:
            raise ValueError(f"bloco desconhecido no strategyDef: {name}")

    return "\n".join(decls), "\n".join(inits), "\n".join(body)


def render_multi(ea_id: str, params: dict, direction: str = "both", lot: float = 0.1) -> str:
    blocks_list = params.get("blocks") or []
    if not blocks_list:
        raise ValueError("strategyDef multi sem 'blocks'")
    decls, inits, body = _gen_multi(blocks_list)
    tpl = open(MULTI_TEMPLATE, encoding="utf-8").read()
    subs = {
        "__EA_ID__": ea_id,
        "__STATUS_URL__": f"{STATUS_URL_BASE}/{ea_id}/status",
        "__DIRECTION__": DIRECTION_CODE.get(direction, 0),
        "__LOT__": lot,
        "__MAGIC__": _magic_of(ea_id),
        "__ATR_PERIOD__": int(params.get("atr_period", 14)),
        "__SL_ATR__": _d(params.get("sl_atr", 2.0)),
        "__TP_ATR__": _d(params.get("tp_atr", 3.0)),
        "__HANDLE_DECLS__": decls,
        "__HANDLE_INITS__": inits,
        "__SIGNAL_BODY__": body,
    }
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

    src = (render_multi(ea_id, params, direction, lot) if family == "multi"
           else render(ea_id, family, exit_mode, params, direction, lot))
    with open(mq5, "w", encoding="utf-8") as f:
        f.write(src)

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
    ap.add_argument("--family", default="trend", choices=list(FAMILY_CODE) + ["multi"])
    ap.add_argument("--exit-mode", default="reversal", choices=list(EXIT_CODE))
    ap.add_argument("--params", default="{}", help="JSON com params baked-in")
    args = ap.parse_args()

    res = compile_ea(args.ea_id, args.family, args.exit_mode, json.loads(args.params))
    print("OK:", res.ok)
    print("ex5:", res.ex5_path)
    if not res.ok:
        print("--- log ---")
        print(res.log[-2000:])

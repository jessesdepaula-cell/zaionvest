"""
Camada de dados MT5 — conexão, resolução de símbolo e candles.

Os brokers usam sufixos diferentes no nome do símbolo (EURUSDxx, EURUSD_DK,
EURUSDm, ...). resolve_symbol() acha o nome real a partir da base "EURUSD".
"""
from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass

import MetaTrader5 as mt5
import pandas as pd

# Terminal alvo: RoboForex (único broker do projeto). Sobrescreve com env
# MT5_TERMINAL_PATH se o exe estiver noutro lugar.
DEFAULT_TERMINAL = os.environ.get(
    "MT5_TERMINAL_PATH",
    r"C:\Program Files\RoboForex MT5 Terminal\terminal64.exe",
)

TIMEFRAMES = {
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}

# Sufixos comuns por broker, tentados em ordem.
_SUFFIXES = ["", "xx", "m", ".r", "_DK", "pro", "micro", ".", "-5", "c"]


class MT5Error(RuntimeError):
    pass


def connect(path: str | None = None) -> None:
    """Inicializa o terminal RoboForex (idempotente). path sobrescreve o default."""
    target = path or DEFAULT_TERMINAL
    ok = mt5.initialize(target)
    if not ok:
        raise MT5Error(f"initialize falhou ({target}): {mt5.last_error()}")


def resolve_symbol(base: str) -> str:
    """Resolve o nome real do símbolo tolerando sufixos de broker e seleciona-o."""
    names = {s.name for s in (mt5.symbols_get() or [])}
    up = base.upper()
    # 1) match exato por sufixo conhecido
    for suf in _SUFFIXES:
        cand = base + suf
        if cand in names:
            mt5.symbol_select(cand, True)
            return cand
    # 2) qualquer símbolo que comece com a base (case-insensitive)
    for n in names:
        if n.upper().startswith(up):
            mt5.symbol_select(n, True)
            return n
    raise MT5Error(f"símbolo não encontrado para base '{base}'")


@dataclass
class SymbolInfo:
    name: str
    point: float
    digits: int
    contract_size: float
    currency_profit: str


def symbol_info(name: str) -> SymbolInfo:
    info = mt5.symbol_info(name)
    if info is None:
        raise MT5Error(f"symbol_info None para {name}")
    return SymbolInfo(
        name=name,
        point=info.point,
        digits=info.digits,
        contract_size=info.trade_contract_size,
        currency_profit=info.currency_profit,
    )


def get_candles(base: str, timeframe: str, years: float = 2.0) -> tuple[pd.DataFrame, str]:
    """Retorna (DataFrame OHLC, nome_resolvido). Janela = últimos `years` anos."""
    if timeframe not in TIMEFRAMES:
        raise MT5Error(f"timeframe inválido: {timeframe}")
    name = resolve_symbol(base)
    end = dt.datetime.now()
    start = end - dt.timedelta(days=int(365 * years))
    rates = mt5.copy_rates_range(name, TIMEFRAMES[timeframe], start, end)
    if rates is None or len(rates) == 0:
        raise MT5Error(f"sem candles para {name} {timeframe}: {mt5.last_error()}")
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    return df, name


def shutdown() -> None:
    mt5.shutdown()

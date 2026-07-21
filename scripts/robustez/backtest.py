"""
Backtest vetorizado das famílias base (DQ Labs cap. 1) sobre candles reais.
Famílias v1: trend (cruzamento EMA), mean_reversion (RSI), breakout (Donchian).
Cada família roda em 2 modos de saída: "reversal" e "fixed_sltp".

Simulação bar-a-bar, 1 posição por vez, lote fixo. Custos (spread+comissão)
descontados por trade — backtest sem custo mente (DQ Labs cap. 2).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from wfa import Trade


# ─── Indicadores (pandas/numpy, sem TA-Lib) ──────────────────────────────────

def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def _rsi(close: pd.Series, n: int) -> pd.Series:
    delta = close.diff()
    up = delta.clip(lower=0.0)
    down = -delta.clip(upper=0.0)
    roll_up = up.ewm(alpha=1 / n, adjust=False).mean()
    roll_down = down.ewm(alpha=1 / n, adjust=False).mean()
    rs = roll_up / roll_down.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50.0)


def _atr(df: pd.DataFrame, n: int) -> pd.Series:
    h, l, c = df["high"], df["low"], df["close"]
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean()


def _macd(close: pd.Series, fast: int, slow: int, signal: int):
    macd = _ema(close, fast) - _ema(close, slow)
    sig = macd.ewm(span=signal, adjust=False).mean()
    return macd, sig


def _bollinger(close: pd.Series, n: int, dev: float):
    mid = close.rolling(n).mean()
    sd = close.rolling(n).std()
    return mid + dev * sd, mid - dev * sd


def _stochastic(df: pd.DataFrame, k: int, smooth: int) -> pd.Series:
    ll = df["low"].rolling(k).min()
    hh = df["high"].rolling(k).max()
    raw = 100 * (df["close"] - ll) / (hh - ll).replace(0, np.nan)
    return raw.rolling(smooth).mean().fillna(50.0)


# ─── Sinais por família ──────────────────────────────────────────────────────

def _signals(df: pd.DataFrame, family: str, p: dict) -> np.ndarray:
    """Retorna array de sinal por barra: +1 long, -1 short, 0 nada."""
    close = df["close"]
    sig = np.zeros(len(df), dtype=int)

    if family == "multi":
        # Estratégia multi-condição (1-3 blocos AND, estilo SQX).
        import blocks
        return blocks.build_signals(df, p["blocks"])

    if family == "trend":
        fast = _ema(close, int(p.get("ema_fast", 12)))
        slow = _ema(close, int(p.get("ema_slow", 48)))
        filt = _ema(close, int(p.get("ema_filter", 200)))
        long_ = (fast > slow) & (close > filt)
        short_ = (fast < slow) & (close < filt)
        sig[long_.values] = 1
        sig[short_.values] = -1

    elif family == "mean_reversion":
        rsi = _rsi(close, int(p.get("rsi_period", 14)))
        os_, ob = p.get("rsi_os", 30), p.get("rsi_ob", 70)
        sig[(rsi < os_).values] = 1
        sig[(rsi > ob).values] = -1

    elif family == "breakout":
        n = int(p.get("lookback", 20))
        hh = df["high"].rolling(n).max().shift(1)
        ll = df["low"].rolling(n).min().shift(1)
        sig[(close > hh).fillna(False).values] = 1
        sig[(close < ll).fillna(False).values] = -1

    elif family == "macd_cross":
        macd, msig = _macd(close, int(p.get("macd_fast", 12)),
                           int(p.get("macd_slow", 26)), int(p.get("macd_signal", 9)))
        up = (macd > msig) & (macd.shift(1) <= msig.shift(1))
        dn = (macd < msig) & (macd.shift(1) >= msig.shift(1))
        sig[up.fillna(False).values] = 1
        sig[dn.fillna(False).values] = -1

    elif family == "bollinger_fade":
        # reversão: fecha fora da banda → aposta na volta
        upper, lower = _bollinger(close, int(p.get("bb_period", 20)),
                                  float(p.get("bb_dev", 2.0)))
        sig[(close < lower).fillna(False).values] = 1
        sig[(close > upper).fillna(False).values] = -1

    elif family == "bollinger_break":
        # rompimento: fecha fora da banda → segue o movimento
        upper, lower = _bollinger(close, int(p.get("bb_period", 20)),
                                  float(p.get("bb_dev", 2.0)))
        sig[(close > upper).fillna(False).values] = 1
        sig[(close < lower).fillna(False).values] = -1

    elif family == "stochastic":
        st = _stochastic(df, int(p.get("stoch_k", 14)), int(p.get("stoch_smooth", 3)))
        os_, ob = p.get("stoch_os", 20), p.get("stoch_ob", 80)
        sig[(st < os_).fillna(False).values] = 1
        sig[(st > ob).fillna(False).values] = -1

    else:
        raise ValueError(f"família desconhecida: {family}")

    return sig


# ─── Backtest ────────────────────────────────────────────────────────────────

# Risco-alvo em $ por movimento de 1 ATR com 1 posição. Normaliza o lote entre
# símbolos: lote fixo 0.1 em XAUUSD arrisca ~10x mais que em EURUSD e distorcia
# o DD% (ex.: DD 81% no card). Com isso, curvas/DDs ficam comparáveis.
# Base de capital do SQX/QuantMiner ($10k). Risco-alvo ~1% do capital por 1 ATR
# de movimento (normaliza o lote entre símbolos — lote fixo distorcia o DD do
# XAUUSD) e dá retornos/DD na mesma faixa dos cards deles (DD 2-8%).
START_CAPITAL = 10_000.0
TARGET_ATR_RISK = 100.0


@dataclass
class BacktestResult:
    trades: list          # list[Trade] — base da WFA/Monte Carlo
    equity_bar: list      # equity mark-to-market POR BARRA (DD flutuante + r²)
    equity_dates: list    # data (str) de cada ponto da equity_bar
    lot: float            # lote normalizado usado
    start_capital: float = START_CAPITAL   # base do DD%/retorno (nv7 usa a ref do EA)


def normalized_lot(atr_mean: float, contract_size: float) -> float:
    """Lote que arrisca ~TARGET_ATR_RISK por movimento de 1 ATR médio."""
    dollars_per_atr_per_lot = atr_mean * contract_size
    if dollars_per_atr_per_lot <= 0:
        return 0.01
    lot = TARGET_ATR_RISK / dollars_per_atr_per_lot
    # float() evita np.float64 vazar pro JSON (json.dumps quebra com np types)
    return float(max(0.01, round(lot, 2)))


_NUMBA_ENGINE = None
_NUMBA_TRIED = False


def _get_numba_engine():
    """Importa lazy o motor Numba (evita import circular; None se indisponível)."""
    global _NUMBA_ENGINE, _NUMBA_TRIED
    if not _NUMBA_TRIED:
        _NUMBA_TRIED = True
        try:
            import backtest_numba
            _NUMBA_ENGINE = backtest_numba.run_backtest_numba
        except Exception:
            _NUMBA_ENGINE = None
    return _NUMBA_ENGINE


def run_backtest(
    df: pd.DataFrame,
    family: str,
    params: dict,
    *,
    exit_mode: str = "reversal",
    direction: str = "both",          # "both" | "long" | "short"
    point: float = 1e-5,
    contract_size: float = 100_000.0,
    lot: float | None = None,          # None = normalizado por ATR
    spread_points: float = 12.0,
    commission_per_trade: float = 0.7,
) -> BacktestResult:
    """Roda a estratégia; devolve trades + equity mark-to-market por barra."""
    # Fast-path: kernel Numba (quando disponível — venv .venv-numba) para as
    # famílias multi/simples. Resultado IDÊNTICO ao loop Python (verificado
    # 300/300); ~2-7x mais rápido. grid/grid_hedge/nv7 seguem no loop Python.
    if family not in ("grid", "grid_hedge", "nv7"):
        _eng = _get_numba_engine()
        if _eng is not None:
            return _eng(df, family, params, exit_mode=exit_mode, direction=direction,
                        point=point, contract_size=contract_size, lot=lot,
                        spread_points=spread_points, commission_per_trade=commission_per_trade)

    close = df["close"].values
    high = df["high"].values
    low = df["low"].values
    times = df["time"].values
    atr = _atr(df, int(params.get("atr_period", 14))).values

    atr_mean = float(np.nanmean(atr))
    if lot is None:
        lot = normalized_lot(atr_mean, contract_size)

    if family == "grid":
        return _run_grid(df, params, direction=direction, point=point,
                         contract_size=contract_size, lot=lot,
                         spread_points=spread_points,
                         commission_per_trade=commission_per_trade)

    if family == "grid_hedge":
        return _run_grid_hedge(df, params, direction=direction, point=point,
                               contract_size=contract_size, lot=lot,
                               spread_points=spread_points,
                               commission_per_trade=commission_per_trade)

    if family == "nv7":
        return _run_nv7(df, params, point=point, contract_size=contract_size,
                        lot=lot, spread_points=spread_points,
                        commission_per_trade=commission_per_trade)

    if exit_mode == "grid":
        return _run_multi_grid(df, params, direction=direction, point=point,
                               contract_size=contract_size, lot=lot,
                               spread_points=spread_points,
                               commission_per_trade=commission_per_trade)

    sig = _signals(df, family, params)
    # filtro de direção: long-only zera sinais de venda e vice-versa
    if direction == "long":
        sig[sig == -1] = 0
    elif direction == "short":
        sig[sig == 1] = 0

    # Exit on Friday (SQX): fecha tudo no fim da sexta — sem gap de fim de semana
    dt_idx = pd.DatetimeIndex(df["time"])
    friday_close = (dt_idx.weekday == 4) & (dt_idx.hour >= 20)
    # Datas pré-computadas 1x (vetorizado) — evita pd.Timestamp por barra, que
    # dominava o custo do loop. Resultado idêntico ao str(Timestamp.date()).
    date_strs = np.asarray(dt_idx.strftime("%Y-%m-%d"))

    sl_mult = float(params.get("sl_atr", 2.0))
    tp_mult = float(params.get("tp_atr", 3.0))
    cost_per_trade = spread_points * point * contract_size * lot + commission_per_trade
    value = contract_size * lot

    trades: list[Trade] = []
    equity_bar: list[float] = []
    equity_dates: list[str] = []
    realized = START_CAPITAL
    pos = 0
    entry_px = 0.0
    sl = tp = 0.0

    def close_trade(exit_px: float, i: int):
        nonlocal pos, realized
        gross = pos * (exit_px - entry_px) * value
        p = round(float(gross) - cost_per_trade, 2)
        realized += p
        trades.append(Trade(profit=p, date=str(date_strs[i]), side=pos))
        pos = 0

    for i in range(1, len(df)):
        s = sig[i]

        # sexta à noite: fecha posição e não abre nova até segunda
        if friday_close[i]:
            if pos != 0:
                close_trade(close[i], i)
            equity_bar.append(float(round(realized, 2)))
            equity_dates.append(str(date_strs[i]))
            continue

        if pos != 0:
            if exit_mode == "fixed_sltp":
                if pos == 1:
                    if low[i] <= sl:
                        close_trade(sl, i)
                    elif high[i] >= tp:
                        close_trade(tp, i)
                else:
                    if high[i] >= sl:
                        close_trade(sl, i)
                    elif low[i] <= tp:
                        close_trade(tp, i)
            if pos != 0 and s == -pos:
                close_trade(close[i], i)
                if exit_mode == "reversal" and direction == "both":
                    pos = s
                    entry_px = close[i]

        if pos == 0 and s != 0:
            pos = s
            entry_px = close[i]
            if exit_mode == "fixed_sltp":
                a = atr[i] if not np.isnan(atr[i]) else 0.0
                sl = entry_px - pos * sl_mult * a
                tp = entry_px + pos * tp_mult * a

        # equity mark-to-market da barra (realizado + posição aberta)
        floating = pos * (close[i] - entry_px) * value if pos != 0 else 0.0
        equity_bar.append(float(round(realized + floating, 2)))
        equity_dates.append(str(date_strs[i]))

    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot)


def _run_grid(
    df: pd.DataFrame,
    params: dict,
    *,
    direction: str,
    point: float,
    contract_size: float,
    lot: float,
    spread_points: float,
    commission_per_trade: float,
) -> BacktestResult:
    """Família GRID: abre 1ª ordem por reversão (RSI extremo), adiciona mais a
    cada `grid_spacing`×ATR contra a posição (até `grid_levels`), e fecha o
    cesto inteiro quando o preço retorna `grid_tp`×ATR além do preço médio.
    Sem stop individual — o risco real aparece no DD FLUTUANTE (mark-to-market),
    que é gateado no funil. Grid short é o espelho.
    """
    close = df["close"].values
    times = df["time"].values
    rsi = _rsi(df["close"], int(params.get("rsi_period", 14))).values
    atr = _atr(df, int(params.get("atr_period", 14))).values

    os_, ob = float(params.get("rsi_os", 30)), float(params.get("rsi_ob", 70))
    spacing = float(params.get("grid_spacing", 1.0))   # em ATRs
    max_lvl = int(params.get("grid_levels", 4))
    tp_atr = float(params.get("grid_tp", 0.5))         # além do preço médio

    value = contract_size * lot
    cost = spread_points * point * contract_size * lot + commission_per_trade

    trades: list[Trade] = []
    equity_bar: list[float] = []
    equity_dates: list[str] = []
    realized = START_CAPITAL

    basket: list[float] = []   # preços de entrada
    bdir = 0                   # direção do cesto

    dt_idx = pd.DatetimeIndex(df["time"])
    friday_close = (dt_idx.weekday == 4) & (dt_idx.hour >= 20)

    for i in range(1, len(df)):
        px = close[i]
        a = atr[i] if not np.isnan(atr[i]) else 0.0

        # sexta à noite: fecha o cesto inteiro (gap de fds em grid é fatal)
        if friday_close[i] and basket:
            gross = sum(bdir * (px - e) * value for e in basket)
            p = round(float(gross) - cost * len(basket), 2)
            realized += p
            trades.append(Trade(profit=p, date=str(pd.Timestamp(times[i]).date()), side=bdir))
            basket, bdir = [], 0
            equity_bar.append(float(round(realized, 2)))
            equity_dates.append(str(pd.Timestamp(times[i]).date()))
            continue

        if basket and a > 0:
            avg = sum(basket) / len(basket)
            # adiciona nível se andou spacing*ATR contra
            if len(basket) < max_lvl:
                worst = min(basket) if bdir == 1 else max(basket)
                if (bdir == 1 and px <= worst - spacing * a) or \
                   (bdir == -1 and px >= worst + spacing * a):
                    basket.append(px)
                    avg = sum(basket) / len(basket)
            # fecha o cesto no retorno
            target = avg + bdir * tp_atr * a
            if (bdir == 1 and px >= target) or (bdir == -1 and px <= target):
                gross = sum(bdir * (px - e) * value for e in basket)
                p = round(float(gross) - cost * len(basket), 2)
                realized += p
                trades.append(Trade(profit=p, date=str(pd.Timestamp(times[i]).date()), side=bdir))
                basket, bdir = [], 0

        if not basket and not np.isnan(rsi[i]):
            if rsi[i] < os_ and direction in ("both", "long"):
                basket, bdir = [px], 1
            elif rsi[i] > ob and direction in ("both", "short"):
                basket, bdir = [px], -1

        floating = sum(bdir * (px - e) * value for e in basket) if basket else 0.0
        equity_bar.append(float(round(realized + floating, 2)))
        equity_dates.append(str(pd.Timestamp(times[i]).date()))

    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot)


def _run_grid_hedge(
    df: pd.DataFrame,
    params: dict,
    *,
    direction: str,
    point: float,
    contract_size: float,
    lot: float,
    spread_points: float,
    commission_per_trade: float,
) -> BacktestResult:
    """Arquitetura REAL dos robôs minerados QuantMiner (engenharia reversa dos
    inputs de PQM_148): sinal MULTI-CONDIÇÃO decide a direção; abre um GRID que
    adiciona níveis a cada `grid_step`×ATR contra a posição (média); fecha o
    CESTO inteiro quando o lucro flutuante atinge o alvo financeiro (netting).
    Sem SL por trade, mas trava de conta em `max_dd_pct`. Filtro de horário.
    Hedge: compra e venda podem rodar ao mesmo tempo (direction='both').

    O DD alto-mas-gerenciável (~20%) e a curva suave em range vêm daqui — não de
    entrada única com SL/TP. É o que a vitrine deles realmente vende.
    """
    close = df["close"].values
    times = df["time"].values
    atr = _atr(df, int(params.get("atr_period", 14))).values
    sig = _signals(df, params.get("family_signal", "multi"), params) \
        if "blocks" in params else _signals(df, "mean_reversion", params)

    step = float(params.get("grid_step", 1.5))       # espaçamento em ATRs
    max_levels = int(params.get("grid_levels", 6))
    tp_atr = float(params.get("grid_tp", 2.0))        # alvo do cesto em ATRs (× lote base)
    max_dd_pct = float(params.get("max_dd_pct", 30.0))
    h0 = int(params.get("hour_start", 0))
    h1 = int(params.get("hour_end", 24))

    value = contract_size * lot
    cost = spread_points * point * contract_size * lot + commission_per_trade

    dt_idx = pd.DatetimeIndex(df["time"])
    hours = dt_idx.hour.values
    weekday = dt_idx.weekday.values

    trades: list[Trade] = []
    equity_bar: list[float] = []
    equity_dates: list[str] = []
    realized = START_CAPITAL
    peak = START_CAPITAL
    cooldown = 0

    # cada cesto: lista de preços de entrada + ATR do 1º open (define alvo $)
    long_basket: list[float] = []
    short_basket: list[float] = []
    long_tp0 = short_tp0 = 0.0

    def basket_float(basket, d, px):
        return sum(d * (px - e) * value for e in basket)

    def close_basket(basket, d, px, i, tp0):
        nonlocal realized
        gross = basket_float(basket, d, px)
        p = round(float(gross) - cost * len(basket), 2)
        realized += p
        trades.append(Trade(profit=p, date=str(pd.Timestamp(times[i]).date()), side=d))

    for i in range(1, len(df)):
        px = close[i]
        a = atr[i] if not np.isnan(atr[i]) else 0.0
        in_session = (h0 <= hours[i] < h1) and weekday[i] < 5

        # equity mark-to-market (realizado + cestos abertos)
        floating = 0.0
        if long_basket:
            floating += basket_float(long_basket, 1, px)
        if short_basket:
            floating += basket_float(short_basket, -1, px)
        eq = realized + floating

        # trava de Max Drawdown de conta: fecha tudo e entra em cooldown
        peak = max(peak, eq)
        if peak > 0 and (peak - eq) / peak * 100.0 >= max_dd_pct:
            if long_basket:
                close_basket(long_basket, 1, px, i, long_tp0); long_basket = []
            if short_basket:
                close_basket(short_basket, -1, px, i, short_tp0); short_basket = []
            cooldown = 20
            equity_bar.append(float(round(realized, 2)))
            equity_dates.append(str(pd.Timestamp(times[i]).date()))
            continue

        if a > 0:
            # fecha cesto no alvo financeiro (netting) — QuantMiner "profit netting"
            if long_basket and basket_float(long_basket, 1, px) >= tp_atr * long_tp0 * value:
                close_basket(long_basket, 1, px, i, long_tp0); long_basket = []
            if short_basket and basket_float(short_basket, -1, px) >= tp_atr * short_tp0 * value:
                close_basket(short_basket, -1, px, i, short_tp0); short_basket = []

            # adiciona nível de grid quando anda `step`×ATR contra a última entrada
            if long_basket and len(long_basket) < max_levels and px <= long_basket[-1] - step * a:
                long_basket.append(px)
            if short_basket and len(short_basket) < max_levels and px >= short_basket[-1] + step * a:
                short_basket.append(px)

        # novas aberturas: sinal + sessão + fora de cooldown
        if cooldown > 0:
            cooldown -= 1
        elif in_session and a > 0:
            s = sig[i]
            if s == 1 and not long_basket and direction in ("both", "long"):
                long_basket = [px]; long_tp0 = a
            elif s == -1 and not short_basket and direction in ("both", "short"):
                short_basket = [px]; short_tp0 = a

        equity_bar.append(float(round(eq, 2)))
        equity_dates.append(str(pd.Timestamp(times[i]).date()))

    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot)


def _run_multi_grid(
    df: pd.DataFrame,
    params: dict,
    *,
    direction: str,
    point: float,
    contract_size: float,
    lot: float,
    spread_points: float,
    commission_per_trade: float,
) -> BacktestResult:
    """Modo GRID para estratégias multi-condição:
    Sinal multi-condição abre a 1ª posição da grade. Se o preço andar
    `grid_step_atr` * ATR contra a última posição, adiciona novo nível (até `grid_max_levels`).
    Fecha o cesto inteiro no lucro líquido alvo (`grid_tp_atr` * ATR * lote * contrato).
    COM PROTEÇÃO DD GUARD: se o prejuízo flutuante do cesto atingir `dd_guard_pct` da conta,
    encerra todas as posições imediatamente no Hard Stop.
    """
    close = df["close"].values
    times = df["time"].values
    atr = _atr(df, int(params.get("atr_period", 14))).values
    sig = _signals(df, "multi", params) if "blocks" in params else _signals(df, "mean_reversion", params)

    step_atr = float(params.get("grid_step_atr", 1.5))
    max_levels = int(params.get("grid_max_levels", 4))
    tp_atr = float(params.get("grid_tp_atr", 2.0))
    dd_guard_pct = float(params.get("dd_guard_pct", 0.05))

    value = contract_size * lot
    cost = spread_points * point * contract_size * lot + commission_per_trade

    dt_idx = pd.DatetimeIndex(df["time"])
    date_strs = np.asarray(dt_idx.strftime("%Y-%m-%d"))
    friday_close = (dt_idx.weekday == 4) & (dt_idx.hour >= 20)

    trades: list[Trade] = []
    equity_bar: list[float] = []
    equity_dates: list[str] = []
    realized = START_CAPITAL

    basket: list[float] = []
    bdir = 0
    basket_atr = 0.0
    cooldown = 0

    def basket_float(px):
        return sum(bdir * (px - e) * value for e in basket)

    def close_basket(px, i):
        nonlocal realized, basket, bdir
        gross = basket_float(px)
        p = round(float(gross) - cost * len(basket), 2)
        realized += p
        trades.append(Trade(profit=p, date=str(date_strs[i]), side=bdir))
        basket = []
        bdir = 0

    for i in range(1, len(df)):
        px = close[i]
        a = atr[i] if not np.isnan(atr[i]) else 0.0

        # Sexta-feira à noite: fecha o cesto por segurança de gap de fim de semana
        if friday_close[i] and basket:
            close_basket(px, i)
            equity_bar.append(float(round(realized, 2)))
            equity_dates.append(str(date_strs[i]))
            continue

        if basket and a > 0:
            fl = basket_float(px)
            # 1. DD Guard (Hard Stop): se o prejuízo flutuante exceder o limite de conta
            if START_CAPITAL > 0 and (-fl) / START_CAPITAL >= dd_guard_pct:
                close_basket(px, i)
                cooldown = 20
                equity_bar.append(float(round(realized, 2)))
                equity_dates.append(str(date_strs[i]))
                continue

            # 2. Cluster TP: fecha se o lucro líquido atingir a meta
            if fl >= tp_atr * basket_atr * value:
                close_basket(px, i)
            else:
                # 3. Adiciona novo nível de grade se andou step_atr * ATR contra a pior entrada
                worst = min(basket) if bdir == 1 else max(basket)
                if len(basket) < max_levels:
                    if (bdir == 1 and px <= worst - step_atr * a) or (bdir == -1 and px >= worst + step_atr * a):
                        basket.append(px)

        # 4. Abertura inicial se fora de cooldown e sem cesto ativo
        if cooldown > 0:
            cooldown -= 1
        elif not basket and a > 0:
            s = sig[i]
            if s == 1 and direction in ("both", "long"):
                basket = [px]
                bdir = 1
                basket_atr = a
            elif s == -1 and direction in ("both", "short"):
                basket = [px]
                bdir = -1
                basket_atr = a

        fl = basket_float(px) if basket else 0.0
        equity_bar.append(float(round(realized + fl, 2)))
        equity_dates.append(str(date_strs[i]))

    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot)


def _run_nv7(
    df: pd.DataFrame,
    params: dict,
    *,
    point: float,
    contract_size: float,
    lot: float,
    spread_points: float,
    commission_per_trade: float,
) -> BacktestResult:
    """Réplica 1:1 do Zaion Sniper / QuantMiner NV7 (grid Fibonacci hedgeado).

    Espelha `templates/qm_nv7_template.mq5`, que por sua vez replica os inputs
    REAIS lidos do EA `nv7_xauusd_h1_grid_fibo` (magic 123456) em 2026-07-16.
    Tudo em PONTOS FIXOS e LOTES FIXOS — nada em ATR, nada normalizado: é assim
    que o EA opera de verdade, e a versão anterior desta função simulava outro
    robô (grid em ATR, lote único, cortando os dois lados).

    Ordem do OnTick (idêntica ao .mq5):
      1. meta por ciclo mensal (20% da ref) / diária (2%) -> fecha tudo e trava
         novas entradas até o próximo ciclo;
      2. proteção de capital (DD global) -> DESLIGADA no NV7 (prot_capital=False);
      3. compensação: vendas com DD >= 3% da ref E compras no lucro -> colhe as
         compras (fecha só o lado comprado);
      4. DD-guard SÓ das vendas: DD >= 5% da ref -> fecha as vendas. O lado
         comprado NUNCA é cortado no prejuízo — é o cerne da estratégia (e a
         razão de o NV7 "não estopar");
      5. cluster-netting: >= 10 posições e sobra líquida >= $11 -> fecha tudo;
      6. TP por lado: média das entradas +/- 2775 pontos FIXOS;
      7. grid: novo nível a cada 1100 pontos FIXOS contra a pior entrada do lado;
      8. abre o hedge (compra 0.02 + venda 0.01) ao entrar na zona Fibo 38.2-50%.

    A base de capital é o `ref_balance` (3000) — o mesmo saldo de referência que
    o EA usa nos cálculos de %. Devolvido em BacktestResult.start_capital para
    o DD% do pipeline sair na régua real, e não sobre os $10k genéricos.

    Aproximações inevitáveis num backtest de barras (documentadas de propósito):
      - a zona Fibo do EA é medida em M30/150 barras; aqui é aproximada no TF do
        df via `fib_tf_ratio` (0.5 = 150 barras M30 lidas num df H1);
      - execução no close da barra, sem tick nem toque intrabar;
      - hedges `RBT_` não são simulados (efeito de mercado ~zero, só spread).
    """
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values

    ref_bal = float(params.get("ref_balance", 3000.0))
    lot_buy = float(params.get("lot_buy", 0.02))
    lot_sell = float(params.get("lot_sell", 0.01))
    grid_step = float(params.get("grid_step_points", 1100)) * point
    tp_dist = float(params.get("tp_points", 2775)) * point
    max_lvl = int(params.get("max_positions", 8))

    dd_guard = float(params.get("dd_guard_pct", 5.0))
    dd_sells_on = bool(params.get("dd_sells_on", True))
    prot_capital = bool(params.get("prot_capital", False))
    max_dd_pct = float(params.get("max_dd_pct", 5.0))
    comp_on = bool(params.get("comp_on", True))
    comp_dd = float(params.get("comp_dd_pct", 3.0))
    cluster_min = int(params.get("cluster_min", 10))
    cluster_sobra = float(params.get("cluster_sobra", 11.0))
    meta_d_on = bool(params.get("meta_daily_on", True))
    meta_d = float(params.get("meta_daily_pct", 2.0))
    meta_m_on = bool(params.get("meta_monthly_on", True))
    meta_m = float(params.get("meta_monthly_pct", 20.0))

    # O EA lê InpSwingBars barras no InpFibTimeframe (150 barras M30). Aqui o df
    # está no TF do backtest, então converte: 0.5 => 150 M30 == 75 barras H1.
    swing = max(2, int(float(params.get("swing_bars", 150)) *
                       float(params.get("fib_tf_ratio", 0.5))))
    fib_lo = float(params.get("fib_low_pct", 38.2)) / 100.0
    fib_hi = float(params.get("fib_high_pct", 50.0)) / 100.0

    val_buy = contract_size * lot_buy
    val_sell = contract_size * lot_sell
    cost_buy = spread_points * point * contract_size * lot_buy + commission_per_trade
    cost_sell = spread_points * point * contract_size * lot_sell + commission_per_trade

    roll_hi = pd.Series(high).rolling(swing).max().values
    roll_lo = pd.Series(low).rolling(swing).min().values

    dt_idx = pd.DatetimeIndex(df["time"])
    day_key = np.asarray(dt_idx.strftime("%Y%m%d"))
    mon_key = np.asarray(dt_idx.strftime("%Y%m"))
    date_strs = np.asarray(dt_idx.strftime("%Y-%m-%d"))

    trades: list[Trade] = []
    equity_bar: list[float] = []
    equity_dates: list[str] = []
    realized = ref_bal
    longs: list[float] = []
    shorts: list[float] = []
    cooldown = 0

    # ciclos: chave já concluída + realizado no início do ciclo corrente
    day_done = mon_done = ""
    cur_day = str(day_key[swing]) if len(day_key) > swing else ""
    cur_mon = str(mon_key[swing]) if len(mon_key) > swing else ""
    day_start_realized = mon_start_realized = realized

    def lfloat(px: float) -> float:
        return sum((px - e) * val_buy for e in longs)

    def sfloat(px: float) -> float:
        return sum((e - px) * val_sell for e in shorts)

    def close_longs(px: float, i: int) -> None:
        nonlocal realized, longs
        if not longs:
            return
        p = round(float(lfloat(px)) - cost_buy * len(longs), 2)
        realized += p
        trades.append(Trade(profit=p, date=str(date_strs[i]), side=1))
        longs = []

    def close_shorts(px: float, i: int) -> None:
        nonlocal realized, shorts
        if not shorts:
            return
        p = round(float(sfloat(px)) - cost_sell * len(shorts), 2)
        realized += p
        trades.append(Trade(profit=p, date=str(date_strs[i]), side=-1))
        shorts = []

    def mark(i: int, px: float) -> None:
        eq = realized + (lfloat(px) if longs else 0.0) + (sfloat(px) if shorts else 0.0)
        equity_bar.append(float(round(eq, 2)))
        equity_dates.append(str(date_strs[i]))

    for i in range(swing, len(df)):
        px = close[i]
        rng = roll_hi[i] - roll_lo[i]

        # virada de ciclo: rebaseia o realizado do dia/mês
        if str(day_key[i]) != cur_day:
            cur_day = str(day_key[i])
            day_start_realized = realized
        if str(mon_key[i]) != cur_mon:
            cur_mon = str(mon_key[i])
            mon_start_realized = realized

        lf = lfloat(px) if longs else 0.0
        sf = sfloat(px) if shorts else 0.0

        # 1. meta por ciclo (mensal e diária) — fecha tudo e trava o ciclo
        if meta_m_on and mon_done != cur_mon and \
           (realized - mon_start_realized) + lf + sf >= meta_m / 100.0 * ref_bal:
            close_longs(px, i)
            close_shorts(px, i)
            mon_done = cur_mon
            mark(i, px)
            continue
        if meta_d_on and day_done != cur_day and \
           (realized - day_start_realized) + lf + sf >= meta_d / 100.0 * ref_bal:
            close_longs(px, i)
            close_shorts(px, i)
            day_done = cur_day
            mark(i, px)
            continue

        # 2. proteção de capital (DD global) — DESLIGADA no NV7
        if prot_capital and ref_bal > 0 and \
           (-(lf + sf)) / ref_bal * 100.0 >= max_dd_pct:
            close_longs(px, i)
            close_shorts(px, i)
            cooldown = 30
            mark(i, px)
            continue

        # 3. compensação: vendas em DD >= comp_dd% da ref E compras no lucro
        #    -> colhe as compras. Não exige net total >= 0 (evento real de 6.41%
        #    fechou as compras com lf=+91.56 e net total em -67.32).
        if comp_on and shorts and longs and \
           sf <= -comp_dd / 100.0 * ref_bal and lf > 0:
            close_longs(px, i)

        # 4. DD-guard SÓ das vendas — independente da compensação (no evento real
        #    os dois dispararam no mesmo tick). O lado comprado nunca é cortado.
        if dd_sells_on and shorts and sf < -dd_guard / 100.0 * ref_bal:
            close_shorts(px, i)

        lf = lfloat(px) if longs else 0.0
        sf = sfloat(px) if shorts else 0.0

        # 5. cluster-netting: >= N posições e sobra líquida >= $X
        if len(longs) + len(shorts) >= cluster_min and (lf + sf) >= cluster_sobra:
            close_longs(px, i)
            close_shorts(px, i)

        # 6. TP por lado: média das entradas +/- pontos FIXOS
        if longs and px >= sum(longs) / len(longs) + tp_dist:
            close_longs(px, i)
        if shorts and px <= sum(shorts) / len(shorts) - tp_dist:
            close_shorts(px, i)

        # 7. grid: novo nível a pontos FIXOS contra a pior entrada do lado
        if longs and len(longs) < max_lvl and px <= min(longs) - grid_step:
            longs.append(px)
        if shorts and len(shorts) < max_lvl and px >= max(shorts) + grid_step:
            shorts.append(px)

        # 8. abre o hedge na zona Fibo (bloqueado se o ciclo já bateu a meta)
        cycle_locked = (day_done == cur_day) or (mon_done == cur_mon)
        if cooldown > 0:
            cooldown -= 1
        elif rng > 0 and not cycle_locked and not longs and not shorts:
            z_hi = roll_hi[i] - fib_lo * rng
            z_lo = roll_hi[i] - fib_hi * rng
            if z_lo <= px <= z_hi:
                longs = [px]
                shorts = [px]

        mark(i, px)

    return BacktestResult(trades=trades, equity_bar=equity_bar,
                          equity_dates=equity_dates, lot=lot_buy,
                          start_capital=ref_bal)

def count_params(family: str, params: dict | None = None) -> int:
    """Nº de parâmetros otimizáveis (pra mín. trades DQ Labs).
    'multi' = ~2 params por bloco (o funil exige mais trades qto mais complexa)."""
    if family == "multi" and params:
        return max(2, 2 * len(params.get("blocks", [])))
    if family == "grid_hedge" and params:
        return max(3, 2 * len(params.get("blocks", [])) + 3)
    # nv7: grid_step, tp, fib_lo, fib_hi, swing, dd_guard, comp_dd, cluster_min,
    # cluster_sobra, max_positions -> 10 graus de liberdade (exige +trades no gate)
    return {"trend": 3, "mean_reversion": 3, "breakout": 2, "grid": 4,
            "macd_cross": 3, "bollinger_fade": 2, "bollinger_break": 2,
            "stochastic": 3, "multi": 2, "grid_hedge": 4, "nv7": 10}.get(family, 3)

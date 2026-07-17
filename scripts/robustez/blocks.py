"""
Biblioteca de BLOCOS de condição + gerador multi-condição.
=========================================================
Réplica do mecanismo do StrategyQuant: uma estratégia = 1 a 3 CONDIÇÕES
combinadas com E (AND). Cada bloco produz a condição de entrada LONG; a SHORT
é o espelho (entry symmetry, como o SQX). Isso transforma ~15 blocos em
milhares de estratégias distintas — o pulo que faltava vs. 1 família = 1 sinal.

Um bloco é 'directional' (define o lado) ou 'filter' (regime, vale p/ os 2 lados).
Toda estratégia gerada tem >=1 bloco directional.
"""
from __future__ import annotations

import random
import numpy as np
import pandas as pd

# ─── Indicadores (locais, sem depender de backtest — evita import circular) ───

def _ema(s, n): return s.ewm(span=n, adjust=False).mean()

def _sma(s, n): return s.rolling(n).mean()

def _rsi(close, n):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1/n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1/n, adjust=False).mean()
    rs = up / dn.replace(0, np.nan)
    return (100 - 100/(1+rs)).fillna(50.0)

def _macd(close, f, s, sig):
    m = _ema(close, f) - _ema(close, s)
    return m, m.ewm(span=sig, adjust=False).mean()

def _bands(close, n, dev):
    mid = close.rolling(n).mean(); sd = close.rolling(n).std()
    return mid + dev*sd, mid - dev*sd

def _stoch(df, k, sm):
    ll = df["low"].rolling(k).min(); hh = df["high"].rolling(k).max()
    return (100*(df["close"]-ll)/(hh-ll).replace(0, np.nan)).rolling(sm).mean().fillna(50.0)

def _atr(df, n):
    h,l,c = df["high"],df["low"],df["close"]
    tr = pd.concat([h-l,(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
    return tr.ewm(alpha=1/n, adjust=False).mean()

def _adx(df, n):
    up = df["high"].diff(); dn = -df["low"].diff()
    plus = np.where((up > dn) & (up > 0), up, 0.0)
    minus = np.where((dn > up) & (dn > 0), dn, 0.0)
    atr = _atr(df, n).replace(0, np.nan)
    pdi = 100 * pd.Series(plus, index=df.index).ewm(alpha=1/n, adjust=False).mean() / atr
    mdi = 100 * pd.Series(minus, index=df.index).ewm(alpha=1/n, adjust=False).mean() / atr
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)
    return dx.ewm(alpha=1/n, adjust=False).mean().fillna(0.0)

def _cci(df, n):
    tp = (df["high"]+df["low"]+df["close"])/3
    sma = tp.rolling(n).mean()
    md = (tp - sma).abs().rolling(n).mean()
    return ((tp - sma)/(0.015*md.replace(0, np.nan))).fillna(0.0)

def _mom(close, n): return (close - close.shift(n)).fillna(0.0)

def _t3(s, n, vfactor=0.7):
    e1 = s.ewm(span=n, adjust=False).mean()
    e2 = e1.ewm(span=n, adjust=False).mean()
    e3 = e2.ewm(span=n, adjust=False).mean()
    e4 = e3.ewm(span=n, adjust=False).mean()
    e5 = e4.ewm(span=n, adjust=False).mean()
    e6 = e5.ewm(span=n, adjust=False).mean()
    c1 = -vfactor**3
    c2 = 3*vfactor**2 + 3*vfactor**3
    c3 = -6*vfactor**2 - 3*vfactor - 3*vfactor**3
    c4 = 1 + 3*vfactor + 3*vfactor**2 + vfactor**3
    return c1*e6 + c2*e5 + c3*e4 + c4*e3

def _wma(s, n):
    weights = np.arange(1, n + 1)
    return s.rolling(n).apply(lambda x: np.dot(x, weights) / weights.sum(), raw=True)

def _hma(s, n):
    half_length = int(n / 2)
    sqrt_length = int(np.sqrt(n))
    wma_half = _wma(s, half_length)
    wma_full = _wma(s, n)
    diff = 2 * wma_half - wma_full
    return _wma(diff, sqrt_length)

def _supertrend(df, period=10, multiplier=3.0):
    hl2 = (df["high"] + df["low"]) / 2
    atr = _atr(df, period)
    up = hl2 + multiplier * atr
    dn = hl2 - multiplier * atr
    
    trend = np.ones(len(df))
    close_arr = df["close"].to_numpy()
    up_arr = up.to_numpy()
    dn_arr = dn.to_numpy()
    
    curr_up = up_arr[0]
    curr_dn = dn_arr[0]
    curr_trend = 1
    
    for i in range(1, len(df)):
        if close_arr[i-1] > curr_dn:
            curr_dn = max(dn_arr[i], curr_dn)
        else:
            curr_dn = dn_arr[i]
            
        if close_arr[i-1] < curr_up:
            curr_up = min(up_arr[i], curr_up)
        else:
            curr_up = up_arr[i]
            
        if close_arr[i] > curr_up:
            curr_trend = 1
        elif close_arr[i] < curr_dn:
            curr_trend = -1
            
        trend[i] = curr_trend
        
    return pd.Series(trend, index=df.index)

def _t3_mq(s, period, hot, original=False):
    """T3 do indicador forex-tsd (função iT3): 6 EMAs em cascata + coeficientes
    derivados do 'hot'. Difere de _t3() acima no alpha, que aqui segue o
    original: original=True -> 2/(1+p); original=False -> 2/(2+(p-1)/2)."""
    alpha = 2.0 / (1.0 + period) if original else 2.0 / (2.0 + (period - 1.0) / 2.0)
    a = float(hot)
    c1 = -a**3
    c2 = 3*a*a + 3*a**3
    c3 = -6*a*a - 3*a - 3*a**3
    c4 = 1 + 3*a + a**3 + 3*a*a
    e = s
    casc = []
    for _ in range(6):
        e = e.ewm(alpha=alpha, adjust=False).mean()
        casc.append(e)
    return c1*casc[5] + c2*casc[4] + c3*casc[3] + c4*casc[2]


def _t3_velocity(s, period, hot=1.0, original=False):
    """T3 velocity (forex-tsd): iT3(hot) - iT3(hot/2). Mede a VELOCIDADE do T3,
    não o T3 — por isso é um bloco distinto de t3_trend."""
    return _t3_mq(s, period, hot, original) - _t3_mq(s, period, hot/2.0, original)


def _wpr_floating(df, period, smooth=0, fl_up=90.0, fl_dn=10.0):
    """WPR suavizado com níveis flutuantes (mladen, 2019).
    EMA em high/low/close -> WPR sobre os suavizados -> níveis derivados do
    min/max do PRÓPRIO WPR na janela.
    Devolve (val, levu, levd, levm). val ∈ [-100, 0].

    NOTA: o indicador original declara inpFlPeriod ("Floating levels period")
    mas NÃO o usa — a janela dos níveis é o inpPeriod. Replicado fiel ao código,
    não à intenção; por isso não existe param fl_period aqui."""
    n = int(smooth) if int(smooth) > 0 else int(period)
    alpha = 2.0 / (1.0 + n)
    smth = df["high"].ewm(alpha=alpha, adjust=False).mean()
    smtl = df["low"].ewm(alpha=alpha, adjust=False).mean()
    smtc = df["close"].ewm(alpha=alpha, adjust=False).mean()

    mx = smth.rolling(period, min_periods=1).max()
    mn = smtl.rolling(period, min_periods=1).min()
    val = (-(mx - smtc) * 100.0 / (mx - mn).replace(0, np.nan)).fillna(0.0)

    vmax = val.rolling(period, min_periods=1).max()
    vmin = val.rolling(period, min_periods=1).min()
    vr = (vmax - vmin) / 100.0
    return val, vmin + fl_up*vr, vmin + fl_dn*vr, vmin + 50.0*vr


def _b(x) -> np.ndarray:
    """Series booleana → array bool com NaN=False."""
    return x.fillna(False).to_numpy(dtype=bool)



# ─── Blocos: cada um retorna (long_cond, short_cond) como arrays bool ─────────
# directional=True define o lado; filter=True vale igual pros dois lados.

def _blk_rsi_extreme(df, p):
    r = _rsi(df["close"], p["period"]); lv = p["level"]
    return _b(r < lv), _b(r > 100 - lv)

def _blk_rsi_trend(df, p):
    r = _rsi(df["close"], p["period"])
    return _b(r > 50), _b(r < 50)

def _blk_ema_stack(df, p):
    f, s = _ema(df["close"], p["fast"]), _ema(df["close"], p["slow"])
    return _b(f > s), _b(f < s)

def _blk_ema_cross(df, p):
    f, s = _ema(df["close"], p["fast"]), _ema(df["close"], p["slow"])
    up = (f > s) & (f.shift(1) <= s.shift(1))
    dn = (f < s) & (f.shift(1) >= s.shift(1))
    return _b(up), _b(dn)

def _blk_price_ema(df, p):
    e = _ema(df["close"], p["period"])
    return _b(df["close"] > e), _b(df["close"] < e)

def _blk_macd_state(df, p):
    m, sg = _macd(df["close"], p["fast"], p["slow"], p["signal"])
    return _b(m > sg), _b(m < sg)

def _blk_macd_cross(df, p):
    m, sg = _macd(df["close"], p["fast"], p["slow"], p["signal"])
    up = (m > sg) & (m.shift(1) <= sg.shift(1))
    dn = (m < sg) & (m.shift(1) >= sg.shift(1))
    return _b(up), _b(dn)

def _blk_bb_fade(df, p):
    up, lo = _bands(df["close"], p["period"], p["dev"])
    return _b(df["close"] < lo), _b(df["close"] > up)

def _blk_bb_break(df, p):
    up, lo = _bands(df["close"], p["period"], p["dev"])
    return _b(df["close"] > up), _b(df["close"] < lo)

def _blk_donchian(df, p):
    hh = df["high"].rolling(p["lookback"]).max().shift(1)
    ll = df["low"].rolling(p["lookback"]).min().shift(1)
    return _b(df["close"] > hh), _b(df["close"] < ll)

def _blk_stoch(df, p):
    st = _stoch(df, p["k"], 3); lv = p["level"]
    return _b(st < lv), _b(st > 100 - lv)

def _blk_cci(df, p):
    c = _cci(df, p["period"]); lv = p["level"]
    return _b(c < -lv), _b(c > lv)

def _blk_momentum(df, p):
    m = _mom(df["close"], p["period"])
    return _b(m > 0), _b(m < 0)

def _blk_adx_filter(df, p):
    a = _adx(df, p["period"]) > p["level"]
    v = _b(a)
    return v, v   # regime forte: mesma condição pros dois lados

def _blk_ema200_filter(df, p):
    e = _ema(df["close"], 200)
    return _b(df["close"] > e), _b(df["close"] < e)

def _blk_t3_trend(df, p):
    t = _t3(df["close"], p["period"], p.get("vfactor", 0.7))
    return _b(df["close"] > t), _b(df["close"] < t)

def _blk_supertrend_state(df, p):
    trend = _supertrend(df, p["period"], p["multiplier"])
    return _b(trend == 1), _b(trend == -1)

def _blk_hma_cross(df, p):
    hf = _hma(df["close"], p["fast"])
    hs = _hma(df["close"], p["slow"])
    return _b(hf > hs), _b(hf < hs)


def _blk_stoch_cross(df, p):
    ll = df["low"].rolling(p["k"]).min()
    hh = df["high"].rolling(p["k"]).max()
    k_line = (100 * (df["close"] - ll) / (hh - ll).replace(0, np.nan)).rolling(3).mean()
    d_line = k_line.rolling(3).mean()
    up = (k_line > d_line) & (k_line.shift(1) <= d_line.shift(1))
    dn = (k_line < d_line) & (k_line.shift(1) >= d_line.shift(1))
    return _b(up), _b(dn)


def _blk_di_cross(df, p):
    up = df["high"].diff(); dn = -df["low"].diff()
    plus = np.where((up > dn) & (up > 0), up, 0.0)
    minus = np.where((dn > up) & (dn > 0), dn, 0.0)
    atr = _atr(df, p["period"]).replace(0, np.nan)
    pdi = 100 * pd.Series(plus, index=df.index).ewm(alpha=1/p["period"], adjust=False).mean() / atr
    mdi = 100 * pd.Series(minus, index=df.index).ewm(alpha=1/p["period"], adjust=False).mean() / atr
    up_c = (pdi > mdi) & (pdi.shift(1) <= mdi.shift(1))
    dn_c = (pdi < mdi) & (pdi.shift(1) >= mdi.shift(1))
    return _b(up_c), _b(dn_c)


def _blk_cci_zero_cross(df, p):
    c = _cci(df, p["period"])
    up = (c > 0) & (c.shift(1) <= 0)
    dn = (c < 0) & (c.shift(1) >= 0)
    return _b(up), _b(dn)


def _blk_t3_velocity(df, p):
    """T3 velocity (forex-tsd). Dois modos, espelhando as 2 cores do indicador:
      zero  -> cor do HISTOGRAMA: vel>0 verde (long) / vel<0 vermelho (short)
      slope -> cor da LINHA: vel subindo (long) / vel descendo (short)"""
    v = _t3_velocity(df["close"], p["period"], p.get("hot", 1.0),
                     p.get("original", False))
    if p.get("mode", "zero") == "slope":
        return _b(v > v.shift(1)), _b(v < v.shift(1))
    return _b(v > 0), _b(v < 0)


def _blk_wpr_floating(df, p):
    """WPR suavizado + níveis flutuantes (mladen). Três modos:
      break -> rompe o nível de cima = long (momentum; é como o indicador colore)
      fade  -> rompe o nível de cima = short (reversão à média)
      zero  -> acima do nível médio = long"""
    val, levu, levd, levm = _wpr_floating(df, p["period"], p.get("smooth", 0),
                                          p.get("fl_up", 90.0), p.get("fl_dn", 10.0))
    m = p.get("mode", "break")
    if m == "fade":
        return _b(val < levd), _b(val > levu)
    if m == "zero":
        return _b(val > levm), _b(val < levm)
    return _b(val > levu), _b(val < levd)


# nome → (func, directional?, gerador de params)
_R = random
BLOCKS = {
    "rsi_extreme":  (_blk_rsi_extreme,  True,  lambda r: {"period": r.choice([7,9,14,21]), "level": r.choice([20,25,30])}),
    "rsi_trend":    (_blk_rsi_trend,    True,  lambda r: {"period": r.choice([9,14,21])}),
    "t3_trend":     (_blk_t3_trend,     True,  lambda r: {"period": r.choice([7,9,14,21]), "vfactor": 0.7}),
    # T3 velocity (forex-tsd): iT3(hot) - iT3(hot/2). Velocidade do T3, != t3_trend.
    "t3_velocity":  (_blk_t3_velocity,  True,  lambda r: {"period": r.choice([7,9,14,21,30]),
                                                          "hot": r.choice([0.5,0.7,1.0]),
                                                          "original": r.choice([False,True]),
                                                          "mode": r.choice(["zero","slope"])}),
    # WPR suavizado com níveis flutuantes (mladen 2019)
    "wpr_floating": (_blk_wpr_floating, True,  lambda r: {"period": r.choice([9,14,21,25,34]),
                                                          "smooth": r.choice([0,3,5]),
                                                          "fl_up": r.choice([80.0,90.0]),
                                                          "fl_dn": r.choice([10.0,20.0]),
                                                          "mode": r.choice(["break","fade","zero"])}),
    "supertrend_state": (_blk_supertrend_state, True, lambda r: {"period": r.choice([7,10,14]), "multiplier": r.choice([1.5,2.0,3.0])}),
    "hma_cross":    (_blk_hma_cross,    True,  lambda r: {"fast": r.choice([9,14,21]), "slow": r.choice([35,50,80])}),

    "ema_stack":    (_blk_ema_stack,    True,  lambda r: _fast_slow(r)),
    "ema_cross":    (_blk_ema_cross,    True,  lambda r: _fast_slow(r)),
    "price_ema":    (_blk_price_ema,    True,  lambda r: {"period": r.choice([20,50,100,150])}),
    "macd_state":   (_blk_macd_state,   True,  lambda r: _macd_p(r)),
    "macd_cross":   (_blk_macd_cross,   True,  lambda r: _macd_p(r)),
    "bb_fade":      (_blk_bb_fade,      True,  lambda r: {"period": r.choice([14,20,28]), "dev": r.choice([1.5,2.0,2.5])}),
    "bb_break":     (_blk_bb_break,     True,  lambda r: {"period": r.choice([14,20,28]), "dev": r.choice([1.5,2.0,2.5])}),
    "donchian":     (_blk_donchian,     True,  lambda r: {"lookback": r.choice([10,20,30,40,55])}),
    "stoch":        (_blk_stoch,        True,  lambda r: {"k": r.choice([9,14,21]), "level": r.choice([15,20,25])}),
    "stoch_cross":  (_blk_stoch_cross,  True,  lambda r: {"k": r.choice([9,14,21])}),
    "cci":          (_blk_cci,          True,  lambda r: {"period": r.choice([14,20,30]), "level": r.choice([100,150,200])}),
    "cci_zero":     (_blk_cci_zero_cross, True, lambda r: {"period": r.choice([14,20,30])}),
    "momentum":     (_blk_momentum,     True,  lambda r: {"period": r.choice([10,20,40])}),
    "adx_filter":   (_blk_adx_filter,   False, lambda r: {"period": 14, "level": r.choice([20,25,30])}),
    "di_cross":     (_blk_di_cross,     True,  lambda r: {"period": r.choice([9,14,21])}),
    "trend_filter": (_blk_ema200_filter,False, lambda r: {}),
}
_DIRECTIONAL = [k for k, v in BLOCKS.items() if v[1]]
_FILTERS = [k for k, v in BLOCKS.items() if not v[1]]


def _fast_slow(r):
    fast = r.choice([5, 8, 12, 16, 20, 30])
    slow = r.choice([40, 50, 60, 80, 120, 200])
    return {"fast": fast, "slow": slow}

def _macd_p(r):
    return {"fast": r.choice([8, 12, 16]), "slow": r.choice([21, 26, 34]), "signal": r.choice([7, 9])}


def build_signals(df: pd.DataFrame, blocks: list[dict]) -> np.ndarray:
    """AND das condições dos blocos → sinal +1/-1/0 por barra."""
    n = len(df)
    long_c = np.ones(n, dtype=bool)
    short_c = np.ones(n, dtype=bool)
    for blk in blocks:
        fn = BLOCKS[blk["name"]][0]
        lc, sc = fn(df, blk["params"])
        long_c &= lc
        short_c &= sc
    sig = np.zeros(n, dtype=int)
    sig[short_c] = -1
    sig[long_c] = 1   # long vence se ambos (raro)
    return sig


def random_strategy(rng: random.Random) -> list[dict]:
    """1-3 blocos, garantindo >=1 direcional. Réplica do SQX random build."""
    k = rng.choice([1, 1, 2, 2, 2, 3])   # viés a 2 condições
    chosen: list[dict] = []
    names: set[str] = set()
    # 1º sempre direcional
    d = rng.choice(_DIRECTIONAL)
    names.add(d)
    chosen.append({"name": d, "params": BLOCKS[d][2](rng)})
    pool = [b for b in list(BLOCKS.keys()) if b not in names]
    for _ in range(k - 1):
        if not pool:
            break
        b = rng.choice(pool)
        pool.remove(b)
        chosen.append({"name": b, "params": BLOCKS[b][2](rng)})
    return chosen


def strategy_label(blocks: list[dict]) -> str:
    return " + ".join(b["name"] for b in blocks)

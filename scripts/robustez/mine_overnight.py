"""
Minerador CONTÍNUO — roda a noite toda sem parar.
=================================================
O genetic.py roda uma rodada por símbolo×timeframe e termina. Este wrapper
fica em loop, cada rodada com uma SEMENTE nova (populações e estratégias
diferentes), acumulando sobreviventes num arquivo só até você mandar parar.

Por que semente nova a cada rodada: o genético é estocástico — rodar 20x com
sementes diferentes explora regiões diferentes do espaço de estratégias. Rodar
com a mesma semente daria sempre o mesmo resultado.

Dedupe: sobrevivente é identificado por (símbolo, timeframe, exit_mode,
direction, blocos+params). Rodadas diferentes que caem na mesma estratégia
não duplicam.

ATENÇÃO ESTATÍSTICA: quanto mais você minera, mais candidatos passam no holdout
POR SORTE (multiple testing). O nº de rodadas fica registrado no arquivo pra
você saber o tamanho do funil — 500 sobreviventes de 50 rodadas não é a mesma
coisa que 500 de 2 rodadas.

Uso:
    python mine_overnight.py                       # USDJPY, H1+H4, até parar
    python mine_overnight.py --until 07:00         # para às 7h da manhã
    python mine_overnight.py --symbols USDJPY --timeframes H1,H4,M30
    # parar antes: cria o arquivo _STOP_MINING nesta pasta, ou Ctrl+C
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_AQUI = os.path.dirname(os.path.abspath(__file__))
STOP_FILE = os.path.join(_AQUI, "_STOP_MINING")
LOCK_FILE = os.path.join(_AQUI, "_MINING.lock")


def _ja_rodando() -> int:
    """PID de outra instância viva, ou 0. Sem isto, o atalho do Inicializar +
    um duplo-clique no .bat = dois mineradores escrevendo no MESMO json, que se
    corrompem mutuamente."""
    if not os.path.exists(LOCK_FILE):
        return 0
    try:
        pid = int(open(LOCK_FILE).read().strip())
    except (ValueError, OSError):
        return 0
    if pid == os.getpid():
        return 0
    try:
        import subprocess
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                             capture_output=True, text=True, timeout=15).stdout
        return pid if str(pid) in out else 0
    except Exception:  # noqa: BLE001 — na dúvida, deixa rodar
        return 0


def _key(s: dict) -> str:
    """Identidade da ESTRATEGIA. Os blocos sao combinados com E (AND), que e
    comutativo — [A,B] e [B,A] sao a mesma coisa. Por isso os blocos sao
    canonizados e ORDENADOS antes de entrar na chave (json.dumps(sort_keys=True)
    ordena as chaves do dict, NAO a ordem da lista — foi o que gerou 23 EAs
    duplicados na vitrine)."""
    sd = s.get("strategyDef", {})
    blocos = sorted(json.dumps(b, sort_keys=True, ensure_ascii=False)
                    for b in (sd.get("blocks") or []))
    return (f"{s['symbol']}|{s['timeframe']}|{s.get('exit_mode')}|{s.get('direction')}"
            f"|{sd.get('sl_atr')}|{sd.get('tp_atr')}|{'|'.join(blocos)}")


def main():
    ap = argparse.ArgumentParser(description="Mineração genética contínua (a noite toda)")
    ap.add_argument("--symbols", default="USDJPY")
    ap.add_argument("--timeframes", default="H1,H4")
    ap.add_argument("--years", type=float, default=4.0)
    ap.add_argument("--pop", type=int, default=70)
    ap.add_argument("--gen", type=int, default=20)
    ap.add_argument("--keep", type=int, default=6)
    ap.add_argument("--seed0", type=int, default=1000)
    ap.add_argument("--out", default="survivors_usdjpy_overnight.json")
    ap.add_argument("--until", default="", help="hora de parar, ex: 07:00 (vazio = até você parar)")
    args = ap.parse_args()

    stop_at = None
    if args.until:
        hh, mm = (int(x) for x in args.until.split(":"))
        now = datetime.now()
        stop_at = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if stop_at <= now:
            stop_at += timedelta(days=1)

    outro = _ja_rodando()
    if outro:
        print(f"[noite] JA existe um minerador rodando (PID {outro}). Saindo pra nao "
              f"corromper o {args.out}. Pare o outro antes, ou use --out diferente.",
              flush=True)
        raise SystemExit(0)
    with open(LOCK_FILE, "w") as f:
        f.write(str(os.getpid()))

    if os.path.exists(STOP_FILE):
        os.remove(STOP_FILE)

    import mt5_data
    import genetic

    # retoma o que já existe (não perde nada se reiniciar)
    survivors: list[dict] = []
    if os.path.exists(args.out):
        try:
            survivors = json.load(open(args.out, encoding="utf-8"))
            print(f"[noite] retomando com {len(survivors)} sobreviventes de antes", flush=True)
        except Exception:
            survivors = []
    seen = {_key(s) for s in survivors}

    print(f"[noite] simbolos={args.symbols} tfs={args.timeframes} anos={args.years:.0f}", flush=True)
    print(f"[noite] parar: {'às ' + args.until if stop_at else 'só com _STOP_MINING ou Ctrl+C'}", flush=True)

    rodada = 0
    t_ini = time.time()
    try:
        while True:
            if os.path.exists(STOP_FILE):
                print("[noite] _STOP_MINING encontrado — encerrando.", flush=True)
                break
            if stop_at and datetime.now() >= stop_at:
                print(f"[noite] chegou {args.until} — encerrando.", flush=True)
                break

            rodada += 1
            seed = args.seed0 + rodada
            rng = random.Random(seed)
            novos_rodada = 0
            print(f"\n[noite] ===== RODADA {rodada} (seed {seed}) — "
                  f"{(time.time()-t_ini)/3600:.1f}h rodando, {len(survivors)} acumulados =====", flush=True)

            try:
                mt5_data.connect()
                for sym in args.symbols.split(","):
                    for tf in args.timeframes.split(","):
                        if os.path.exists(STOP_FILE):
                            break
                        try:
                            df, name = mt5_data.get_candles(sym, tf, years=args.years)
                        except Exception as e:  # noqa: BLE001
                            print(f"[noite] pulei {sym} {tf}: {e}", flush=True)
                            continue
                        info = mt5_data.symbol_info(name)
                        surv = genetic.mine_symbol(df, info, name, tf, rng,
                                                   pop_size=args.pop, generations=args.gen,
                                                   keep=args.keep, verbose=True)
                        for s in surv:
                            k = _key(s)
                            if k in seen:
                                continue
                            seen.add(k)
                            s["_seed"] = seed
                            s["_rodada"] = rodada
                            survivors.append(s)
                            novos_rodada += 1
                mt5_data.shutdown()
            except Exception as e:  # noqa: BLE001 — a noite não pode cair por 1 erro
                print(f"[noite] erro na rodada {rodada}: {e} — sigo na proxima", flush=True)
                try:
                    mt5_data.shutdown()
                except Exception:
                    pass
                time.sleep(20)

            # grava a cada rodada: se a maquina cair, nada se perde
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump(survivors, f, ensure_ascii=False)
            meta = {"rodadas": rodada, "sobreviventes": len(survivors),
                    "simbolos": args.symbols, "timeframes": args.timeframes,
                    "horas": round((time.time()-t_ini)/3600, 2),
                    "atualizado": datetime.now().isoformat()}
            json.dump(meta, open(args.out.replace(".json", "_meta.json"), "w",
                                 encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"[noite] rodada {rodada}: +{novos_rodada} novos | total {len(survivors)}", flush=True)

    except KeyboardInterrupt:
        print("\n[noite] Ctrl+C — encerrando.", flush=True)
    finally:
        try:
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)
        except OSError:
            pass

    print(f"\n[noite] FIM — {rodada} rodadas, {len(survivors)} sobreviventes em {args.out}", flush=True)
    print(f"[noite] tempo total: {(time.time()-t_ini)/3600:.1f}h", flush=True)
    print(f"[noite] LEMBRE: {len(survivors)} sobreviventes de {rodada} rodadas — quanto maior o "
          f"funil, mais candidatos passam por sorte. Revalide antes de publicar.", flush=True)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()

"""
Auto-publish incremental dos sobreviventes da mineração — sempre em STAGED.
====================================================================
Chamado pelo mine_overnight.py ao fim de cada rodada (e roda sozinho via CLI).

O que faz, de forma INCREMENTAL e à prova de queda:
  1. Lê survivors_m30.json e o ledger _published.json (DNAs já processados).
  2. Seleciona só os sobreviventes AINDA NÃO processados.
  3. Roda `publish.py --survivors <tmp>` (sem --approve → entra como STAGED):
     re-valida cada um no período cheio, pula os que reprovam, compila o .ex5,
     sobe pro storage e monta to_publish.json.
  4. Roda `npx tsx publish_db.ts` pra inserir/atualizar no banco.
  5. SÓ se as duas etapas saírem com sucesso, grava os DNAs no ledger.

Por que ledger + STAGED:
  - Ledger = idempotência: cada sobrevivente é processado UMA vez. Sem ele,
    republicar o arquivo inteiro toda rodada re-roda backtest de todo mundo e
    (pior) o upsert reescreveria status. Com o fix no publish_db.ts o status não
    é mais rebaixado, mas o ledger ainda evita o trabalho repetido.
  - STAGED = nada aparece pro assinante sem o dono promover no admin. Auto-
    publicar em STAGED é seguro por definição: a vitrine só mostra APPROVED.

Se publish.py PULAR um sobrevivente (reprovou na re-validação), ele mesmo assim
entra no ledger — a re-validação é determinística, retentar toda rodada só
gastaria backtest à toa. Pra forçar reprocessar tudo: apague _published.json.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

_AQUI = os.path.dirname(os.path.abspath(__file__))
SURVIVORS = os.path.join(_AQUI, "survivors_m30.json")
LEDGER = os.path.join(_AQUI, "_published.json")
TMP_INPUT = os.path.join(_AQUI, "_autopublish_input.json")


def _dna(s: dict) -> str:
    """Identidade estável do sobrevivente — igual ao dna_raw do publish.py, pra
    o ledger casar com o EA gerado."""
    params = s.get("params") or {}
    params_str = json.dumps(params, sort_keys=True)
    return (f"{s.get('symbol')}:{s.get('timeframe')}:{s.get('family')}:"
            f"{s.get('direction', 'both')}:{s.get('exit_mode')}:{params_str}")


def _load_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


def run_once(python_exe: str | None = None, survivors_path: str = SURVIVORS) -> dict:
    """Publica os sobreviventes ainda não processados. Retorna um resumo.
    NUNCA levanta — devolve {'error': ...} em caso de falha, pra não derrubar o
    minerador que o chama."""
    python_exe = python_exe or sys.executable
    result = {"novos": 0, "processados": 0, "publicados_db": 0, "error": None}

    survivors = _load_json(survivors_path, [])
    if not isinstance(survivors, list) or not survivors:
        return result

    ledger = set(_load_json(LEDGER, []))
    novos = [s for s in survivors if _dna(s) not in ledger]
    result["novos"] = len(novos)
    if not novos:
        return result

    try:
        with open(TMP_INPUT, "w", encoding="utf-8") as f:
            json.dump(novos, f, ensure_ascii=False)

        # 1) publish.py — STAGED por padrão (sem --approve). Re-valida, compila,
        #    sobe o .ex5 e monta to_publish.json.
        r1 = subprocess.run(
            [python_exe, os.path.join(_AQUI, "publish.py"), "--survivors", TMP_INPUT],
            cwd=_AQUI, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=1800,
        )
        sys.stdout.write(r1.stdout)
        if r1.returncode != 0:
            result["error"] = f"publish.py saiu {r1.returncode}: {r1.stderr[-400:]}"
            return result

        # 2) publish_db.ts — insere/atualiza no banco (status só no create).
        r2 = subprocess.run(
            ["npx", "--yes", "tsx", os.path.join(_AQUI, "publish_db.ts")],
            cwd=os.path.dirname(os.path.dirname(_AQUI)),  # raiz do projeto (.env.local)
            capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=600, shell=(os.name == "nt"),
        )
        sys.stdout.write(r2.stdout)
        if r2.returncode != 0:
            result["error"] = f"publish_db.ts saiu {r2.returncode}: {r2.stderr[-400:]}"
            return result

        # 3) sucesso das duas etapas → grava os DNAs no ledger (idempotência).
        for s in novos:
            ledger.add(_dna(s))
        with open(LEDGER, "w", encoding="utf-8") as f:
            json.dump(sorted(ledger), f, ensure_ascii=False, indent=1)

        result["processados"] = len(novos)
        # nº realmente inserido: linhas EA no to_publish.json (pode ser < novos,
        # pois reprovados na re-validação são pulados)
        rows = _load_json(os.path.join(_AQUI, "to_publish.json"), [])
        result["publicados_db"] = sum(1 for r in rows if r.get("table") == "EA") \
            if isinstance(rows, list) else 0
    except Exception as e:  # noqa: BLE001 — o minerador não pode cair por isto
        result["error"] = f"{type(e).__name__}: {e}"
    finally:
        try:
            if os.path.exists(TMP_INPUT):
                os.remove(TMP_INPUT)
        except OSError:
            pass

    return result


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    res = run_once()
    print(f"[autopublish] {res}")
    sys.exit(1 if res.get("error") else 0)

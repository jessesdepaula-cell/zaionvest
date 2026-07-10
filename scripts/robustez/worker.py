"""
Worker de robustez — roda no PC/VPS Windows com o MT5 RoboForex aberto.

Loop: pede um job à API (/api/worker/next) → executa (revalidação = pipeline
DQ Labs sobre dados reais do MT5) → devolve o resultado (/api/worker/complete).
A API aplica o status do EA e as notificações; o worker só faz o trabalho pesado.

Envs:
  EA_API_BASE   — base da app (ex: https://zaionvest.vercel.app)
  CRON_SECRET   — mesmo secret dos endpoints de worker/cron
  WORKER_ID     — nome desta máquina (opcional)
  POLL_SECONDS  — intervalo quando a fila está vazia (default 15)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import pipeline  # noqa: E402

API_BASE = os.environ.get("EA_API_BASE", "https://zaionvest.vercel.app").rstrip("/")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
WORKER_ID = os.environ.get("WORKER_ID", os.environ.get("COMPUTERNAME", "worker"))
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "15"))

FAMILY_FROM_STYLE = {"trend": "trend", "reversal": "mean_reversion",
                     "mean_reversion": "mean_reversion", "breakout": "breakout"}


def _post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {CRON_SECRET}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def _run_revalidation(job: dict) -> dict:
    ea = job.get("ea") or {}
    sdef = ea.get("strategyDef") or {}
    family = sdef.get("family") or FAMILY_FROM_STYLE.get(ea.get("style", ""), "trend")
    exit_mode = sdef.get("exit_mode") or ea.get("exitMode") or "reversal"
    params = {k: v for k, v in sdef.items() if k not in ("family", "exit_mode")}
    return pipeline.run_pipeline(
        ea_id=ea.get("id", job.get("eaId", "unknown")),
        ea_name=ea.get("name", "EA"),
        symbol=ea.get("symbol", "EURUSD"),
        timeframe=ea.get("timeframe", "H1"),
        family=family,
        exit_mode=exit_mode,
        params=params or None,
    )


def process(job: dict) -> None:
    job_id = job["id"]
    jtype = job.get("type")
    try:
        if jtype == "REVALIDATE":
            result = _run_revalidation(job)
            _post("/api/worker/complete", {"jobId": job_id, "result": result})
            print(f"[worker] REVALIDATE {job_id} → approved={result['approved']}")
        else:
            # MINE ainda não implementado (loop de geração de candidatos é o
            # próximo passo — decisão grid vs genético).
            _post("/api/worker/complete",
                  {"jobId": job_id, "error": f"tipo '{jtype}' ainda não suportado"})
            print(f"[worker] {jtype} {job_id} → marcado ERROR (não suportado)")
    except Exception as e:  # noqa: BLE001
        _post("/api/worker/complete", {"jobId": job_id, "error": str(e)})
        print(f"[worker] {jtype} {job_id} → ERRO: {e}")


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if not CRON_SECRET:
        print("[worker] AVISO: CRON_SECRET vazio — a API vai rejeitar as chamadas.")
    print(f"[worker] {WORKER_ID} → {API_BASE} (poll {POLL_SECONDS}s). Ctrl+C para parar.")
    while True:
        try:
            resp = _post("/api/worker/next", {"workerId": WORKER_ID})
            job = resp.get("job")
            if job:
                process(job)
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("\n[worker] encerrado.")
            break
        except Exception as e:  # noqa: BLE001
            print(f"[worker] erro no loop: {e}; retry em {POLL_SECONDS}s")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

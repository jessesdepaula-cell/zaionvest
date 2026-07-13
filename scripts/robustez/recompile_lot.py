"""
Re-compila os .ex5 já publicados com o lote padrão atual (0.01) e re-envia pro
Storage, sobrescrevendo. NÃO mexe no banco/métricas — só troca o binário para
que o InpLot padrão seja 0.01. Uso: SUPABASE_MGMT_TOKEN=... python recompile_lot.py
"""
from __future__ import annotations
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("EA_STATUS_URL_BASE", "https://zaionvest.com.br/api/ea")
import compiler

REF = "kpijsnygzqgpjxxikpig"
TOK = os.environ.get("SUPABASE_MGMT_TOKEN", "") or open(
    os.path.join(os.path.dirname(__file__), ".mgmt_token")).read().strip()


def _curl(args, data=None):
    return subprocess.run(["curl", "-s", "--max-time", "60"] + args,
                          capture_output=True, input=data).stdout.decode("utf-8", "replace")


def q(sql):
    body = json.dumps({"query": sql}).encode()
    return json.loads(_curl(["-X", "POST", "-H", f"Authorization: Bearer {TOK}",
                             "-H", "Content-Type: application/json", "--data-binary", "@-",
                             f"https://api.supabase.com/v1/projects/{REF}/database/query"], body))


def service_key():
    keys = json.loads(_curl(["-H", f"Authorization: Bearer {TOK}",
                             f"https://api.supabase.com/v1/projects/{REF}/api-keys"]))
    return next(k["api_key"] for k in keys if k["name"] == "service_role")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    svc = service_key()
    eas = q('select id, slug, "strategyDef" sd from "EA" where status=\'APPROVED\';')
    print(f"{len(eas)} EAs para re-compilar com lote {compiler.FIXED_LOT}\n")
    ok = fail = 0
    for e in eas:
        sd = e["sd"] or {}
        fam = sd.get("family", "trend")
        mode = sd.get("exit_mode", "fixed_sltp")
        direction = sd.get("direction", "both")
        comp = compiler.compile_ea(ea_id=e["id"], family=fam, exit_mode=mode,
                                   params=sd, name=f"RELOT_{e['slug'].replace('-', '_')}",
                                   direction=direction)
        if not comp.ok:
            print(f"  ✗ {e['slug']}: compilação falhou"); fail += 1; continue
        up = _curl(["-X", "POST", "-H", f"Authorization: Bearer {svc}",
                    "-H", "x-upsert: true", "-H", "Content-Type: application/octet-stream",
                    "--data-binary", f"@{comp.ex5_path}",
                    f"https://{REF}.supabase.co/storage/v1/object/ea-files/{e['slug']}.ex5"])
        if '"Key"' in up or "Id" in up:
            print(f"  ✔ {e['slug']}"); ok += 1
        else:
            print(f"  ✗ {e['slug']}: upload {up[:120]}"); fail += 1
        for ext in (".ex5", ".mq5", ".log"):
            try: os.remove(comp.ex5_path.replace(".ex5", ext))
            except OSError: pass
    print(f"\n{ok} re-compilados/enviados, {fail} falhas.")


if __name__ == "__main__":
    main()

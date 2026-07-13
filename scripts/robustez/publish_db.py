"""
2º passo do publish (dep-free): lê to_publish.json (gerado por publish.py) e
insere as linhas EA/EAValidation no Supabase via Management API.

Alternativa ao publish_db.ts (que exige `tsx`/Prisma). Usa o SUPABASE_MGMT_TOKEN
(mesmo do publish.py). Dedup por slug: se o EA já existe, PULA (não duplica).

Uso:  SUPABASE_MGMT_TOKEN=... python publish_db.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

REF = "kpijsnygzqgpjxxikpig"
SB_TOKEN = os.environ.get("SUPABASE_MGMT_TOKEN", "") or (
    open(os.path.join(os.path.dirname(__file__), ".mgmt_token")).read().strip()
    if os.path.exists(os.path.join(os.path.dirname(__file__), ".mgmt_token"))
    else ""
)
HERE = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(HERE, "to_publish.json")


def q(sql: str):
    body = json.dumps({"query": sql}).encode("utf-8")
    r = subprocess.run(
        ["curl", "-s", "--max-time", "60", "-X", "POST",
         "-H", f"Authorization: Bearer {SB_TOKEN}",
         "-H", "Content-Type: application/json", "--data-binary", "@-",
         f"https://api.supabase.com/v1/projects/{REF}/database/query"],
        capture_output=True, input=body,
    )
    return json.loads(r.stdout.decode("utf-8", errors="replace"))


def insert(table: str, row: dict):
    payload = json.dumps([row], ensure_ascii=False)
    tag = "$qmpub$"
    if tag in payload:
        raise RuntimeError("dollar-quote colidiu")
    res = q(f'insert into "{table}" select * from '
            f'jsonb_populate_recordset(null::"{table}", {tag}{payload}{tag}::jsonb);')
    if isinstance(res, dict) and res.get("message"):
        raise RuntimeError(f"{table}: {res['message'][:300]}")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if not SB_TOKEN:
        raise SystemExit("defina SUPABASE_MGMT_TOKEN (ou crie .mgmt_token)")
    if not os.path.exists(JSON_PATH):
        raise SystemExit(f"{JSON_PATH} não encontrado — rode publish.py antes")

    rows = json.load(open(JSON_PATH, encoding="utf-8"))
    # slugs já existentes → dedup
    existing = {r["slug"] for r in q('select slug from "EA";') if isinstance(r, dict)}

    eas = vals = skipped = 0
    published_ids: set[str] = set()
    for row in rows:
        data = row["data"]
        if row["table"] == "EA":
            if data["slug"] in existing:
                skipped += 1
                continue
            insert("EA", data)
            existing.add(data["slug"])
            published_ids.add(data["id"])
            eas += 1
            print(f"  ✔ {data['name']}")
        elif row["table"] == "EAValidation":
            # só insere a validação se o EA correspondente foi inserido (evita
            # FK órfã quando o EA foi pulado por slug duplicado)
            if data.get("eaId") not in published_ids:
                continue
            insert("EAValidation", data)
            vals += 1

    print(f"\n{eas} EA(s) inseridos, {vals} validações, {skipped} pulados (slug já existia).")
    try:
        os.remove(JSON_PATH)
    except OSError:
        pass


if __name__ == "__main__":
    main()

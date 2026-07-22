"""
Script para inspecionar todos os candidatos em survivors_overnight.json,
filtrar com Ret/DD >= 2.0, compilar .ex5 e publicar DIRETAMENTE no Supabase.
"""
import os
import sys
import json
import subprocess

_AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _AQUI)

import mt5_data
import compiler
import pipeline
from backtest import run_backtest

def main():
    survivors_path = os.path.join(_AQUI, "survivors_overnight.json")
    if not os.path.exists(survivors_path):
        print("Arquivo survivors_overnight.json não encontrado.")
        return

    with open(survivors_path, "r", encoding="utf-8") as f:
        survivors = json.load(f)

    print(f"Total de candidatos salvos no disco: {len(survivors)}")

    # Filtra apenas candidatos com oosRetDd >= 2.0
    valid_candidates = [s for s in survivors if (s.get("oosRetDd") or 0) >= 2.0]
    print(f"Candidatos com Ret/DD OOS >= 2.0: {len(valid_candidates)}")

    # Conta por símbolo
    by_sym = {}
    for s in valid_candidates:
        sym = s["symbol"]
        by_sym[sym] = by_sym.get(sym, 0) + 1

    print("Distribuição por ativo no arquivo de candidatos:")
    print(json.dumps(by_sym, indent=2))

    # Limpa _published.json e roda autopublish
    ledger = os.path.join(_AQUI, "_published.json")
    with open(ledger, "w", encoding="utf-8") as f:
        f.write("[]")

    import autopublish
    res = autopublish.run_once(sys.executable, survivors_path=survivors_path)
    print("\nResultado do Autopublish:", res)

if __name__ == "__main__":
    main()

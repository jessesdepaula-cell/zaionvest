"""
Script para restaurar TODAS as estratégias validadas de XAUUSD e XAUEUR
de volta para o banco de dados (Supabase) como APPROVED.
"""
import os
import sys
import json
import subprocess

_AQUI = os.path.dirname(os.path.abspath(__file__))
python_exe = sys.executable

def main():
    survivors_file = os.path.join(_AQUI, "survivors_overnight.json")
    if not os.path.exists(survivors_file):
        print("Arquivo survivors_overnight.json não encontrado.")
        return

    print("Restaurando estratégias validadas para o Supabase (com --approve)...")
    
    # 1. Reseta o ledger de publicação para permitir re-publicar os candidatos do JSON
    ledger_file = os.path.join(_AQUI, "_published.json")
    with open(ledger_file, "w", encoding="utf-8") as f:
        f.write("[]")

    # 2. Executa o autopublish
    import autopublish
    res = autopublish.run_once(python_exe, survivors_path=survivors_file)
    print("Resultado da restauração:", res)

if __name__ == "__main__":
    main()

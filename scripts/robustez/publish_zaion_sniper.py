import os
import json
import secrets
import subprocess
import string
from datetime import datetime, timezone

# Caminho do projeto
HERE = os.path.dirname(os.path.abspath(__file__))
REF = "kpijsnygzqgpjxxikpig"

# Puxa o token do Supabase
SB_TOKEN = ""
token_path = os.path.join(HERE, ".mgmt_token")
if os.path.exists(token_path):
    SB_TOKEN = open(token_path).read().strip()

if not SB_TOKEN:
    raise SystemExit("Erro: .mgmt_token nao encontrado!")

import compiler

def _curl(args: list[str], data: bytes | None = None) -> str:
    r = subprocess.run(["curl", "-s", "--max-time", "60"] + args,
                       capture_output=True, input=data)
    return r.stdout.decode("utf-8", errors="replace")

def q(sql: str):
    body = json.dumps({"query": sql}).encode("utf-8")
    out = _curl(["-X", "POST", "-H", f"Authorization: Bearer {SB_TOKEN}",
                 "-H", "Content-Type: application/json", "--data-binary", "@-",
                 f"https://api.supabase.com/v1/projects/{REF}/database/query"], body)
    return json.loads(out)

def service_key() -> str:
    keys = json.loads(_curl(["-H", f"Authorization: Bearer {SB_TOKEN}",
                             f"https://api.supabase.com/v1/projects/{REF}/api-keys"]))
    return next(k["api_key"] for k in keys if k["name"] == "service_role")

def insert(table: str, row: dict):
    payload = json.dumps([row], ensure_ascii=False)
    tag = "$qmpub$"
    sql = f'insert into "{table}" select * from jsonb_populate_recordset(null::"{table}", {tag}{payload}{tag}::jsonb);'
    res = q(sql)
    if isinstance(res, dict) and res.get("message"):
        # Se ja existir (ex: slug duplicado), ignora ou lanca
        if "duplicate key" in res["message"]:
            print(f"  [!] {table} ja cadastrado no banco de dados. Atualizando registro...")
            # Deleta para reinserir limpo
            if table == "EA":
                q(f"delete from \"{table}\" where id = '{row['id']}';")
                res2 = q(sql)
                if isinstance(res2, dict) and res2.get("message"):
                    raise RuntimeError(f"{table}: {res2['message'][:300]}")
            else:
                q(f"delete from \"{table}\" where \"eaId\" = '{row['eaId']}';")
                q(sql)
        else:
            raise RuntimeError(f"{table}: {res['message'][:300]}")

def main():
    print(">>> Iniciando publicacao do Zaion Sniper (NV7)...")
    
    # Paramentros do Zaion Sniper (NV7) - Replicados exatamente do print do MT5
    params = {
        "lot_buy": 0.02,
        "lot_sell": 0.01,
        "grid_step_points": 1100,
        "tp_points": 2775,
        "fib_timeframe": "PERIOD_M30",
        "swing_bars": 150,
        "fib_low_pct": 38.2,
        "fib_high_pct": 50.0,
        "ref_balance": 3000.0,
        "dd_guard_pct": 5.0,       # "DD so das vendas (% sobre ref.)" do NV7
        "dd_sells_on": True,       # NV7: fecha por DD excessivo SO nas vendas
        "prot_capital": False,     # NV7: "Ativar protecao de capital" = false
        "max_dd_pct": 5.0,         # "Limite de protecao de capital (%)" (inerte enquanto prot_capital=False)
        "cluster_min": 10,         # NV7: "Minimo de posicoes para acionar cluster" = 10
        "cluster_sobra": 11.0,
        "max_positions": 8,        # NV7: "Maximo de vendas abertas simultaneas" = 8
        "comp_on": True,           # NV7: "Ativar compensacao (lucro compras x perda vendas)" = true
        "comp_dd_pct": 3.0,        # NV7: "Drawdown (% sobre ref.) para acionar compensacao" = 3.0
        "meta_daily_on": True,     # NV7: "Ativar meta por ciclo diario" = true
        "meta_daily_pct": 2.0,     # NV7: "Meta diaria de lucro (% sobre referencia)" = 2.0
        "meta_monthly_on": True,   # NV7: "Ativar meta por ciclo mensal" = true
        "meta_monthly_pct": 20.0   # NV7: "Meta mensal de lucro (% sobre referencia)" = 20.0
    }
    
    ea_id = "zaion-sniper"
    slug = "zaion-sniper"
    name = "ZV Zaion Sniper XAUUSD H1"
    obj_path = "zaion-sniper.ex5"
    
    # 1. Compila o EA localmente
    print("1. Compilando o robo em MQL5...")
    comp = compiler.compile_ea(
        ea_id=ea_id, 
        family="nv7", 
        exit_mode="reversal",
        params=params, 
        name="Zaion_Sniper",
        direction="both", 
        lot=0.01
    )
    
    if not comp.ok:
        print("Log do compilador:")
        print(comp.log[-2000:])
        raise SystemExit("Erro: A compilacao do Zaion Sniper falhou!")
        
    print(f"  [OK] Compilado com sucesso: {comp.ex5_path}")
    
    # 2. Faz o upload pro Supabase Storage
    print("2. Enviando o executavel .ex5 para o Supabase Storage...")
    svc = service_key()
    
    # Tenta deletar se ja existir no storage
    _curl(["-X", "DELETE", "-H", f"Authorization: Bearer {svc}",
           f"https://{REF}.supabase.co/storage/v1/object/ea-files/{obj_path}"])
           
    up = _curl(["-X", "POST", "-H", f"Authorization: Bearer {svc}",
                "-H", "Content-Type: application/octet-stream",
                "--data-binary", f"@{comp.ex5_path}",
                f"https://{REF}.supabase.co/storage/v1/object/ea-files/{obj_path}"])
                
    if '"Key"' not in up and "Duplicate" not in up:
        raise SystemExit(f"Erro: O upload do .ex5 falhou! Resposta: {up}")
        
    print("  [OK] Upload do arquivo concluido!")
    
    # 3. Backtest REAL na esteira. Nada de curva inventada: a versao anterior
    #    gerava uma senoide (math.sin) rotulada como OOS e cravava wfe=89.4 /
    #    PF=1.45 / DD=12.5 na mao. Isso e track record fabricado indo pra vitrine
    #    de assinante pagante. Agora o numero vem do backtest e, se reprovar, o
    #    script NAO publica.
    print("3. Rodando o backtest real na esteira (padrao 4 anos)...")
    import datetime
    import mt5_data
    from backtest import run_backtest
    import pipeline

    mt5_data.connect()
    df, resolved = mt5_data.get_candles("XAUUSD", "H1", years=4.0)
    sinfo = mt5_data.symbol_info(resolved)
    bt = run_backtest(df, "nv7", params, point=sinfo.point,
                      contract_size=sinfo.contract_size)
    mt5_data.shutdown()

    res = pipeline.evaluate(bt.trades, ea_id, name, "XAUUSD", "H1", "nv7",
                            "reversal", equity_bar=bt.equity_bar,
                            start_capital=bt.start_capital, params=params)

    if not res["approved"]:
        falhou = [k for k, v in res["gates"].items() if not v]
        print("\n  [X] REPROVADO na esteira. Portoes que falharam:")
        for g in falhou:
            print(f"        - {g}")
        print(f"      DD {res['metrics']['max_drawdown_pct']:.1f}% | "
              f"PF {res['metrics']['profit_factor']:.2f} | "
              f"trades {res['metrics']['total_trades']}")
        raise SystemExit("Publicacao abortada: um EA reprovado nao vai pra vitrine.")

    curve = res["curve"]["points"] if isinstance(res.get("curve"), dict) \
        and "points" in res.get("curve", {}) else res.get("equityCurveOos")
    now_iso = datetime.datetime.now(timezone.utc).isoformat()
    
    # 4. Insere no Supabase
    print("4. Gravando registros na vitrine (Supabase)...")
    ea_row = {
        "id": ea_id,
        "name": name,
        "slug": slug,
        "symbol": "XAUUSD",
        "timeframe": "H1",
        "style": "grid",
        "exitMode": "reversal",
        # tudo abaixo vem do backtest real (res), nunca mais cravado na mao
        "wfe": round(res["wfe"], 1),
        "profitFactor": round(res["metrics"]["profit_factor"], 2),
        "maxDrawdown": round(res["metrics"]["max_drawdown_pct"], 1),
        "totalTrades": res["metrics"]["total_trades"],
        "oosWins": res["oosWins"],
        "oosTotalWindows": res["oosTotalWin"],
        "status": "APPROVED",   # so chega aqui se res["approved"] for True
        "fileUrl": obj_path,
        "strategyDef": {"family": "nv7", "exit_mode": "reversal", "direction": "both", "lot": 0.01, **params},
        "equityCurveOos": curve,
        "lastValidatedAt": now_iso,
        "createdAt": now_iso,
        "updatedAt": now_iso
    }
    
    val_row = {
        "id": "zaion-sniper-val",
        "eaId": ea_id,
        "wfe": round(res["wfe"], 1),
        "oosWins": res["oosWins"],
        "oosTotalWin": res["oosTotalWin"],
        "approved": True,
        "reportMd": res["reportMd"],   # relatorio real da esteira, nao texto fixo
        "windowsJson": res.get("windowsJson", []),
        "validatedAt": now_iso
    }
    
    insert("EA", ea_row)
    insert("EAValidation", val_row)
    
    print("\n=======================================================")
    print(" [OK] SUCESSO! O ZAION SNIPER FOI PUBLICADO COM PAINEL GRAFICO! [OK]")
    print("=======================================================")
    print(f"Nome: {name}")
    print(f"Slug: {slug}")
    print(f"Caminho do arquivo local: {comp.ex5_path}")
    print("=======================================================")

if __name__ == "__main__":
    main()

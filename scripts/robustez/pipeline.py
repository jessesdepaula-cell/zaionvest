"""
Pipeline de Robustez ZaionVest — Integração com o Next.js API
=============================================================
Este módulo é chamado pela rota /api/ea/[id]/validate via subprocess.
Recebe parâmetros do EA via stdin (JSON) e retorna resultado via stdout (JSON).

Uso como subprocess:
    echo '{"ea_id": "...", "ea_name": "T3 Velocity", ...}' | python pipeline.py

Uso direto:
    python pipeline.py --ea-id cuid123 --ea-name "T3 Velocity" --symbol USDJPY ...
"""

from __future__ import annotations

import json
import sys
import os
import argparse
from datetime import datetime

# Adiciona o diretório pai ao path para importar wfa.py
sys.path.insert(0, os.path.dirname(__file__))
from wfa import walk_forward_analysis, generate_report_md, Trade


# ─── Geração de Trades Sintéticos para Teste ──────────────────────────────────

def generate_stub_trades(
    ea_name: str,
    symbol: str,
    n_trades: int = 500,
    base_edge: float = 0.55,  # edge % (0.5 = sem edge, > 0.5 = lucrativo)
    seed: int = 42,
) -> list[Trade]:
    """
    Gera trades sintéticos para validação.
    
    ATENÇÃO: Isso é um stub para desenvolvimento.
    Em produção, substitua por:
    1. Importar histórico real de operações do MetaTrader 5
    2. Rodar backtest via MetaTrader (chamando o terminal via subprocess)
    3. Parsear o relatório HTML/XML exportado pelo MT5
    """
    import random
    random.seed(seed)

    trades = []
    for i in range(n_trades):
        # Simula trades com edge positivo ou negativo baseado em base_edge
        win = random.random() < base_edge
        if win:
            profit = random.uniform(10.0, 150.0)
        else:
            profit = -random.uniform(8.0, 80.0)  # Stop menor que alvo (RR > 1)
        trades.append(Trade(profit=round(profit, 2)))

    return trades


# ─── Pipeline Principal ────────────────────────────────────────────────────────

def run_pipeline(
    ea_id: str,
    ea_name: str,
    symbol: str,
    timeframe: str,
    exit_mode: str = "reversal",
    n_windows: int = 6,
    is_ratio: float = 0.7,
    trades_file: str | None = None,
) -> dict:
    """
    Executa o pipeline completo de robustez DQ Labs.
    
    Stages:
    1. Carrega ou gera trades (backtest data)
    2. Walk Forward Analysis (6 janelas)
    3. Critérios de aprovação
    4. Gera relatório .md
    5. Retorna dict para a API Next.js
    
    Args:
        ea_id:       ID do EA no banco de dados
        ea_name:     Nome do EA
        symbol:      Par de moedas (ex: "USDJPY")
        timeframe:   Timeframe (ex: "H1")
        exit_mode:   "reversal" | "fixed_sltp"
        n_windows:   Número de janelas WFA
        is_ratio:    Proporção IS/total por janela
        trades_file: Caminho para arquivo de trades (CSV/JSON)
                     Se None, usa trades sintéticos (stub)
    
    Returns:
        Dict com: wfe, oosWins, oosTotalWin, approved, reportMd, windowsJson
    """
    print(f"[Pipeline] Iniciando validação: {ea_name} ({symbol} {timeframe})", file=sys.stderr)

    # Stage 1: Carrega trades
    if trades_file:
        import csv
        trades = []
        with open(trades_file, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    profit = float(row.get("profit", row.get("Profit", 0)))
                    trades.append(Trade(profit=profit))
                except ValueError:
                    continue
        print(f"[Pipeline] {len(trades)} trades carregados de '{trades_file}'", file=sys.stderr)
    else:
        # Stub: usa seed baseada no ea_id para resultados reproduzíveis
        seed = sum(ord(c) for c in ea_id) % 10000
        trades = generate_stub_trades(ea_name, symbol, n_trades=500, seed=seed)
        print(f"[Pipeline] Usando {len(trades)} trades sintéticos (stub)", file=sys.stderr)

    # Stage 2: Walk Forward Analysis
    result = walk_forward_analysis(trades, n_windows=n_windows, is_ratio=is_ratio)
    print(
        f"[Pipeline] WFA: WFE={result.wfe_avg:.1f}% | OOS Negativas={result.oos_negative_pct:.1f}%",
        file=sys.stderr,
    )

    # Stage 3: Gera relatório
    report_md = generate_report_md(
        result,
        ea_name=ea_name,
        symbol=symbol,
        timeframe=timeframe,
        exit_mode=exit_mode,
    )
    result.report_md = report_md

    # Stage 4: Prepara output JSON para a API Next.js
    output = {
        "ea_id": ea_id,
        "ea_name": ea_name,
        "symbol": symbol,
        "timeframe": timeframe,
        "wfe": result.wfe_avg,
        "oosWins": result.oos_wins,
        "oosTotalWin": result.oos_total,
        "oos_negative_pct": result.oos_negative_pct,
        "approved": result.approved,
        "reportMd": report_md,
        "windowsJson": [
            {
                "window": w.window,
                "isProfit": w.is_profit,
                "oosProfit": w.oos_profit,
                "wfe": w.wfe,
                "approved": w.approved,
                "is_trades": w.is_trades,
                "oos_trades": w.oos_trades,
            }
            for w in result.windows
        ],
        "validated_at": datetime.now().isoformat(),
    }

    status = "APROVADO ✅" if result.approved else "REPROVADO ❌"
    print(f"[Pipeline] Veredito: {status}", file=sys.stderr)

    return output


# ─── Entry Points ──────────────────────────────────────────────────────────────

def main_stdin():
    """Lê parâmetros do stdin (JSON) e escreve resultado no stdout (JSON)."""
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "Empty stdin"}), file=sys.stdout)
        sys.exit(1)

    try:
        params = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON parse error: {e}"}), file=sys.stdout)
        sys.exit(1)

    result = run_pipeline(
        ea_id=params.get("ea_id", "unknown"),
        ea_name=params.get("ea_name", "EA"),
        symbol=params.get("symbol", "EURUSD"),
        timeframe=params.get("timeframe", "H1"),
        exit_mode=params.get("exit_mode", "reversal"),
        n_windows=params.get("n_windows", 6),
        is_ratio=params.get("is_ratio", 0.7),
        trades_file=params.get("trades_file"),
    )

    print(json.dumps(result, ensure_ascii=False))


def main_cli():
    """CLI para rodar diretamente via terminal."""
    parser = argparse.ArgumentParser(description="Pipeline de Robustez ZaionVest (DQ Labs)")
    parser.add_argument("--ea-id", required=True, help="ID do EA")
    parser.add_argument("--ea-name", required=True, help="Nome do EA")
    parser.add_argument("--symbol", default="EURUSD", help="Par de moedas")
    parser.add_argument("--timeframe", default="H1", help="Timeframe")
    parser.add_argument("--exit-mode", default="reversal", help="Modo de saída")
    parser.add_argument("--windows", type=int, default=6, help="Janelas WFA")
    parser.add_argument("--is-ratio", type=float, default=0.7, help="Proporção IS")
    parser.add_argument("--trades-file", help="Arquivo de trades (CSV/JSON)")
    parser.add_argument("--output-json", help="Salvar resultado em .json")
    parser.add_argument("--output-md", help="Salvar relatório em .md")
    args = parser.parse_args()

    result = run_pipeline(
        ea_id=args.ea_id,
        ea_name=args.ea_name,
        symbol=args.symbol,
        timeframe=args.timeframe,
        exit_mode=args.exit_mode,
        n_windows=args.windows,
        is_ratio=args.is_ratio,
        trades_file=args.trades_file,
    )

    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"[Pipeline] JSON salvo: {args.output_json}", file=sys.stderr)

    if args.output_md:
        with open(args.output_md, "w", encoding="utf-8") as f:
            f.write(result["reportMd"])
        print(f"[Pipeline] Relatório salvo: {args.output_md}", file=sys.stderr)

    # Imprime resultado resumido
    status = "APROVADO ✅" if result["approved"] else "REPROVADO ❌"
    print(f"\nResultado: {status}")
    print(f"WFE Médio: {result['wfe']:.2f}%")
    print(f"OOS Wins: {result['oosWins']}/{result['oosTotalWin']}")


if __name__ == "__main__":
    # Se há argumentos CLI, usa CLI; senão, lê stdin (modo subprocess)
    if len(sys.argv) > 1 and sys.argv[1].startswith("--"):
        main_cli()
    else:
        main_stdin()

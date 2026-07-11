"""
Motor de Walk Forward Analysis — Esteira de Robustez DQ Labs
============================================================
Implementa o pipeline exato documentado no material DQ Labs:
  - Walk Forward Analysis (N janelas deslizantes)
  - Critérios de aprovação: WFE médio > 50% + janelas OOS negativas < 50%
  - Geração de relatório .md no formato padrão

Uso:
    python wfa.py --help
    python wfa.py trades.csv --ea-name "T3 Velocity" --symbol USDJPY --timeframe H1
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field, asdict
from typing import Optional
import math


# ─── Tipos ────────────────────────────────────────────────────────────────────

@dataclass
class Trade:
    """Representa uma operação de backtest."""
    profit: float
    date: Optional[str] = None
    params: Optional[dict] = None
    side: int = 0   # +1 long / -1 short (para métricas de simetria long/short)


@dataclass
class WFAWindow:
    """Resultado de uma janela do Walk Forward."""
    window: int
    is_profit: float      # Lucro no período In-Sample
    oos_profit: float     # Lucro no período Out-of-Sample
    wfe: float            # Walk Forward Efficiency (%)
    approved: bool        # True se janela OOS foi positiva
    is_trades: int = 0
    oos_trades: int = 0
    params: Optional[dict] = None


@dataclass
class WFAResult:
    """Resultado consolidado do Walk Forward Analysis."""
    windows: list[WFAWindow]
    wfe_avg: float
    oos_wins: int
    oos_total: int
    oos_negative_pct: float
    approved: bool
    report_md: str = ""


# ─── Core WFA ─────────────────────────────────────────────────────────────────

def calculate_wfe(is_profit: float, oos_profit: float) -> float:
    """
    Calcula o Walk Forward Efficiency (WFE).
    
    WFE = (OOS / IS) × 100
    
    Se IS <= 0: retorna 0 (janela inútil como referência).
    """
    if is_profit <= 0:
        return 0.0
    return (oos_profit / is_profit) * 100.0


def walk_forward_analysis(
    trades: list[Trade],
    n_windows: int = 6,
    is_ratio: float = 0.7,
) -> WFAResult:
    """
    Executa o Walk Forward Analysis com janelas deslizantes.
    
    Args:
        trades:    Lista de trades em ordem cronológica.
        n_windows: Número de janelas WFA (padrão DQ Labs: 6).
        is_ratio:  Proporção IS/total por janela (padrão: 70% IS, 30% OOS).
    
    Returns:
        WFAResult com métricas consolidadas e lista de janelas.
    
    Metodologia (DQ Labs Cap. 07):
        - Cada janela tem n_total // n_windows trades
        - Dentro de cada janela: is_ratio → IS, restante → OOS
        - WFE = OOS_profit / IS_profit × 100
        - Aprovação: WFE_avg > 50% E oos_negative_pct < 50%
    """
    if not trades:
        raise ValueError("Lista de trades vazia")

    n = len(trades)
    window_size = n // n_windows
    if window_size < 10:
        raise ValueError(
            f"Poucos trades para {n_windows} janelas. "
            f"Mínimo recomendado: {n_windows * 10} trades."
        )

    windows: list[WFAWindow] = []

    for i in range(n_windows):
        start = i * window_size
        end = start + window_size if i < n_windows - 1 else n
        window_trades = trades[start:end]

        is_end = start + int(len(window_trades) * is_ratio)
        is_trades = window_trades[:is_end]
        oos_trades = window_trades[is_end:]

        is_profit = sum(t.profit for t in is_trades)
        oos_profit = sum(t.profit for t in oos_trades)
        wfe = calculate_wfe(is_profit, oos_profit)

        windows.append(WFAWindow(
            window=i + 1,
            is_profit=round(is_profit, 2),
            oos_profit=round(oos_profit, 2),
            wfe=round(wfe, 2),
            approved=oos_profit >= 0,
            is_trades=len(is_trades),
            oos_trades=len(oos_trades),
        ))

    return _consolidate(windows)


def _consolidate(windows: list[WFAWindow]) -> WFAResult:
    """Consolida os resultados das janelas em métricas finais.

    WFE CONSOLIDADO (DQ Labs cap. 07, literal): "Divide o resultado consolidado
    de todos os períodos OOS pelo resultado consolidado de todos os períodos
    IS". A média dos ratios por janela (versão anterior) era patológica: uma
    janela com IS negativo e OOS POSITIVO zerava/negativava a média — reprovava
    estratégia que ganha dinheiro fora da amostra em todas as janelas.
    """
    total_is = sum(w.is_profit for w in windows)
    total_oos = sum(w.oos_profit for w in windows)
    # IS consolidado ≤ 0: estratégia nem no aprendizado funcionou → WFE 0.
    wfe_avg = (total_oos / total_is * 100.0) if total_is > 0 else 0.0

    oos_wins = sum(1 for w in windows if w.oos_profit >= 0)
    oos_total = len(windows)
    oos_negative_pct = ((oos_total - oos_wins) / oos_total * 100) if oos_total else 0.0

    # Critério DQ Labs: WFE consolidado > 50% E janelas OOS negativas < 50%
    approved = wfe_avg > 50.0 and oos_negative_pct < 50.0

    return WFAResult(
        windows=windows,
        wfe_avg=round(wfe_avg, 2),
        oos_wins=oos_wins,
        oos_total=oos_total,
        oos_negative_pct=round(oos_negative_pct, 2),
        approved=approved,
    )


# ─── Geração de Relatório ─────────────────────────────────────────────────────

def generate_report_md(
    result: WFAResult,
    ea_name: str = "EA",
    symbol: str = "—",
    timeframe: str = "—",
    exit_mode: str = "—",
    extra_params: Optional[dict] = None,
) -> str:
    """
    Gera relatório .md no formato padrão DQ Labs.
    
    Compatível com os relatórios da pasta PARA ENVIAR A IA:
    - Relatorio_Robustez_T3Velocity_USDJPY.md
    - Relatorio_Robustez_SAR.md
    - etc.
    """
    mode_label = "Modo A (Stop & Reversão)" if "reversal" in exit_mode.lower() else "Modo B (SL/TP Fixos)"
    
    wfe_pass = "✅ PASS" if result.wfe_avg > 50 else "❌ FAIL"
    oos_pass = "✅ PASS" if result.oos_negative_pct < 50 else "❌ FAIL"
    verdict_status = "ROBUST" if result.approved else "NOT ROBUST"
    verdict_emoji = "✅" if result.approved else "⚠️"
    verdict_text = "passou" if result.approved else "não passou"

    # Tabela de janelas
    header = "| Janela | Lucro IS ($) | Lucro OOS ($) | WFE % |"
    separator = "| :---: | :---: | :---: | :---: |"
    rows = "\n".join(
        f"| {w.window} | {w.is_profit:.2f} | {w.oos_profit:.2f} | {w.wfe:.2f}% |"
        for w in result.windows
    )

    extra_section = ""
    if extra_params:
        extra_section = "\n## Parâmetros Utilizados\n\n"
        for k, v in extra_params.items():
            extra_section += f"- **{k}:** {v}\n"

    md = f"""# Relatório de Robustez — {ea_name}

Este relatório apresenta o estudo de robustez para o robô **{ea_name}** 
no timeframe **{timeframe}** da paridade **{symbol}** ({mode_label}).

---

## 1. Walk Forward Analysis (WFA)

{header}
{separator}
{rows}

### Consolidação WFA:
- **WFE Médio:** {result.wfe_avg:.2f}%
- **Janelas OOS Negativas:** {result.oos_total - result.oos_wins} de {result.oos_total} ({result.oos_negative_pct:.2f}%)

---

## 2. Checklist de Robustez (DQ Labs)

- **WFE Médio > 50%:** {wfe_pass} (Obtido: {result.wfe_avg:.2f}%)
- **Janelas OOS Negativas < 50%:** {oos_pass} (Obtido: {result.oos_negative_pct:.2f}%)

### Status de Robustez DQ Labs: **{verdict_status}**

### Parecer de Viabilidade da Estratégia:
> **Veredito:** A estratégia baseada no {ea_name} **{verdict_text}** nos critérios mínimos de robustez.{extra_section}
"""
    return md.strip()


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _load_trades_csv(path: str) -> list[Trade]:
    """Carrega trades de um CSV simples com coluna 'profit'."""
    import csv
    trades = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                profit = float(row.get("profit", row.get("Profit", 0)))
                date = row.get("date", row.get("Date"))
                trades.append(Trade(profit=profit, date=date))
            except ValueError:
                continue
    return trades


def _load_trades_json(path: str) -> list[Trade]:
    """Carrega trades de um JSON: [{"profit": 123.45, "date": "..."}, ...]"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [Trade(profit=float(t["profit"]), date=t.get("date")) for t in data]


def main():
    parser = argparse.ArgumentParser(
        description="Motor WFA — Esteira de Robustez DQ Labs"
    )
    parser.add_argument("trades_file", help="Arquivo de trades (.csv ou .json)")
    parser.add_argument("--ea-name", default="EA", help="Nome do EA")
    parser.add_argument("--symbol", default="—", help="Par de moedas (ex: USDJPY)")
    parser.add_argument("--timeframe", default="H1", help="Timeframe (ex: H1)")
    parser.add_argument("--exit-mode", default="reversal", help="Modo de saída (reversal | fixed_sltp)")
    parser.add_argument("--windows", type=int, default=6, help="Número de janelas WFA")
    parser.add_argument("--is-ratio", type=float, default=0.7, help="Proporção IS/total (0.7 = 70%%)")
    parser.add_argument("--output-md", help="Salvar relatório em arquivo .md")
    parser.add_argument("--output-json", help="Salvar resultado em arquivo .json")
    args = parser.parse_args()

    # Carrega trades
    if args.trades_file.endswith(".json"):
        trades = _load_trades_json(args.trades_file)
    else:
        trades = _load_trades_csv(args.trades_file)

    print(f"\n[WFA] Carregados {len(trades)} trades de '{args.trades_file}'")

    # Roda WFA
    result = walk_forward_analysis(trades, n_windows=args.windows, is_ratio=args.is_ratio)

    # Gera relatório
    report = generate_report_md(
        result,
        ea_name=args.ea_name,
        symbol=args.symbol,
        timeframe=args.timeframe,
        exit_mode=args.exit_mode,
    )
    result.report_md = report

    # Saída no terminal
    print(f"\n{'='*60}")
    print(f"  {args.ea_name} — {args.symbol} {args.timeframe}")
    print(f"{'='*60}")
    for w in result.windows:
        status = "✅" if w.approved else "❌"
        print(f"  Janela {w.window}: IS={w.is_profit:+.2f} | OOS={w.oos_profit:+.2f} | WFE={w.wfe:.1f}% {status}")
    print(f"{'─'*60}")
    print(f"  WFE Médio:        {result.wfe_avg:.2f}% {'✅' if result.wfe_avg > 50 else '❌'}")
    print(f"  OOS Negativas:    {result.oos_total - result.oos_wins}/{result.oos_total} ({result.oos_negative_pct:.1f}%) {'✅' if result.oos_negative_pct < 50 else '❌'}")
    print(f"  Status Final:     {'✅ APROVADO' if result.approved else '❌ REPROVADO'}")
    print(f"{'='*60}\n")

    # Salva arquivos se solicitado
    if args.output_md:
        with open(args.output_md, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"[WFA] Relatório salvo: {args.output_md}")

    if args.output_json:
        output = {
            "ea_name": args.ea_name,
            "symbol": args.symbol,
            "timeframe": args.timeframe,
            "wfe_avg": result.wfe_avg,
            "oos_wins": result.oos_wins,
            "oos_total": result.oos_total,
            "oos_negative_pct": result.oos_negative_pct,
            "approved": result.approved,
            "windows": [asdict(w) for w in result.windows],
            "report_md": report,
        }
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"[WFA] JSON salvo: {args.output_json}")


if __name__ == "__main__":
    main()

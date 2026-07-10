# Motor de Robustez — Esteira DQ Labs

Scripts Python que implementam o pipeline completo de robustez seguindo a metodologia **DQ Labs (Data 'n Quant)**.

## Arquivos

| Arquivo | Descrição |
|---|---|
| `wfa.py` | Motor de Walk Forward Analysis (core) |
| `pipeline.py` | Orquestrador — integra com o Next.js via subprocess |

---

## Metodologia DQ Labs

### Critérios de Aprovação
- **WFE médio > 50%**: A média das eficiências de cada janela WFA deve ser positiva e acima de 50%
- **Janelas OOS negativas < 50%**: Menos da metade das janelas deve ter resultado OOS negativo

### Walk Forward Efficiency (WFE)
```
WFE = (Lucro OOS / Lucro IS) × 100
```
- Mede o quanto da performance In-Sample se transfere para os dados desconhecidos Out-of-Sample
- IS negativo → WFE = 0 (janela descartada como referência)

---

## Uso via CLI

### Motor WFA (`wfa.py`)
```bash
# Rodar WFA em arquivo de trades CSV
python wfa.py trades.csv --ea-name "T3 Velocity" --symbol USDJPY --timeframe H1

# Salvar relatório e JSON
python wfa.py trades.csv --ea-name "T3 Velocity" --symbol USDJPY --timeframe H1 \
    --output-md relatorio.md \
    --output-json resultado.json
```

Formato do CSV de trades:
```csv
profit,date
123.45,2024-01-15
-67.80,2024-01-16
...
```

### Pipeline completo (`pipeline.py`)
```bash
# Via CLI
python pipeline.py \
    --ea-id "cuid123" \
    --ea-name "T3 Velocity" \
    --symbol USDJPY \
    --timeframe H1 \
    --exit-mode reversal \
    --trades-file trades.csv \
    --output-md relatorio.md

# Via stdin (modo subprocess pelo Next.js)
echo '{"ea_id": "cuid123", "ea_name": "T3 Velocity", "symbol": "USDJPY", "timeframe": "H1"}' \
    | python pipeline.py
```

---

## Integração com MetaTrader 5 (produção)

Para usar com dados reais do MT5, substitua a função `generate_stub_trades()` em `pipeline.py` por:

```python
import MetaTrader5 as mt5

def load_mt5_trades(ea_name: str, symbol: str, timeframe: int) -> list[Trade]:
    """Carrega histórico real de trades do MetaTrader 5."""
    mt5.initialize()
    deals = mt5.history_deals_get(
        datetime(2021, 1, 1),
        datetime.now()
    )
    return [
        Trade(profit=d.profit, date=str(d.time))
        for d in deals
        if d.profit != 0  # Exclui operações de balanceamento
    ]
```

---

## Exemplo de Saída

```
============================================================
  T3 Velocity — USDJPY H1
============================================================
  Janela 1: IS=+810.23 | OOS=+650.45 | WFE=80.3% ✅
  Janela 2: IS=+1023.10 | OOS=+780.90 | WFE=76.3% ✅
  Janela 3: IS=+590.80 | OOS=-95.20  | WFE=-16.1% ❌
  Janela 4: IS=+890.50 | OOS=+720.30 | WFE=80.9% ✅
  Janela 5: IS=+1100.20 | OOS=+850.10 | WFE=77.3% ✅
  Janela 6: IS=-180.30 | OOS=+310.50 | WFE=0.0% ✅
────────────────────────────────────────────────────────────
  WFE Médio:        66.45% ✅
  OOS Negativas:    1/6 (16.7%) ✅
  Status Final:     ✅ APROVADO
============================================================
```

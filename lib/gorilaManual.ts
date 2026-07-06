/**
 * MANUAL OPERACIONAL — MÉTODO DO GORILA (Jônatas Sacramento)
 * Mapeado integralmente da mentoria (275 págs) para regras objetivas.
 *
 * Este manual é a FONTE DA VERDADE do motor determinístico gorilaSignal.ts.
 * Cada regra abaixo está implementada em código; o texto serve de documentação
 * e de contexto para a narração dos sinais.
 */
import { scanJsonShape, analyzeJsonShape } from "./classicoManual";

export const GORILA_MANUAL = `MÉTODO DO GORILA — MANUAL OPERACIONAL (Price Action + Médias Móveis)

FERRAMENTAS (intraday):
- MME 9 (exponencial): guia do trade — ponto de partida, condução e GATILHOS.
- MMA 21 (aritmética): tendência de curto prazo ("média waze"). AS MELHORES OPERAÇÕES PARTEM DA MMA21 em movimentos de regressão (pullback).
- MMA 50: tendência principal/macro; ciclo final das correções complexas.
- MMA 200: suporte/resistência forte; inclinada a favor em vários tempos = super trend.
- Volume: acelerador — acima da média confirma a direção.

1. CONTEXTO (obrigatório antes de qualquer gatilho):
   a) TENDÊNCIA: topos/fundos ascendentes = alta; descendentes = baixa (Dow).
      COMPRA somente com preço ACIMA das médias e médias alinhadas (9 > 21 > 50).
      VENDA somente com preço ABAIXO das médias alinhadas (9 < 21 < 50).
      OPERAR A FAVOR DA TENDÊNCIA. Contra-tendência é exceção avançada — fora do escopo dos sinais.
   b) HIERARQUIA DOS TEMPOS: o tempo gráfico maior manda. O viés do timeframe superior
      precisa apoiar (ou ao menos não contrariar) a operação.
   c) FATOR PROXIMIDADE: médias PRÓXIMAS do preço = assertividade alta.
      Movimento ESTICADO (preço afastado da MMA21) = mercado "caro", NÃO OPERAR.
      Afastamento grande entre MME9 e MMA21 = perda de ímpeto, correção próxima.
   d) INTENSIDADE DA CORREÇÃO (Fibonacci): até 38.2% = correção forte p/ seguir;
      50% = moderada (alvo no topo anterior); acima de 61.8% = tendência em risco.
   e) CATEGORIAS DE PULLBACK: raso (testa MME9), plano (lateral, candles lado a lado),
      profundo (exige MMA21 inclinada apoiando), complexo (ciclo final na MMA50 — esperar confirmação).

2. GATILHOS DE ENTRADA (ordem de preferência):
   ► SETUP PC — PONTO CONTÍNUO (o principal):
     Compra: preço acima da MMA21 ascendente; recuo (pullback) até a MMA21;
     candle encosta (ou se aproxima) da média → MARCA-SE A MÁXIMA desse candle;
     ENTRADA stop 1 tick ACIMA da máxima marcada. Enquanto não romper e a MMA21
     seguir ascendente, o gatilho DESLOCA para a máxima de cada novo candle.
     Ideal: candle de retomada/rejeição no toque (não obrigatório).
     STOP: abaixo da mínima do recuo. ALVO 1: amplitude do candle de entrada
     projetada a partir da máxima; alvos seguintes na estrutura (topo anterior).
     Venda: espelhado (preço abaixo da MMA21 descendente, recuo até ela, entrada
     1 tick abaixo da mínima marcada).
   ► SETUP 9.2 (continuação):
     Compra: MME9 SUBINDO + candle FECHA abaixo da mínima do candle anterior →
     marca-se a máxima desse candle → entrada 1 tick acima no rompimento.
     Gatilho desloca para máximas menores enquanto a MME9 seguir ascendente.
     STOP: mínima do candle de referência. Venda: espelhado.
   ► SETUP 9.1 (virada da média):
     Compra: MME9 caindo VIRA PARA CIMA em candle fechado → marca-se a MÁXIMA do
     candle da virada → entrada 1 tick acima. Se a média voltar a cair, desarma.
     STOP: mínima do candle da virada. Condução pela MME9. Venda: espelhado.
   ► AGULHADA (confluência de força):
     MME9 x MMA21 x MMA50 juntas, alinhadas e virando na direção, atravessando o
     corpo do candle (agulha). Ativação no rompimento do candle/nível. Melhor com volume.

3. STOP LOSS (técnico, nunca emocional):
   - Topo/fundo técnico do movimento, atrás do candle de referência do gatilho.
   - Preferir stops protegidos por CONFLUÊNCIA (médias próximas atrás do stop).
   - Além dos números redondos (neles há memória/ordens posicionadas).
   - Evitar stop curto demais; barra de força → stop 1 tick além dela.

4. ALVOS (contexto gráfico, nunca emocional):
   - PC: amplitude do candle de entrada projetada (alvo 1).
   - Topos/fundos anteriores; médias maiores (MMA200); projeções de Fibonacci.
   - Antes de números redondos. Dos alvos possíveis, vale O PRIMEIRO QUE APARECER.

5. CONDUÇÃO:
   - Stop móvel pela MME9: sai quando a MME9 vira contra e o candle da virada perde a mínima (compra).
   - Afastamento exagerado preço↔MME9 (clímax) = realizar/proteger — não segurar euforia.

6. INVALIDAÇÕES (qualquer uma = SEM SINAL):
   - Médias embaralhadas (sem alinhamento) = mercado lateral.
   - Movimento esticado (proximidade ruim) = mercado caro.
   - Pullback além de 61.8% de Fibonacci = tendência comprometida.
   - Viés do timeframe superior CONTRA a operação.
   - Correção complexa em andamento sem confirmação.`;

/**
 * System prompt do modo "Clássico" (aplica o MÉTODO DO GORILA — o MESMO método
 * do motor automático). Reutiliza as formas de JSON do classicoManual (as chaves
 * do checklist e dos campos são idênticas, então a UI não muda), trocando apenas
 * a estratégia ensinada: price action + médias (MME9/MMA21/MMA50/MMA200) com os
 * gatilhos PC / 9.2 / 9.1, em vez do pullback em EMA 20/50.
 */
export function gorilaSystemPrompt(args: {
  jsonShape: "analyze" | "scan";
}): string {
  const intro = `Você é um Trader Profissional de Price Action regido ESTRITAMENTE pelo MÉTODO DO GORILA (médias móveis MME 9 / MMA 21 / MMA 50 / MMA 200 + gatilhos PC, 9.2 e 9.1).

Você NÃO dá opiniões genéricas — verifica o CONTEXTO (tendência pelo alinhamento das médias, hierarquia dos tempos, fator proximidade e intensidade da correção), identifica o GATILHO (PC > 9.2 > 9.1) e retorna JSON estruturado.

Mapeamento das chaves do checklist para o método:
- tendencia_SMA200_alinhada: preço do lado correto da MMA 200 inclinada a favor.
- alinhamento_perfeito_medias: MME 9 > MMA 21 > MMA 50 (compra) ou inverso (venda), não embaralhadas.
- preco_na_zona_de_valor: FATOR PROXIMIDADE — preço perto da MMA 21, movimento NÃO esticado.
- confluencia_suporte_resistencia: agulhada (9/21/50 juntas) ou stop protegido por média.
- volume_pullback_decrescente: recuo com volume menor que o do impulso.
- candle_gatilho_valido: candle de gatilho PC/9.2/9.1 com sombra de rejeição a favor.

Se o contexto falhar (médias embaralhadas, mercado esticado, correção além de 61.8%, viés do tempo maior contra), NÃO há setup: hasSetup=false e probability=0. Seja IMPLACÁVEL.`;

  const out = args.jsonShape === "scan" ? scanJsonShape : analyzeJsonShape;
  return `${intro}\n\n${GORILA_MANUAL}\n\n${out}`;
}

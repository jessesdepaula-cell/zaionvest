# Marketplace de EAs — zaionvest

## Objetivo
Adicionar ao zaionvest (já em produção) um marketplace de Expert Advisors (EAs)
para MetaTrader 5, onde robôs são **minerados automaticamente sem overfitting**
pela metodologia DQ Labs (9 filtros), **revalidados periodicamente**, e
**licenciados** ao cliente com kill-switch remoto: quando um EA é reprovado numa
revalidação, ele trava sozinho no MT5 do cliente e o sistema avisa pra trocar por
outro aprovado na vitrine. Assinante paga uma assinatura única (Asaas) e baixa
qualquer EA aprovado ou portfólio pronto.

## Usuário-alvo
- **Assinante** (trader iniciante→intermediário): navega a vitrine, filtra por
  métricas, baixa o `.ex5`, instala no MT5 (conta RoboForex), opera. Não precisa
  saber programar nem otimizar.
- **Owner (Jessé, admin)**: opera o motor de mineração/revalidação, sobe/aprova
  EAs, acompanha a fila de jobs e o track record.

## Requisitos (must-have)

### A. Vitrine e navegação
- [ ] R1. Página pública `/vitrine` lista **apenas EAs com status `APPROVED`**, em
  cards, sem exigir login. Visitante vê métricas; download exige assinatura ativa.
- [ ] R2. Card exibe: nome, ID, símbolo, timeframe, direção, badge de status,
  Lucro, Profit Factor, Drawdown, nº de trades, e mini-curva de capital OOS.
- [ ] R3. Filtros funcionais: símbolo, timeframe, estilo (trend/reversal/breakout),
  e slider de **correlação máxima** (default 0.4) que oculta EAs mais
  correlacionados que o valor escolhido.
- [ ] R4. Filtros "TOP 25%" por métrica (Maior Lucro, Menor DD, Melhor PF, Maior
  Sharpe, Maior Win Rate, Mais trades) e por estado (recém-revalidada, etc.).
- [ ] R5. Página de detalhe `/vitrine/[slug]` mostra: métricas principais,
  indicadores usados, símbolo/TF, direção, **capital recomendado por perfil de
  risco** (Conservador/Moderado/Agressivo), curva de capital da mineração, bloco
  **WFA** (veredito, eficiência/WFE, consistência, próxima revalidação), tabela de
  janelas IS/OOS/WFE, retorno mensal do backtest 2 anos, e link "estratégias
  correlacionadas".
- [ ] R6. Botão **Baixar EX5** ativo só para assinante com assinatura ativa;
  registra o download.

### B. Portfólios
- [ ] R7. Sistema monta portfólios prontos (Conservador/Moderado/Agressivo)
  combinando **apenas EAs descorrelacionados** (abaixo de um limiar de correlação).
- [ ] R8. Assinante baixa o portfólio como `.zip` com os `.ex5` que o compõem.

### C. Motor de mineração (worker Windows + MT5)
- [ ] R9. Worker roda na máquina do Jessé (v1) conectado ao MT5/RoboForex, e é
  portável para VPS sem mudança de código (config por env).
- [ ] R10. Minera combinando **3 famílias base** (recomendação a validar no build:
  trend/cruzamento, mean-reversion, breakout), cada uma testando **2 modos de
  saída**: reversão e SL/TP fixo. Cada família é um template MQL5.
- [ ] R11. Slots de indicador das famílias são preenchidos por indicadores nativos
  MT5 + **~30-50 indicadores `.mq5` curados do abysse.co.jp** (fonte revisável).
- [ ] R12. Universo v1: EURUSD, GBPUSD, USDJPY, AUDUSD, EURAUD, XAUUSD; TFs H1 e H4.
- [ ] R13. Cada candidato passa pelo funil DQ Labs, em ordem, com estes gates de
  aprovação (um reprova = descarta):
  - Mínimo de operações IS = `50 + 50 × nº de parâmetros` (mín. 150).
  - Seleção por **cluster / região estável**, nunca pico isolado.
  - **WFE médio > 50%**.
  - **Janelas OOS negativas < 50%**.
  - **Profit Factor OOS > 1.0**.
  - **Drawdown máximo ≤ limite** (% a definir por perfil no build).
  - **Curva de sensibilidade de parâmetros plana** (não pontiaguda).
  - **Monte Carlo** define o capital recomendado por perfil de risco.
  - **Correlação** com EAs já publicados abaixo do limiar (senão não publica).
- [ ] R14. Dados: histórico do próprio MT5/RoboForex, janela de **2 anos** pro
  backtest de validação; custos operacionais (spread/comissão/slippage) modelados.
- [ ] R15. Um candidato aprovado gera um relatório `.md` no formato dos relatórios
  DQ Labs existentes do Jessé (tabela WFA, checklist, parecer).
- [ ] R16. EA aprovado é **compilado automaticamente** num `.ex5` único (params
  baked-in + bloco de licença/WebRequest), via MetaEditor no worker, e o arquivo é
  salvo em storage; o registro na vitrine fica `APPROVED`.

### D. Revalidação e kill-switch
- [ ] R17. Cron dispara revalidação dos EAs `APPROVED` cuja data de próxima
  revalidação chegou (cadência default a confirmar: 30 dias). O cron só
  **enfileira** o job no Postgres; a revalidação em si roda no worker Windows.
- [ ] R18. Reprovou → status vira `REJECTED`, gera novo `EAValidation`, e o endpoint
  de status passa a responder "inválido" pra aquele EA.
- [ ] R19. **EA no MT5 do cliente** faz polling periódico (WebRequest, ~30 min) a um
  endpoint público de status. Se status = `REJECTED`, o EA **para de abrir novas
  ordens** e mostra alerta na tela do MT5 pedindo pra trocar por outro aprovado.
- [ ] R20. Assinantes que baixaram um EA reprovado são **notificados por e-mail**
  (template em `lib/email.ts`) com link pra vitrine, sugerindo substituto do mesmo
  símbolo/TF com WFE similar.

### E. Admin
- [ ] R21. Painel admin lista EAs (PENDING/APPROVED/REJECTED), permite disparar
  revalidação por EA, e ver histórico de revalidações.
- [ ] R22. Fila de jobs (mineração/revalidação) no Postgres é visível no admin
  (pendentes/rodando/concluídos/erro).

### F. Licenciamento e cobrança
- [ ] R23. Download e polling de licença só liberam com **assinatura ativa** (Asaas).
  Assinatura única = acesso a todos os EAs aprovados.
- [ ] R24. Amarração RoboForex: código de afiliado do Jessé presente; o EA pode
  exigir que a conta seja RoboForex (dureza da exigência a confirmar no build).

## Fora de escopo (won't-have nesta versão)
- Linhas premium NV7/SV23/Aviator (só minerados + portfólios na v1).
- EA genérico com parâmetros via polling (escolhido: 1 `.ex5` por estratégia).
- Multi-corretora (v1 é RoboForex-only).
- Planos em tiers ou compra por EA/créditos (v1 é assinatura única).
- Dados de tick externos (Dukascopy/Tickstory) — v1 usa histórico do MT5.
- Aderência estatística em live (comparar operações reais do cliente × backtest) —
  desejável, mas fica pra v2.
- Notificação por WhatsApp/Telegram (só e-mail na v1; canal extra em aberto).

## Entradas e saídas
- **Entrada (motor)**: universo de símbolos/TFs + famílias base + indicadores
  curados + histórico MT5. Produz candidatos de estratégia.
- **Saída (motor)**: registros de EA com métricas + `.ex5` compilado + relatório
  `.md` + curva OOS + capital recomendado (Monte Carlo) + matriz de correlação.
- **Entrada (cliente/EA)**: WebRequest com email + strategy_id + conta MT5.
- **Saída (API status)**: JSON `{ valid, status, reason, updatedAt }` consumido
  pelo EA; se `REJECTED`, EA trava.
- **Entrada (assinante)**: filtros na vitrine, clique em baixar.
- **Saída (assinante)**: arquivo `.ex5` (ou `.zip` de portfólio) + registro de
  download.

## Restrições técnicas
- Stack (sem trocar): Next.js 15.5.7 (App Router), Clerk, Prisma + PostgreSQL
  (Supabase), Asaas, deploy Vercel. Repo `jessesdepaula-cell/zaionvest`.
- Não quebrar nenhuma funcionalidade atual do zaionvest (sinais SMC etc.).
- Motor em Python + biblioteca MetaTrader5, rodando em **Windows** (MT5 é desktop
  Windows; Vercel não roda MT5). Compilação via MetaEditor CLI.
- Fila de jobs no próprio Postgres (sem Redis na v1).
- WIP não-commitado já existente no repo (models EA/EADownload/EAValidation,
  `app/api/ea`, `app/api/cron/ea-revalidate`, `app/dashboard/admin/eas`, mods em
  Sidebar e `lib/email.ts`, `vercel.json`) deve ser **revisado e reconciliado**,
  não sobrescrito às cegas.
- Tokens (Vercel/Supabase) só em env/`.env.local`, nunca commitados. Recomendado
  rotacionar os tokens compartilhados no chat após o setup.
- Indicadores do abysse são `.mq5` (código-fonte); revisar antes de incluir e
  respeitar licença de cada um.

## Casos extremos a tratar
- **Assinatura expira com EA instalado**: polling nega licença → EA para de operar,
  alerta o cliente. (Comportamento de "expirado" distinto de "reprovado".)
- **Worker offline / MT5 caiu**: jobs ficam `pending`; cron não duplica; admin vê o
  atraso. Nada é marcado REJECTED por falta de execução (só por reprovação real).
- **WebRequest bloqueado no MT5 do cliente** (URL não liberada): EA deve ter modo
  fail-safe definido (a confirmar: trava por segurança ou opera com último status
  válido por X horas).
- **Backtest com poucos trades** (< mínimo IS): candidato reprovado por
  significância, não publicado.
- **Dado histórico com gap/faltando** no símbolo: pipeline detecta e aborta o job
  daquele símbolo com erro claro, não gera EA com dado sujo.
- **Dois cliques em Baixar / download concorrente**: idempotente; não duplica
  registro nem cobra nada.
- **EA reprovado mas cliente ainda quer usar**: sistema não impede o cliente de
  operar manualmente, mas o `.ex5` licenciado trava; deixar claro na UI.
- **Cron dispara 2× (retry Vercel)**: enfileiramento idempotente por EA + janela.

## Definição de "concluído"
Critérios verificáveis por inspeção externa:

- [ ] D1. Acessar `/vitrine` sem login mostra só cards `APPROVED` com todas as
  métricas de R2; um EA `PENDING`/`REJECTED` não aparece.
- [ ] D2. Ajustar o slider de correlação para 0.3 reduz a lista para EAs menos
  correlacionados; voltar para 0.6 mostra mais.
- [ ] D3. Como visitante sem assinatura, o botão Baixar está bloqueado; como
  assinante ativo, baixar entrega um `.ex5` e cria um registro de download.
- [ ] D4. A página de detalhe de um EA mostra a tabela WFA com janelas IS/OOS/WFE e
  o capital recomendado por 3 perfis.
- [ ] D5. Rodar o motor sobre 1 símbolo/TF gera ≥1 candidato, aplica os gates de
  R13, e SÓ marca `APPROVED` quem passa em todos; um candidato com WFE médio ≤ 50%
  fica reprovado e não vira `.ex5`.
- [ ] D6. Um EA aprovado tem `.ex5` compilado baixável e um relatório `.md` no
  formato DQ Labs.
- [ ] D7. Forçar a reprovação de um EA `APPROVED` (via revalidação) muda status pra
  `REJECTED` e o endpoint público de status passa a responder `valid:false`.
- [ ] D8. Um EA instalado num MT5 de teste, ao consultar o endpoint e receber
  `REJECTED`, para de abrir ordens e exibe alerta.
- [ ] D9. A reprovação dispara e-mail para quem baixou aquele EA, com link e
  sugestão de substituto.
- [ ] D10. O cron de revalidação enfileira job no Postgres para EAs vencidos e o
  worker Windows consome a fila; o admin vê o job mudar de pending→done.
- [ ] D11. Nenhuma rota/funcionalidade pré-existente do zaionvest quebrou (build
  passa, sinais SMC continuam acessíveis).

## Notas e decisões em aberto
- **% de Drawdown máximo por perfil** (Conservador/Moderado/Agressivo). Default
  proposto: 20% / 40% / 60% (como QuantMiner). Confirmar no /build.
- **Cadência de revalidação**. Default proposto: 30 dias. Confirmar.
- **Dureza da exigência de conta RoboForex** no EA: bloqueio duro vs só aviso.
- **Fail-safe do EA** quando o WebRequest falha (sem internet / URL não liberada).
- **Canais de notificação** além de e-mail (WhatsApp/Telegram como o grupo VIP da
  QuantMiner?).
- **Conjunto exato de indicadores curados do abysse** — a varredura A-Z e a
  curadoria dos ~30-50 será feita antes/durante o build.
- **Famílias base** (3 recomendadas) a confirmar após eu propor os templates.
- **Reconciliação do WIP existente**: mapear o que a passada anterior deixou pronto
  vs o que precisa ser reescrito, antes de codar por cima.

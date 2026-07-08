# MT5 Copy Robot — Módulo Premium

## Objetivo

Adicionar um módulo Premium ao **ZaionVest** (sistema hospedado em `zaionvest.com.br`, repositório `trade-vision-ai`) que replica automaticamente os sinais SMC e Clássico já gerados pelo sistema para o MetaTrader 5 do usuário via Expert Advisor (EA) + bridge local. O robô entra a mercado quando o sinal é confirmado como FILLED no backend, opera apenas com stop loss (sem take profit), e o backend comanda o trailing do stop conforme o preço atinge TP1/TP2/TP3.

## Usuário-alvo

Traders assinantes do ZaionVest que hoje operam manualmente com base nos sinais do sistema e querem automatizar a execução no MT5 real. Possuem conta MT5 em corretora que permita EAs (mercado real) e conseguem instalar um `.ex5` na pasta `MQL5/Experts` do terminal.

## Requisitos (must-have)

### R — Plano e billing

- [ ] R1. Existe um plano **Premium R$97,90/mês** cadastrado no Asaas, distinto do plano existente de R$47,90.
- [ ] R2. Cobrança 100% via Asaas. Todo código, campos de DB e fluxo do Stripe são removidos (`stripeCustomerId`, `stripeSubId`, webhooks Stripe, dependências, checkout).
- [ ] R3. Trial gratuito de 3 dias **NÃO** dá acesso ao módulo Premium. Trial cobre apenas o plano R$47,90.
- [ ] R4. Não pagou / cancelou / atrasou → **acesso ao app inteiro é travado** (não só o robô). Middleware bloqueia todas as rotas do dashboard e retorna à tela de reativação enquanto `subscriptionStatus != "active"`.
- [ ] R5. Cancelamento do Premium → EA para de receber sinais **imediatamente**: próxima chamada de polling do EA retorna HTTP 403 e o EA loga a razão no journal do MT5.

### R — Cadastro e autenticação

- [ ] R6. Clerk continua responsável pela autenticação (email/senha ou Google).
- [ ] R7. Campo **telefone** obrigatório em todo usuário. Formato validado por regex BR (`+55 (DD) 9DDDD-DDDD`), com `@unique` no Prisma.
- [ ] R8. Middleware força redirecionamento para `/complete-profile` se `user.phone == null`. Nenhuma outra rota do dashboard é acessível até o telefone ser preenchido.
- [ ] R9. Trial de 3 dias **só começa a contar depois** que o perfil está completo (telefone preenchido).
- [ ] R10. CPF **não** é coletado nesta versão (decisão do produto — ver "Notas e decisões em aberto").

### R — Módulo no menu lateral

- [ ] R11. Novo item de menu **"Robô MT5"** na sidebar esquerda do dashboard, visível para todos os usuários autenticados.
- [ ] R12. Se o usuário **não** for Premium (trial, R$47,90 ativo, ou inativo), o item aparece com **ícone de cadeado** e tooltip "Exclusivo Premium".
- [ ] R13. Clique no item bloqueado → carrega a mesma rota `/robo-mt5`, mas exibe uma **página de upsell** dentro da própria rota (vídeo explicativo + descrição + CTA "Assinar Premium R$97,90"). CTA leva ao checkout do plano Premium no Asaas.
- [ ] R14. Se o usuário for Premium ativo, `/robo-mt5` exibe o **painel do robô** (ver R15).

### R — Painel do robô (usuário Premium ativo)

- [ ] R15. O painel `/robo-mt5` contém, em uma única rota:
  - Seletor de **modo operacional**: SMC / Clássico / Todos. Persistido por usuário.
  - Seletor de **ativos**: multi-select derivado da watchlist do usuário + opção "Todos os ativos da minha watchlist".
  - Campo **volume por operação**, default `0.01`, editável.
  - Botão **Baixar EA** que faz download do arquivo `.ex5` versionado (com o email do usuário embutido nos inputs default do EA, ou um `.set` acompanhante).
  - Exibição da **chave de licença** (mascarada por default, com botão "revelar" e "regenerar").
  - **Status de conexão do EA**: online / offline com timestamp do último ping. "Online" = ping < 2 min atrás.
  - **Nº da conta MT5 vinculada** + botão **"Resetar conta MT5"** (com cooldown de 24h após uso).
  - **Histórico** das últimas N operações executadas pelo EA (com signalId, ativo, entrada, SL atual, status).
- [ ] R16. A licença é uma chave opaca (ex: `TVI-XXXX-XXXX-XXXX`) gerada no momento da primeira ativação Premium, `@unique` no Prisma, vinculada 1-1 ao email do usuário.

### R — Regras de execução do EA

- [ ] R17. O EA recebe **comandos** do backend via polling HTTP (intervalo de 3–5s). Não abre nenhuma ordem por conta própria.
- [ ] R18. Quando um sinal do usuário muda status para **FILLED** no backend (via `signalTracker.ts`), o backend gera um comando `OPEN_MARKET` para aquele email: `{signalId, symbol, direction, volume (do painel), stopPrice}`. O EA abre uma ordem **a mercado** com **apenas o stop loss**. **Nenhum TP é posicionado na ordem.**
- [ ] R19. Trailing de stop comandado pelo backend, seguindo a regra:
  - Preço atinge **TP1** → backend emite `MOVE_SL` com `newSL = entryPrice` (breakeven).
  - Preço atinge **TP2** → backend emite `MOVE_SL` com `newSL = target1`.
  - Preço atinge **TP3** → backend emite `MOVE_SL` com `newSL = target2`.
  - Preço continua além do **TP3** → backend emite `MOVE_SL` com `newSL = target3`.
  - Trade só fecha quando SL for atingido (reversão) ou usuário fechar manualmente no MT5.
- [ ] R20. O EA confirma cada comando executado via callback ao backend (`{commandId, mt5Ticket, executedPrice, status}`). Comandos não confirmados são reemitidos até timeout de N minutos.
- [ ] R21. O EA filtra os sinais recebidos pelas preferências salvas no painel: modo operacional (SMC / Clássico / Todos) e ativos (subset da watchlist ou todos). O filtro é aplicado no **backend** antes de emitir o comando, não no EA.

### R — Autenticação do EA e vínculo com conta MT5

- [ ] R22. EA autentica em cada request com `email + licenseKey` no header.
- [ ] R23. Na **primeira request bem-sucedida**, o backend grava o **número da conta MT5** (obtido via `AccountInfoInteger(ACCOUNT_LOGIN)` enviado pelo EA) associado àquela licença.
- [ ] R24. Requisições subsequentes vindas de um número de conta MT5 diferente daquele gravado retornam HTTP 403 com corpo `{error: "license_bound_to_other_account"}`. O EA loga isso no journal do MT5.
- [ ] R25. Botão "Resetar conta MT5" no painel limpa o número gravado. Após reset, o próximo MT5 que conectar vira o novo vinculado. Cooldown de 24h entre resets.

### R — Vídeo explicativo

- [ ] R26. Vídeo explicativo em PT-BR (formato 16:9 para YouTube) produzido com a skill `video-explicativo`, cobrindo: o que é o robô, como funciona (sinal → confirmação no sistema → EA abre a mercado → trailing automático), como instalar o `.ex5` no MT5, como configurar `email + license key`, o que aparece no painel. O vídeo NÃO menciona CTA INEMA.CLUB.
- [ ] R27. Vídeo hospedado em YouTube unlisted, embedado tanto na página de upsell (não-Premium) quanto no painel do robô (Premium) via `<iframe>` responsivo.

### R — Rebranding para ZaionVest

- [ ] R28. Todas as referências user-facing a "Trade Vision AI" / "trade-vision-ai" são substituídas por **"ZaionVest"**: título da aba (`<title>`), meta tags OG, textos do dashboard, footer, emails transacionais, README público, favicon (se existir logotipo novo). O nome do repositório GitHub e o path local do projeto podem permanecer `trade-vision-ai` — só a marca muda.
- [ ] R29. Domínio de produção passa a ser `zaionvest.com.br`. `NEXT_PUBLIC_APP_URL` no `.env.example` reflete `https://zaionvest.com.br`. URL do endpoint do EA hardcoded no `.ex5` aponta pra `https://zaionvest.com.br/api/robo/...`. Redirect 301 do domínio antigo `trade-vision-ai.vercel.app` → `zaionvest.com.br` configurado no `next.config.js` ou no dashboard da Vercel.

## Fora de escopo (won't-have nesta versão)

- **CPF na base**: por decisão do usuário. Anti-farm de trial fica baseado apenas em email + telefone (ver "Notas e decisões em aberto" — limitação conhecida).
- **OTP por SMS/WhatsApp** para validar telefone: só validação de formato + `@unique`.
- **Múltiplas contas MT5 por licença**: uma licença serve para exatamente uma conta MT5 por vez.
- **Múltiplos TPs posicionados na ordem MT5**: nunca. Apenas SL, com trailing.
- **Copy trading via broker nativo (MetaQuotes Signals / cTrader Copy)**: não usado.
- **VPS gerenciada pelo sistema**: usuário é responsável por manter o MT5 rodando (recomendação: usar VPS própria).
- **Suporte a MT4**: apenas MT5.
- **Fallback para o R$47,90 quando o Premium é cancelado**: usuário simplesmente cai em `inactive` (todo app trava). Downgrade para R$47,90 exige nova assinatura do plano R$47,90 manualmente.

## Entradas e saídas

### Entrada — para o backend gerar comandos

- Sinais existentes no modelo `Signal` (Prisma), quando `status` muda de `PENDING` para `FILLED` e depois quando `maxTargetHit` é atualizado para 1, 2 ou 3.
- Preferências salvas pelo usuário no painel: `preferredMode` (SMC/CLASSICO/ALL), `preferredSymbols` (array ou "ALL"), `defaultVolume`.

### Entrada — do EA para o backend

- `POST /api/robo/poll` com header `Authorization: Bearer <email>:<licenseKey>` e body `{mt5Account, terminalBuild, symbolsAvailable[]}`.
- `POST /api/robo/ack` com `{commandId, mt5Ticket, executedPrice, status: "ok"|"error", errorMsg?}`.

### Saída — do backend para o EA

Resposta do `POST /api/robo/poll`:
```json
{
  "commands": [
    {"commandId": "cmd_...", "type": "OPEN_MARKET", "signalId": "sig_...",
     "symbol": "EURUSD", "direction": "BUY", "volume": 0.01, "stopPrice": 1.0850},
    {"commandId": "cmd_...", "type": "MOVE_SL", "mt5Ticket": 123456, "newSL": 1.0900}
  ]
}
```

### Saída — para o usuário

- Painel `/robo-mt5` com estado atual (ver R15).
- Download do `.ex5` via `GET /api/robo/download-ea` (autenticado, com email do usuário embutido nos defaults).

## Restrições técnicas

- **Stack**: Next.js (existente no repo trade-vision-ai), Prisma + PostgreSQL, Clerk, Asaas. Sem Stripe.
- **EA**: MQL5, compilado para MT5 (`.ex5`). Fonte `.mq5` versionada no repo em `mt5-ea/`.
- **Plataforma cliente**: MT5 build ≥ 4000 (atual estável). Windows, macOS (via Wine), Linux (via Wine).
- **Integrações**:
  - Asaas: criação de plano Premium, checkout, webhook para atualizar `subscriptionStatus`.
  - Clerk: mantido para auth. Configurar hook para forçar `/complete-profile`.
- **Performance**:
  - Polling do EA: 3–5s. Endpoint precisa responder em < 500ms p95.
  - Trailing: latência do backend detectar TP atingido → EA executar o `MOVE_SL` ≤ 15s p95 (aceitável para trades H1/M15).

## Casos extremos a tratar

- **EA offline durante FILLED**: comando `OPEN_MARKET` fica na fila. Se EA voltar dentro de N minutos (configurável, default 5), executa; senão, comando é marcado `EXPIRED` e sinal fica sem execução. Backend loga.
- **Ordem MT5 rejeitada pela corretora** (spread alto, mercado fechado, saldo insuficiente): EA envia `ack` com `status: "error"` + `errorMsg`. Backend marca comando como falhado, notifica usuário no painel, não retenta.
- **Preço já passou muito da entrada quando FILLED chega no EA**: EA abre a mercado do mesmo jeito (é a regra). Backend NÃO valida distância. Usuário é avisado no painel do slippage.
- **MT5 em conta diferente da vinculada**: 403 `license_bound_to_other_account`. EA para de operar até resetar no painel.
- **Volume configurado < lote mínimo do símbolo**: EA arredonda para cima até o lote mínimo, loga aviso, executa. Painel mostra warning.
- **Sinal muda para status WIN/LOSS/EXPIRED enquanto ordem está aberta**: backend emite `CLOSE_POSITION` opcional? **Decisão**: NÃO. Ordem só fecha por SL ou intervenção manual. Backend apenas para de emitir `MOVE_SL` novos.
- **Duas ordens do mesmo sinal**: backend usa `Signal.tradeCreated` (já existe no schema) para garantir idempotência — só emite `OPEN_MARKET` uma vez por sinal.
- **Usuário troca de operacional/ativo com posição aberta**: posições em aberto continuam sendo trailadas; novos sinais que não casam com o filtro não geram comando.
- **Assinatura expira com posição aberta**: backend PARA de emitir `MOVE_SL`. Posição existente no MT5 fica exposta ao SL original (ou última posição trailada). Aviso claro no painel: "sua assinatura expirou, seu trailing parou; sua ordem no MT5 continua ativa até bater SL".
- **Cooldown de reset de conta MT5**: se usuário tenta resetar < 24h após último reset, botão fica desabilitado com tooltip "disponível em Xh".
- **Perfil incompleto (sem telefone)**: qualquer rota redireciona pra `/complete-profile`. Trial não conta.
- **Telefone já cadastrado por outro email**: signup/complete-profile retorna erro "telefone já em uso".

## Definição de "concluído"

Critérios verificáveis por inspeção externa:

- [ ] D1. Existe plano "Premium" no dashboard Asaas com valor R$97,90/mês e a documentação do repo aponta pra ele.
- [ ] D2. Executar `grep -r "stripe" .` no repo (excluindo `node_modules`) retorna zero resultados em código de produção. `package.json` não contém dependência do Stripe.
- [ ] D3. Um usuário novo faz signup no Clerk → é redirecionado pra `/complete-profile` → ao preencher telefone válido, é liberado pro dashboard. Se tentar acessar `/dashboard` diretamente sem telefone, é redirecionado de volta.
- [ ] D4. Um usuário em trial (3 dias, R$47,90) acessa `/robo-mt5` → vê a página de upsell com vídeo e CTA de assinatura Premium. Não consegue baixar o `.ex5`.
- [ ] D5. Um usuário Premium ativo acessa `/robo-mt5` → vê o painel com todos os componentes de R15. Pode baixar o `.ex5`, ver e regenerar a licença, editar modo/ativos/volume, ver status do EA.
- [ ] D6. Instalar o `.ex5` no MT5, configurar `email + license key`, anexar em um gráfico → journal do MT5 loga "conectado", painel web mostra "Online" em < 2 min.
- [ ] D7. Tentar rodar o mesmo `.ex5` com a mesma licença em outra conta MT5 → journal loga "license_bound_to_other_account" e nenhum trade é executado.
- [ ] D8. Gerar um sinal manualmente no sistema (ou aguardar um do scanner) → assim que `signalTracker.ts` marca FILLED → o EA no MT5 abre uma ordem a mercado com SL definido, sem TP posicionado, no volume configurado no painel.
- [ ] D9. Fazer o preço bater TP1 (manualmente ou aguardando) → SL da ordem MT5 é movido para o preço de entrada. Bater TP2 → SL vai pro TP1. Bater TP3 → SL vai pro TP2. Preço além do TP3 → SL vai pro TP3.
- [ ] D10. Cancelar assinatura Premium via Asaas (ou simular via webhook) → próxima chamada de polling do EA recebe HTTP 403 → journal loga "assinatura inativa" → nenhum comando novo é executado.
- [ ] D11. Suspender pagamento (subscriptionStatus = inactive) → acessar qualquer rota do dashboard → é redirecionado para tela de reativação.
- [ ] D12. Item "Robô MT5" na sidebar tem ícone de cadeado quando o usuário NÃO é Premium ativo, e ícone normal quando é.
- [ ] D13. Vídeo explicativo produzido pela skill `video-explicativo` está hospedado em URL do YouTube e embedado nas duas telas (upsell e painel).
- [ ] D14. Botão "Resetar conta MT5" desabilitado se `now() - lastMt5Reset < 24h`; habilitado após.
- [ ] D15. Executar `grep -riE "trade[- ]vision[- ]?ai" app/ components/ public/ --include="*.tsx" --include="*.ts" --include="*.html" --include="*.md"` (excluindo referências históricas em comentários e o path do repo em si) retorna zero resultados em strings user-facing. `<title>` do documento contém "ZaionVest".
- [ ] D16. Acessar `https://zaionvest.com.br` carrega o app em produção. Acessar `https://trade-vision-ai.vercel.app` retorna 301 pra `zaionvest.com.br`.

## Notas e decisões em aberto

- **Limitação conhecida — anti-farm de trial fraco**: sem CPF e sem OTP, um usuário pode criar múltiplos triais de 3 dias gerando email novo + número virtual novo. Trade-off aceito. Reforçar depois se houver abuso (adicionar OTP por WhatsApp ou reintroduzir CPF).
- **Migração de usuários existentes hoje no Stripe**: como transferir os assinantes atuais R$47,90 do Stripe para o Asaas (portabilidade de assinatura, comunicação, período de graça) — plano de migração precisa ser definido antes do build ir pra produção. Sugestão: script one-off que gera link do checkout Asaas e email pedindo re-cadastro, com prazo de N dias antes de cortar o Stripe.
- **Distribuição do `.ex5`**: compilação do `.mq5` para `.ex5` requer MetaEditor rodando no Windows. Definir: rodamos MetaEditor localmente e commitamos o `.ex5` no repo, ou construímos pipeline de build automatizado? Sugerido para o build: compilar manualmente e servir via `GET /api/robo/download-ea` a partir de um asset versionado.
- **Como o EA embute o email do usuário**: o `.ex5` genérico ficaria com inputs `Email` e `LicenseKey` para o usuário preencher manualmente. Alternativa: gerar `.set` por download com email já preenchido. Sugerido: gerar `.set` por download; usuário faz Load no MT5.
- **Rate limit por licença**: limitar polling a X requests/min por licença para evitar EA mal configurado martelando o backend. Definir X no build (sugerido: 30/min, dá polling de 2s no pior caso).
- **Timeout de comando `OPEN_MARKET`**: quantos minutos após emissão o comando expira se o EA não confirmar? (Sugerido: 5 min.)
- **Endereço do endpoint no EA**: URL do backend fica hardcoded no `.ex5` (`https://zaionvest.com.br/api/robo/...`). Sem input, pra reduzir suporte. Confirmado.

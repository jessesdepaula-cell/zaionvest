# ZaionVest

> Análise institucional de gráficos financeiros em segundos, movida a IA.

Plataforma SaaS Next.js 15 (App Router) com Clerk, Stripe, Prisma + Postgres e OpenAI. Dois modos de análise — **Clássico** (tendência, S/R, candles) e **SMC** (BOS/CHoCH, Order Blocks, FVG, liquidez) — com plano de trade completo (entrada, stop, alvo, R:R).

Os dados de mercado vêm **direto das APIs de mercado** — Binance para cripto, Twelve Data para forex — sem necessidade de instalar robô.

## Stack

- **Next.js 15 + React 19** — App Router, Server Components, Route Handlers
- **TypeScript** estrito
- **Tailwind CSS** com design system "terminal institucional"
- **Clerk** — autenticação e proteção de rotas
- **Stripe** — assinatura mensal (com modo mock `STRIPE_MOCK=true`)
- **OpenAI SDK** — GPT-4o com visão (modelo configurável via `OPENAI_MODEL`)
- **Prisma + PostgreSQL** — usuários, watchlist, sinais, trades
- **Binance public REST** — candles de cripto (BTC), gratuito ilimitado
- **Twelve Data REST** — candles de forex (EURUSD, GBPUSD, USDJPY, USDCHF), 800 req/dia no plano gratuito
- **Vercel Cron** — scan automático a cada 15 minutos

## Símbolos suportados

| Símbolo | Classe | Provider |
|---|---|---|
| BTCUSD | Crypto | Binance |
| EURUSD | Forex | Twelve Data |
| GBPUSD | Forex | Twelve Data |
| USDJPY | Forex | Twelve Data |
| USDCHF | Forex | Twelve Data |

Adicionar novos símbolos: edite `lib/market/symbols.ts`.

## Estrutura

```
app/
  api/
    analyze/route.ts             # POST → OpenAI Vision sobre imagem
    market/
      symbols/route.ts           # lista de símbolos suportados
      quote/route.ts             # cotação cacheada
      candles/route.ts           # candles cacheados
    scan/run/route.ts            # POST → scan manual (1 item ou toda watchlist)
    cron/scan-all/route.ts       # GET (Vercel Cron) → scan de todos usuários ativos
  dashboard/
    page.tsx                     # mesa de análise por imagem
    sinais/                      # sinais ao vivo gerados pelo scan
    watchlist/page.tsx           # CRUD da watchlist do usuário
    diario/                      # journal de trades
    estatisticas/                # KPIs
    backtest/                    # backtest sobre histórico de sinais
    configuracoes/page.tsx       # perfil, dados, integrações
lib/
  market/
    symbols.ts                   # lista canônica + mapping por provider
    types.ts                     # Candle, Quote, Timeframe
    router.ts                    # cache em memória + roteamento por classe
    providers/binance.ts         # cripto
    providers/twelvedata.ts      # forex
  scan/orchestrator.ts           # pull candles → scanWithAI → persist Signal
  signalTracker.ts               # fecha sinais abertos contra novas velas
  aiScan.ts                      # OpenAI Vision/Chat com prompts SMC/Clássico
prisma/schema.prisma             # User, Analysis, Trade, Watchlist, Signal, MarketTick
vercel.json                      # cron config */15 min
```

## Como rodar

```bash
# 1. Instalar deps
npm install

# 2. Configurar Postgres (Supabase, Neon ou local) e Twelve Data API key
cp .env.example .env.local
# preencha DATABASE_URL, TWELVEDATA_API_KEY, OPENAI_API_KEY, Clerk

# 3. Migrar o schema
npx prisma db push

# 4. Subir dev server
npm run dev
```

Acesse `http://localhost:3000`.

- `/` — landing
- `/sign-up` — cadastro Clerk
- `/dashboard` — análise por imagem (OpenAI Vision)
- `/dashboard/sinais` — sinais ao vivo gerados pelo scan
- `/dashboard/watchlist` — gerenciar símbolos escaneados
- `/billing` — paywall

## Como funciona o scan automático

1. **Vercel Cron** chama `GET /api/cron/scan-all` a cada 15 minutos.
2. A rota itera por todos os usuários com assinatura ativa que têm pelo menos um item de watchlist ativo.
3. Para cada item, o **orchestrator**:
   - puxa candles via `lib/market/router` (Binance ou Twelve Data, cacheados);
   - chama `evaluateOpenSignalsAgainstCandles` pra fechar sinais abertos;
   - chama `scanWithAI` (OpenAI) pra gerar um novo sinal;
   - persiste em `Signal`.
4. O dashboard `/dashboard/sinais` lê do banco com auto-refresh de 30s.

Usuário também pode disparar manualmente em `/dashboard/watchlist` (botão "Escanear agora").

## Custo e escala

- **Binance**: gratuito ilimitado para dados públicos.
- **Twelve Data Basic (free)**: 800 req/dia, 8 req/min, 8 símbolos WebSocket.
- **Vercel Hobby**: cron + 100GB bandwidth + 100k function invocations/mês.
- **OpenAI**: custo variável por análise (~$0.01–0.03 por scan).

Com a stack atual (BTC + 4 majors), o tier free das APIs cobre tranquilamente até centenas de assinantes simultâneos, pois o cache compartilha 1 chamada por símbolo entre todos os usuários.

## API: `/api/analyze`

`POST` JSON: `{ image: "data:image/png;base64,...", mode: "CLASSICO" | "SMC" }`

Resposta JSON com `status`, `validacao`, `analise` (entrada, stop, alvo, R:R, justificativa).

## API: `/api/market/*`

- `GET /api/market/symbols` — lista de símbolos suportados.
- `GET /api/market/quote?symbol=BTCUSD` — bid/ask cacheado.
- `GET /api/market/candles?symbol=BTCUSD&tf=M15&limit=500` — candles OHLC.

## API: `/api/scan/run`

`POST` (autenticado):
- Sem body → scan de toda a watchlist ativa do usuário.
- `{ "watchlistId": "..." }` → scan apenas desse item.

## Design system

- Fundo: `#0A0A0A` (charcoal) com grid sutil 32px e máscara radial.
- Destaque: `#10B981` (electric emerald).
- Alerta: `#F59E0B` (warm amber).
- Texto: `#F5F5F7` (off-white).
- Fontes: Inter (UI) + JetBrains Mono (números).

## Disclaimer

Conteúdo educacional. Não constitui recomendação de investimento.

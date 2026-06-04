# Trade Vision AI

> Análise institucional de gráficos financeiros em segundos, movida a Claude Vision.

Plataforma SaaS Next.js 14+ (App Router) com Clerk, Stripe, Prisma + Postgres e Anthropic SDK. Dois modos de análise — **Clássico** (tendência, S/R, candles) e **SMC** (BOS/CHoCH, Order Blocks, FVG, liquidez) — com Quality Gate visual e plano de trade completo (entrada, stop, alvo, R:R).

## Stack

- **Next.js 15 + React 19** — App Router, Server Components, Route Handlers
- **TypeScript** estrito
- **Tailwind CSS** com design system "terminal institucional" (charcoal + electric emerald + warm amber)
- **Clerk** — autenticação e proteção de rotas
- **Stripe** — assinatura mensal (com modo mock para MVP, `STRIPE_MOCK=true`)
- **OpenAI SDK** — GPT-4o com visão (modelo configurável via `OPENAI_MODEL`)
- **Prisma + PostgreSQL** — usuários e histórico de análises

## Estrutura

```
app/
  layout.tsx                   # ClerkProvider + fontes Inter/JetBrains Mono
  page.tsx                     # Landing page premium (anti-clichê de IA)
  globals.css                  # Design tokens, glass, shimmer, num
  sign-in/[[...sign-in]]/      # Clerk SignIn
  sign-up/[[...sign-up]]/      # Clerk SignUp
  dashboard/
    layout.tsx                 # Guarda de assinatura ativa + UserButton
    page.tsx                   # Mesa de análise
  billing/page.tsx             # Paywall para assinatura inativa
  api/
    analyze/route.ts           # POST → Claude Vision → JSON tratado
    billing/checkout/route.ts  # Stripe Checkout (ou mock → ativa direto)
    billing/webhook/route.ts   # Stripe webhook → sincroniza status
components/dashboard/Analyzer.tsx  # Drag-and-drop + toggle + result cards
lib/
  prisma.ts                    # singleton PrismaClient
  subscription.ts              # getOrCreateUser + requireActiveSubscription
  utils.ts                     # cn helper
prisma/schema.prisma           # User + Analysis
middleware.ts                  # clerkMiddleware protegendo /dashboard e /api/*
tailwind.config.ts             # Charcoal, emerald-electric, amber-warm
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# Stripe — para MVP use STRIPE_MOCK=true (ativa assinatura sem cobrar)
STRIPE_MOCK=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/tradevision"
```

## Como rodar

```bash
# 1. Instalar deps
npm install

# 2. Configurar Postgres (use Supabase, Neon ou Postgres local)
npx prisma db push

# 3. Subir dev server
npm run dev
```

Acesse `http://localhost:3000`.

- `/` — landing
- `/sign-up` — cadastro Clerk
- `/dashboard` — mesa de análise (exige assinatura ativa; `STRIPE_MOCK=true` ativa automaticamente)
- `/billing` — paywall

## API: `/api/analyze`

`POST` JSON: `{ image: "data:image/png;base64,...", mode: "CLASSICO" | "SMC" }`

Resposta no formato:

```json
{
  "status": "VALIDO" | "INVALIDO",
  "modo_aplicado": "CLASSICO" | "SMC",
  "validacao": { "ativo_identificado": "...", "timeframe_identificado": "...", "qualidade_imagem": "ALTA" },
  "mensagem_erro": "...",
  "analise": {
    "estrutura_ou_tendencia": "...",
    "ponto_entrada": "...",
    "stop_loss": "...",
    "take_profit": "...",
    "risco_retorno_estimado": "...",
    "confianca_ia": "...",
    "justificativa": "..."
  }
}
```

A rota:
1. Verifica autenticação Clerk + `subscriptionStatus === 'active' | 'trialing'`.
2. Chama Claude com `temperature: 0.1` e o system prompt institucional.
3. Limpa fences ```json``` se houver, faz `JSON.parse`.
4. Persiste o registro em `Analysis` para histórico.

## Design system

Sem roxo neon, sem gradientes saturados, sem ícones de cérebro.

- Fundo: `#0A0A0A` (charcoal) com grid sutil 32px e mascara radial.
- Destaque: `#10B981` (electric emerald) — ações, lucro, confirmações.
- Alerta: `#F59E0B` (warm amber) — quality gate, SMC, avisos.
- Texto: `#F5F5F7` (off-white).
- Fontes: Inter (UI) + JetBrains Mono (TODOS os números — preços, stops, alvos).
- Componentes: hairline `border-white/10`, `glass` (blur 8px sobre 2.5% white), sombras `terminal` e `glow`.

## Disclaimer

Conteúdo educacional. Não constitui recomendação de investimento.

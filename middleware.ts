import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// IMPORTANTE: proteger só o /api/billing/checkout (exige login). O
// /api/billing/webhook NÃO pode entrar aqui — o Asaas chama sem sessão Clerk e
// o auth.protect() responderia 404, tornando o webhook inalcançável (pagamentos
// nunca confirmavam). O webhook faz sua própria auth via asaas-access-token.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/analyze(.*)",
  "/api/billing/checkout(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

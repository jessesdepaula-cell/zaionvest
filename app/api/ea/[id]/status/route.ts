import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isAccountInPartnerTree } from "@/lib/roboforexApi";

/**
 * Endpoint de licença consultado pelo EA no MT5 do cliente (WebRequest, ~30min).
 *
 * Modelo A: o .ex5 tem os parâmetros embutidos (baked-in). Este endpoint NÃO
 * expõe parâmetros/estratégia — só devolve um veredito de licença. Assim a
 * lógica do robô fica protegida no binário.
 *
 * POST (corpo JSON, para não trafegar e-mail na URL):
 *   { email, account, company }
 *
 * Resposta (sempre 200 quando é um veredito; o EA interpreta `valid`/`reason`):
 *   { valid: boolean, status, reason }
 *     reason: "ok" | "ea_rejected" | "ea_pending" | "ea_not_found"
 *           | "unknown_client" | "no_subscription" | "wrong_broker" | "not_partner_account"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    account?: string | number;
    company?: string;
  };

  const ea = await prisma.eA.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, status: true },
  });

  if (!ea) {
    return NextResponse.json({ valid: false, reason: "ea_not_found" });
  }

  // Estratégia reprovada → EA trava independentemente da assinatura.
  if (ea.status === "REJECTED") {
    return NextResponse.json({
      valid: false,
      status: ea.status,
      reason: "ea_rejected",
    });
  }
  if (ea.status !== "APPROVED") {
    return NextResponse.json({
      valid: false,
      status: ea.status,
      reason: "ea_pending",
    });
  }

  // Identifica o cliente pelo e-mail informado no input do EA.
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({
      valid: false,
      status: ea.status,
      reason: "unknown_client",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { subscriptionStatus: true, currentPeriodEnd: true },
  });

  if (!user) {
    return NextResponse.json({
      valid: false,
      status: ea.status,
      reason: "unknown_client",
    });
  }

  const activeStatus =
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing";
  const notExpired =
    !user.currentPeriodEnd || user.currentPeriodEnd.getTime() > Date.now();

  if (!activeStatus || !notExpired) {
    return NextResponse.json({
      valid: false,
      status: ea.status,
      reason: "no_subscription",
    });
  }

  // 1. Amarração EXCLUSIVA RoboForex: Bloqueia qualquer outra corretora por padrão.
  const requireRoboforex = process.env.REQUIRE_ROBOFOREX !== "false";
  if (requireRoboforex) {
    const company = (body.company ?? "").toLowerCase();
    if (!company.includes("roboforex")) {
      return NextResponse.json({
        valid: false,
        status: ea.status,
        reason: "wrong_broker",
      });
    }
  }

  // 2. Amarração com o Grupo de Parceiros RoboForex (ZAION):
  // Valida via API oficial se a conta do cliente está cadastrada na árvore de afiliados.
  if (body.account && process.env.ROBOFOREX_API_KEY && process.env.ROBOFOREX_PARTNER_ACCOUNT) {
    const isPartnerAccount = await isAccountInPartnerTree(body.account);
    if (!isPartnerAccount) {
      return NextResponse.json({
        valid: false,
        status: ea.status,
        reason: "not_partner_account",
      });
    }
  }

  return NextResponse.json({ valid: true, status: ea.status, reason: "ok" });
}

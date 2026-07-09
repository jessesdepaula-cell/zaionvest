import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createSignedUrl } from "@/lib/storage";

/**
 * Download do .ex5 licenciado. Exige login (Clerk) + assinatura ativa.
 * Serve via URL assinada temporária (não um link cru compartilhável).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, subscriptionStatus: true, currentPeriodEnd: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isActive =
    (user.subscriptionStatus === "active" ||
      user.subscriptionStatus === "trialing") &&
    (!user.currentPeriodEnd || user.currentPeriodEnd.getTime() > Date.now());

  if (!isActive) {
    return NextResponse.json(
      { error: "Active subscription required" },
      { status: 403 }
    );
  }

  const ea = await prisma.eA.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, status: true, fileUrl: true },
  });

  if (!ea) {
    return NextResponse.json({ error: "EA not found" }, { status: 404 });
  }
  if (ea.status !== "APPROVED") {
    return NextResponse.json(
      { error: "EA is not approved for download" },
      { status: 403 }
    );
  }
  if (!ea.fileUrl) {
    return NextResponse.json({ error: "File not available yet" }, { status: 404 });
  }

  // Registra o download (upsert idempotente — duplo clique não duplica).
  await prisma.eADownload.upsert({
    where: { eaId_userId: { eaId: id, userId: user.id } },
    create: { eaId: id, userId: user.id },
    update: {},
  });

  // Se fileUrl já é uma URL completa (legado), redireciona direto.
  // Senão, trata como caminho no Storage e gera uma URL assinada temporária.
  if (/^https?:\/\//.test(ea.fileUrl)) {
    return NextResponse.redirect(ea.fileUrl);
  }

  const signed = await createSignedUrl(ea.fileUrl, 300);
  if (!signed) {
    return NextResponse.json(
      { error: "Storage not configured or file missing" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed);
}

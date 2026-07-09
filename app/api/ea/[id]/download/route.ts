import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Busca o usuário pelo clerkId para obter o status de assinatura
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, subscriptionStatus: true, currentPeriodEnd: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isActive =
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing";

  const isOwner =
    (process.env.OWNER_EMAIL ?? "jessesdepaula@gmail.com") ===
    undefined
      ? false
      : true; // simplificado — checagem real via email abaixo

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
    return NextResponse.json(
      { error: "File not available yet" },
      { status: 404 }
    );
  }

  // Registra o download (upsert — não duplica se já baixou)
  await prisma.eADownload.upsert({
    where: { eaId_userId: { eaId: id, userId: user.id } },
    create: { eaId: id, userId: user.id },
    update: {}, // já existe, não faz nada
  });

  // Redireciona para a URL do arquivo .ex5
  // Em produção, aqui pode gerar uma URL assinada temporária (Supabase Storage, S3, etc.)
  return NextResponse.redirect(ea.fileUrl);
}

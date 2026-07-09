import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Endpoint público — o EA MQL5 faz polling aqui a cada 30 min.
// Não requer autenticação para que o EA funcione mesmo sem login do usuário.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ea = await prisma.eA.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      paramsJson: true,
      paramsVersion: true,
      lastValidatedAt: true,
      updatedAt: true,
    },
  });

  if (!ea) {
    return NextResponse.json({ error: "EA not found" }, { status: 404 });
  }

  // O EA MQL5 interpreta o campo "status":
  //   "APPROVED"  → continua operando, aplica paramsJson se paramsVersion mudou
  //   "REJECTED"  → para novas ordens, exibe alerta no chart
  //   "PENDING"   → aguarda validação, mantém comportamento atual
  return NextResponse.json({
    id: ea.id,
    slug: ea.slug,
    name: ea.name,
    status: ea.status,
    params: ea.paramsJson ?? {},
    paramsVersion: ea.paramsVersion,
    lastValidatedAt: ea.lastValidatedAt,
    updatedAt: ea.updatedAt,
  });
}

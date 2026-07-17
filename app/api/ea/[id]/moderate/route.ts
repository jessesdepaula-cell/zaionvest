import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "jessesdepaula@gmail.com";

// Transições permitidas pela moderação manual (staging). Só o dono move um EA
// STAGED para a vitrine (APPROVED) ou o descarta (REJECTED). Não é o gate de
// robustez — esse já rodou no publish.py; aqui é só a trava humana final.
const ALLOWED = new Set(["APPROVED", "REJECTED"]);

/**
 * Muda o status de moderação de um EA. Owner-only (Clerk).
 * Body: { status: "APPROVED" | "REJECTED" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const status = body.status;
  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json(
      { error: "status deve ser APPROVED ou REJECTED" },
      { status: 400 }
    );
  }

  const ea = await prisma.eA.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!ea) {
    return NextResponse.json({ error: "EA not found" }, { status: 404 });
  }

  await prisma.eA.update({
    where: { id },
    data: { status, updatedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    id: ea.id,
    name: ea.name,
    from: ea.status,
    status,
    message:
      status === "APPROVED"
        ? `"${ea.name}" promovido para a vitrine.`
        : `"${ea.name}" rejeitado.`,
  });
}

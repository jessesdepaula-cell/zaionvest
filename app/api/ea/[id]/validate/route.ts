import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { enqueueRevalidation } from "@/lib/queue";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "jessesdepaula@gmail.com";

/**
 * Dispara a revalidação de um EA. NÃO roda o pipeline aqui — a Vercel apenas
 * ENFILEIRA um job; o worker Windows/MT5 executa o backtest/WFA/Monte Carlo e
 * devolve o resultado via /api/worker/complete.
 *
 * Autorização: (a) cron server-to-server via Bearer CRON_SECRET, ou
 *              (b) owner logado via Clerk.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (email !== OWNER_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ea = await prisma.eA.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!ea) {
    return NextResponse.json({ error: "EA not found" }, { status: 404 });
  }

  const { job, created } = await enqueueRevalidation(id);

  return NextResponse.json(
    {
      ok: true,
      queued: true,
      alreadyQueued: !created,
      jobId: job.id,
      message: created
        ? `Revalidação de "${ea.name}" enfileirada. O worker vai processar.`
        : `Já existe uma revalidação pendente para "${ea.name}".`,
    },
    { status: 202 }
  );
}

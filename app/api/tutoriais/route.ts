import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isOwner } from "@/lib/subscription";

// Helper para extrair o ID de embed do YouTube (suporta links normais, short, embed e unlisted)
function extractYouTubeEmbedId(url: string): string {
  if (!url) return "";
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : url;
}

export async function GET() {
  try {
    const videos = await prisma.tutorialVideo.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ ok: true, videos });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { email: true, subscriptionStatus: true }
    });

    if (!isOwner(user)) {
      return NextResponse.json({ ok: false, error: "Acesso restrito ao Gestor (Jessé)." }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, youtubeUrl, category } = body;

    if (!title || !youtubeUrl) {
      return NextResponse.json({ ok: false, error: "Título e Link do YouTube são obrigatórios." }, { status: 400 });
    }

    const embedId = extractYouTubeEmbedId(youtubeUrl);

    const video = await prisma.tutorialVideo.create({
      data: {
        title,
        description: description || "",
        youtubeUrl,
        embedId,
        category: category || "Instalação e Configuração",
      }
    });

    return NextResponse.json({ ok: true, video });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { email: true, subscriptionStatus: true }
    });

    if (!isOwner(user)) {
      return NextResponse.json({ ok: false, error: "Acesso restrito ao Gestor." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID do vídeo é obrigatório." }, { status: 400 });
    }

    await prisma.tutorialVideo.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

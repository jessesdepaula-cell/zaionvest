import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/subscription";
import { TutorialVideoClient } from "./TutorialVideoClient";

export const revalidate = 0; // Sempre atualizado

export default async function TutoriaisPage({
  searchParams,
}: {
  searchParams: Promise<{ manager?: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true, subscriptionStatus: true },
  });
  if (!user) redirect("/sign-in");

  const owner = isOwner(user);
  const videos = await prisma.tutorialVideo.findMany({
    orderBy: { order: "asc" },
  });

  return <TutorialVideoClient initialVideos={videos} isManager={owner} />;
}

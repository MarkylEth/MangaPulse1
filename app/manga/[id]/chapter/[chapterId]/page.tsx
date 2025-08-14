// app/manga/[mangaId]/chapter/[chapterId]/page.tsx
import { notFound } from "next/navigation";
import ChapterReader from "@/components/ChapterReader";

export const dynamic = "force-dynamic";

type Params = { mangaId: string; chapterId: string };

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const { chapterId } = await params;

  const chId = Number(chapterId);
  if (!Number.isFinite(chId) || chId <= 0) notFound();

  return (
    <main className="min-h-screen">
      <ChapterReader chapterId={chId} />
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { mangaId, chapterId } = await params;
  return { title: `Глава ${chapterId} — Тайтл ${mangaId}` };
}

// app/manga/[id]/page.tsx
import { notFound } from "next/navigation";
import MangaTitlePage from "@/components/MangaTitlePage";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  // ← обязательно await
  const { id } = await params;

  const mangaId = Number(id);
  if (!Number.isFinite(mangaId) || mangaId <= 0) notFound();

  return (
    <main className="min-h-screen">
      <MangaTitlePage mangaId={mangaId} />
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return { title: `Тайтл #${id} — MangaPulse` };
}

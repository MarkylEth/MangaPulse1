// app/manga/[id]/page.tsx
import { getPublicChaptersByManga } from '@/lib/data/chapters';
import MangaTitlePage from '@/components/MangaTitlePage';

type PageProps = { params: { id: string } };

// server component
export default async function Page({ params }: PageProps) {
  const idStr = Array.isArray(params.id) ? params.id[0] : String(params.id ?? '');
  const m = idStr.match(/^\d+/); // поддержка вида "62-slug"
  const mangaId = m ? parseInt(m[0], 10) : 0;

  // 🔒 важно: тянем уже отфильтрованные главы (только published)
  const chapters = mangaId
    ? await getPublicChaptersByManga(mangaId, { order: 'desc', by: 'created_at' })
    : [];

  return <MangaTitlePage mangaId={mangaId} initialChapters={chapters} />;
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function ChapterReader({ chapterId }: { chapterId: number }) {
  const [pages, setPages] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase
      .from("chapter_pages")
      .select("*")
      .eq("chapter_id", chapterId)
      .order("page_index", { ascending: true })
      .then(({ data }) => setPages(data || []));
  }, [chapterId]);

  return (
    <div className="flex flex-col items-center gap-4">
      {pages.map((p) => (
        <img key={p.page_index} src={p.image_url} alt={`p${p.page_index}`} />
      ))}
    </div>
  );
}

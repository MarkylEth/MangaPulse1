'use client';
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Header } from '@/components/Header'
import { useTheme } from '@/lib/theme/context'
import type { Database } from "../../../../database.types";

type Manga = Database["public"]["Tables"]["manga"]["Row"];

export default function EditTitlePage({ params }: { params: { id: string } }) {
  const { theme } = useTheme()
  const mangaId = Number(params.id);
  
  // ... existing logic remains the same until the return statement ...

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`}>
      <Header showSearch={false} />
      
      <div className="p-6">
        {/* ... rest of existing content remains the same ... */}
      </div>
    </div>
  )
}

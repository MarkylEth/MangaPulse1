'use client'
import { useTheme } from '@/lib/theme/context'
import { Header } from '@/components/Header'
import TitlePage from "@/components/MangaTitlePage"

export default function Page({ params }: { params: { id: string } }) {
  const { theme } = useTheme()
  
  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`}>
      <Header showSearch={false} />
      <TitlePage mangaId={Number(params.id)} />
    </div>
  )
}

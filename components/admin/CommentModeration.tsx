'use client'
import { useTheme } from '@/lib/theme/context'
import { MessageSquare, AlertTriangle, Shield } from 'lucide-react'

export function CommentModeration() {
  const { theme } = useTheme()
  const textClass = theme === 'light' ? 'text-gray-900' : 'text-white'
  const mutedTextClass = theme === 'light' ? 'text-gray-600' : 'text-slate-400'

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Модерация комментариев</h1>
        <p className={mutedTextClass}>
          Управляйте комментариями и модерируйте контент пользователей
        </p>
      </div>
      
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${mutedTextClass}`} />
          <h3 className={`text-lg font-semibold ${textClass} mb-2`}>
            Модерация комментариев
          </h3>
          <p className={mutedTextClass}>
            Функция модерации комментариев будет добавлена в следующих обновлениях
          </p>
        </div>
      </div>
    </div>
  )
}

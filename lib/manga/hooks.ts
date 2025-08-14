'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import { Tables } from '@/database.types'

// Update the Manga type to match the actual data structure from Supabase
export type Manga = Tables<'manga'> & {
  genres?: { genre: string }[]
  chapters?: { 
    id: number
    chapter_number: number
    title: string | null
    status: string | null
  }[]
}

export function useManga() {
  const { user } = useAuth()
  const [manga, setManga] = useState<Manga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchManga = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('manga')
        .select(`
          *,
          genres:manga_genres(genre),
          chapters:chapters(id, chapter_number, title, status)
        `)
        .eq('submission_status', 'approved')
        .order('created_at', { ascending: false })

      if (error) throw error
      setManga(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки манги')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchManga()
  }, [])

  const submitManga = async (mangaData: {
    title: string
    description: string
    author: string
    artist: string
    coverUrl: string
    genres: string[]
  }) => {
    if (!user) throw new Error('Must be logged in')
    
    try {
      // Insert manga with proper field mapping
      const { data: manga, error: mangaError } = await supabase
        .from('manga')
        .insert({
          title: mangaData.title,
          description: mangaData.description,
          author: mangaData.author,
          artist: mangaData.artist,
          cover_url: mangaData.coverUrl, // Map coverUrl back to cover_url for database
          submitted_by: user.id,
          submission_status: 'pending'
        })
        .select()
        .single()

      if (mangaError) throw mangaError

      // Insert genres
      if (manga && mangaData.genres.length > 0) {
        const genreInserts = mangaData.genres.map(genre => ({
          manga_id: manga.id,
          genre: genre
        }))

        const { error: genreError } = await supabase
          .from('manga_genres')
          .insert(genreInserts)

        if (genreError) throw genreError
      }

      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const addToFavorites = async (mangaId: number) => {
    if (!user) throw new Error('Пользователь не авторизован')

    const { error } = await supabase
      .from('user_favorites')
      .insert({
        manga_id: mangaId,
        user_id: user.id,
      })

    return { error }
  }

  const removeFromFavorites = async (mangaId: number) => {
    if (!user) throw new Error('Пользователь не авторизован')

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('manga_id', mangaId)
      .eq('user_id', user.id)

    return { error }
  }

  const rateManga = async (mangaId: number, rating: number) => {
    if (!user) throw new Error('Пользователь не авторизован')

    const { error } = await supabase
      .from('manga_ratings')
      .upsert({
        manga_id: mangaId,
        user_id: user.id,
        rating,
      })

    return { error }
  }

  return {
    manga,
    loading,
    error,
    refetch: fetchManga,
    submitManga,
    addToFavorites,
    removeFromFavorites,
    rateManga,
  }
}

export function useUserFavorites() {
  const [favorites, setFavorites] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      setFavorites([])
      setLoading(false)
      return
    }

    const fetchFavorites = async () => {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('manga_id')
        .eq('user_id', user.id)

      if (!error && data) {
        setFavorites(data.map(item => item.manga_id))
      }
      setLoading(false)
    }

    fetchFavorites()
  }, [user])

  return { favorites, loading }
}

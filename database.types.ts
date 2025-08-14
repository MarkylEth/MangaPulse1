export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      chapter_pages: {
        Row: {
          chapter_id: number
          created_at: string | null
          id: number
          image_url: string
          page_index: number
          page_number: number
          updated_at: string | null
        }
        Insert: {
          chapter_id: number
          created_at?: string | null
          id?: number
          image_url: string
          page_index: number
          page_number: number
          updated_at?: string | null
        }
        Update: {
          chapter_id?: number
          created_at?: string | null
          id?: number
          image_url?: string
          page_index?: number
          page_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          approved_by: string | null
          chapter_number: number
          created_at: string
          id: number
          manga_id: number
          pages_count: number | null
          status: string | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          chapter_number: number
          created_at?: string
          id?: number
          manga_id: number
          pages_count?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Update: {
          approved_by?: string | null
          chapter_number?: number
          created_at?: string
          id?: number
          manga_id?: number
          pages_count?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      manga: {
        Row: {
          approved_by: string | null
          artist: string | null
          author: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          featured: boolean | null
          featured_rank: number | null
          genres: string | null
          id: number
          rating: number | null
          rating_count: number | null
          slug: string | null
          status: string | null
          submission_status: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          approved_by?: string | null
          artist?: string | null
          author?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          featured_rank?: number | null
          genres?: string | null
          id?: number
          rating?: number | null
          rating_count?: number | null
          slug?: string | null
          status?: string | null
          submission_status?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          approved_by?: string | null
          artist?: string | null
          author?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          featured_rank?: number | null
          genres?: string | null
          id?: number
          rating?: number | null
          rating_count?: number | null
          slug?: string | null
          status?: string | null
          submission_status?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manga_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manga_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          manga_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          manga_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          manga_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_comments_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manga_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_genres: {
        Row: {
          created_at: string
          genre: string
          id: string
          manga_id: number
        }
        Insert: {
          created_at?: string
          genre: string
          id?: string
          manga_id: number
        }
        Update: {
          created_at?: string
          genre?: string
          id?: string
          manga_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "manga_genres_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
        ]
      }
      manga_ratings: {
        Row: {
          created_at: string
          id: string
          manga_id: number
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manga_id: number
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manga_id?: number
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manga_ratings_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manga_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_translations: {
        Row: {
          approved_by: string | null
          chapter_id: number
          created_at: string
          created_by: string
          id: number
          lang: string
          page_id: number
          status: string
          text: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          chapter_id: number
          created_at?: string
          created_by: string
          id?: never
          lang: string
          page_id: number
          status?: string
          text?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          chapter_id?: number
          created_at?: string
          created_by?: string
          id?: never
          lang?: string
          page_id?: number
          status?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_translations_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_translations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "chapter_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reading_history: {
        Row: {
          chapter_id: number | null
          id: string
          last_read_at: string
          manga_id: number
          progress: number | null
          user_id: string
        }
        Insert: {
          chapter_id?: number | null
          id?: string
          last_read_at?: string
          manga_id: number
          progress?: number | null
          user_id: string
        }
        Update: {
          chapter_id?: number | null
          id?: string
          last_read_at?: string
          manga_id?: number
          progress?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      translator_team_members: {
        Row: {
          added_at: string
          role: string
          team_id: number
          user_id: string
        }
        Insert: {
          added_at?: string
          role?: string
          team_id: number
          user_id: string
        }
        Update: {
          added_at?: string
          role?: string
          team_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "translator_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "translator_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      translator_teams: {
        Row: {
          avatar_url: string | null
          bio: string | null
          boosty_url: string | null
          created_at: string
          created_by: string
          discord_url: string | null
          followers_count: number
          id: number
          langs: string[]
          likes_count: number
          manga_id: number
          name: string
          slug: string | null
          started_at: string | null
          stats_inwork: number
          stats_pages: number
          stats_projects: number
          tags: string[]
          telegram_url: string | null
          updated_at: string
          verified: boolean
          vk_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          boosty_url?: string | null
          created_at?: string
          created_by: string
          discord_url?: string | null
          followers_count?: number
          id?: number
          langs?: string[]
          likes_count?: number
          manga_id: number
          name: string
          slug?: string | null
          started_at?: string | null
          stats_inwork?: number
          stats_pages?: number
          stats_projects?: number
          tags?: string[]
          telegram_url?: string | null
          updated_at?: string
          verified?: boolean
          vk_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          boosty_url?: string | null
          created_at?: string
          created_by?: string
          discord_url?: string | null
          followers_count?: number
          id?: number
          langs?: string[]
          likes_count?: number
          manga_id?: number
          name?: string
          slug?: string | null
          started_at?: string | null
          stats_inwork?: number
          stats_pages?: number
          stats_projects?: number
          tags?: string[]
          telegram_url?: string | null
          updated_at?: string
          verified?: boolean
          vk_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translator_teams_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: true
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          manga_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manga_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manga_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_manga_id_fkey"
            columns: ["manga_id"]
            isOneToOne: false
            referencedRelation: "manga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_slug: {
        Args: { title: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

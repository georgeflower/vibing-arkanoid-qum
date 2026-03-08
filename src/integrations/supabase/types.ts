export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      boss_rush_scores: {
        Row: {
          boss_level: number
          completion_time_ms: number
          created_at: string
          id: string
          player_name: string
          score: number
        }
        Insert: {
          boss_level?: number
          completion_time_ms: number
          created_at?: string
          id?: string
          player_name: string
          score: number
        }
        Update: {
          boss_level?: number
          completion_time_ms?: number
          created_at?: string
          id?: string
          player_name?: string
          score?: number
        }
        Relationships: []
      }
      daily_challenge_completions: {
        Row: {
          challenge_date: string
          completed_at: string
          id: string
          objectives_met: Json
          score: number
          time_seconds: number
          user_id: string
        }
        Insert: {
          challenge_date: string
          completed_at?: string
          id?: string
          objectives_met?: Json
          score: number
          time_seconds: number
          user_id: string
        }
        Update: {
          challenge_date?: string
          completed_at?: string
          id?: string
          objectives_met?: Json
          score?: number
          time_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      high_scores: {
        Row: {
          beat_level_50: boolean | null
          collected_all_letters: boolean | null
          created_at: string
          difficulty: string | null
          game_mode: string | null
          id: string
          level: number
          player_name: string
          score: number
          starting_lives: number | null
          user_id: string | null
        }
        Insert: {
          beat_level_50?: boolean | null
          collected_all_letters?: boolean | null
          created_at?: string
          difficulty?: string | null
          game_mode?: string | null
          id?: string
          level: number
          player_name: string
          score: number
          starting_lives?: number | null
          user_id?: string | null
        }
        Update: {
          beat_level_50?: boolean | null
          collected_all_letters?: boolean | null
          created_at?: string
          difficulty?: string | null
          game_mode?: string | null
          id?: string
          level?: number
          player_name?: string
          score?: number
          starting_lives?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      player_profiles: {
        Row: {
          achievements: Json
          best_combo_streak: number
          best_daily_streak: number
          best_level: number
          best_score: number
          bio: string | null
          created_at: string
          daily_challenge_streak: number
          display_name: string
          favorite_power_up: string | null
          id: string
          initials: string | null
          is_public: boolean
          last_daily_challenge_date: string | null
          power_up_usage: Json
          total_bosses_killed: number
          total_bricks_destroyed: number
          total_daily_challenges_completed: number
          total_enemies_killed: number
          total_games_played: number
          total_power_ups_collected: number
          total_time_played_seconds: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          achievements?: Json
          best_combo_streak?: number
          best_daily_streak?: number
          best_level?: number
          best_score?: number
          bio?: string | null
          created_at?: string
          daily_challenge_streak?: number
          display_name: string
          favorite_power_up?: string | null
          id?: string
          initials?: string | null
          is_public?: boolean
          last_daily_challenge_date?: string | null
          power_up_usage?: Json
          total_bosses_killed?: number
          total_bricks_destroyed?: number
          total_daily_challenges_completed?: number
          total_enemies_killed?: number
          total_games_played?: number
          total_power_ups_collected?: number
          total_time_played_seconds?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          achievements?: Json
          best_combo_streak?: number
          best_daily_streak?: number
          best_level?: number
          best_score?: number
          bio?: string | null
          created_at?: string
          daily_challenge_streak?: number
          display_name?: string
          favorite_power_up?: string | null
          id?: string
          initials?: string | null
          is_public?: boolean
          last_daily_challenge_date?: string | null
          power_up_usage?: Json
          total_bosses_killed?: number
          total_bricks_destroyed?: number
          total_daily_challenges_completed?: number
          total_enemies_killed?: number
          total_games_played?: number
          total_power_ups_collected?: number
          total_time_played_seconds?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

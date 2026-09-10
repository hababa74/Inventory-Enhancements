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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      matches: {
        Row: {
          best_of: number
          code: string
          created_at: string
          ended_at: string | null
          guest_mmr: number
          guest_mmr_after: number | null
          guest_name: string
          guest_player_id: string
          guest_seen_at: string
          guest_skin: string
          host_mmr: number
          host_mmr_after: number | null
          host_name: string
          host_player_id: string
          host_seen_at: string
          host_skin: string
          id: string
          score_guest: number
          score_host: number
          seed: number
          status: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          best_of?: number
          code: string
          created_at?: string
          ended_at?: string | null
          guest_mmr?: number
          guest_mmr_after?: number | null
          guest_name?: string
          guest_player_id: string
          guest_seen_at?: string
          guest_skin?: string
          host_mmr?: number
          host_mmr_after?: number | null
          host_name?: string
          host_player_id: string
          host_seen_at?: string
          host_skin?: string
          id?: string
          score_guest?: number
          score_host?: number
          seed?: number
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          best_of?: number
          code?: string
          created_at?: string
          ended_at?: string | null
          guest_mmr?: number
          guest_mmr_after?: number | null
          guest_name?: string
          guest_player_id?: string
          guest_seen_at?: string
          guest_skin?: string
          host_mmr?: number
          host_mmr_after?: number | null
          host_name?: string
          host_player_id?: string
          host_seen_at?: string
          host_skin?: string
          id?: string
          score_guest?: number
          score_host?: number
          seed?: number
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: []
      }
      mm_queue: {
        Row: {
          best_of: number
          created_at: string
          match_id: string | null
          mmr: number
          name: string
          player_id: string
          region: string
          seen_at: string
          skin: string
        }
        Insert: {
          best_of?: number
          created_at?: string
          match_id?: string | null
          mmr?: number
          name?: string
          player_id: string
          region?: string
          seen_at?: string
          skin?: string
        }
        Update: {
          best_of?: number
          created_at?: string
          match_id?: string | null
          mmr?: number
          name?: string
          player_id?: string
          region?: string
          seen_at?: string
          skin?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_queue_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          losses: number
          mmr: number
          name: string
          player_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          losses?: number
          mmr?: number
          name?: string
          player_id: string
          updated_at?: string
          wins?: number
        }
        Update: {
          losses?: number
          mmr?: number
          name?: string
          player_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mm_find_or_queue: {
        Args: {
          p_best_of?: number
          p_mmr: number
          p_name: string
          p_player_id: string
          p_region?: string
          p_skin: string
        }
        Returns: {
          best_of: number
          code: string
          created_at: string
          ended_at: string | null
          guest_mmr: number
          guest_mmr_after: number | null
          guest_name: string
          guest_player_id: string
          guest_seen_at: string
          guest_skin: string
          host_mmr: number
          host_mmr_after: number | null
          host_name: string
          host_player_id: string
          host_seen_at: string
          host_skin: string
          id: string
          score_guest: number
          score_host: number
          seed: number
          status: string
          updated_at: string
          winner: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

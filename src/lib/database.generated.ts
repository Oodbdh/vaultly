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
      bonus_slots: {
        Row: {
          granted_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          id: string
          locale: string
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          premium_until: string | null
          push_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          locale?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          premium_until?: string | null
          push_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          premium_until?: string | null
          push_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          auto_renews: boolean
          created_at: string
          currency: string
          id: string
          item_id: string | null
          name: string
          next_renewal: string
          period: Database["public"]["Enums"]["billing_period"]
          reminder_days: number[]
          user_id: string
        }
        Insert: {
          amount: number
          auto_renews?: boolean
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          name: string
          next_renewal: string
          period?: Database["public"]["Enums"]["billing_period"]
          reminder_days?: number[]
          user_id: string
        }
        Update: {
          amount?: number
          auto_renews?: boolean
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          name?: string
          next_renewal?: string
          period?: Database["public"]["Enums"]["billing_period"]
          reminder_days?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vault_items"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_items: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          id: string
          image_path: string | null
          kind: Database["public"]["Enums"]["item_kind"]
          merchant_name: string
          notes: string | null
          ocr_confidence: number | null
          ocr_raw: Json | null
          ocr_status: Database["public"]["Enums"]["ocr_status"]
          purchase_date: string | null
          total_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          id?: string
          image_path?: string | null
          kind?: Database["public"]["Enums"]["item_kind"]
          merchant_name: string
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json | null
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          purchase_date?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string
          id?: string
          image_path?: string | null
          kind?: Database["public"]["Enums"]["item_kind"]
          merchant_name?: string
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json | null
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          purchase_date?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warranties: {
        Row: {
          created_at: string
          duration_months: number | null
          expires_on: string
          id: string
          item_id: string
          provider: string | null
          reminder_days: number[]
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_months?: number | null
          expires_on: string
          id?: string
          item_id: string
          provider?: string | null
          reminder_days?: number[]
          user_id: string
        }
        Update: {
          created_at?: string
          duration_months?: number | null
          expires_on?: string
          id?: string
          item_id?: string
          provider?: string | null
          reminder_days?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vault_items"
            referencedColumns: ["id"]
          },
        ]
      }
      تطبيق: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_premium: { Args: { uid: string }; Returns: boolean }
      item_allowance: { Args: { uid: string }; Returns: number }
    }
    Enums: {
      billing_period: "weekly" | "monthly" | "quarterly" | "yearly"
      item_kind: "receipt" | "warranty" | "subscription"
      ocr_status: "pending" | "processing" | "done" | "failed" | "manual"
      plan_tier: "free" | "premium"
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
    Enums: {
      billing_period: ["weekly", "monthly", "quarterly", "yearly"],
      item_kind: ["receipt", "warranty", "subscription"],
      ocr_status: ["pending", "processing", "done", "failed", "manual"],
      plan_tier: ["free", "premium"],
    },
  },
} as const

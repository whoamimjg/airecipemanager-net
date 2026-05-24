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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_totp: {
        Row: {
          created_at: string
          id: string
          is_verified: boolean
          totp_secret: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_verified?: boolean
          totp_secret: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_verified?: boolean
          totp_secret?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_history: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          invoice_number: string
          payment_method: string | null
          plan: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          invoice_number: string
          payment_method?: string | null
          plan?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          invoice_number?: string
          payment_method?: string | null
          plan?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_checked_keys: {
        Row: {
          created_at: string
          id: string
          item_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_deleted_keys: {
        Row: {
          category: string | null
          deleted_at: string
          display_name: string
          id: string
          item_key: string
          quantity: string | null
          source: string
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          deleted_at?: string
          display_name: string
          id?: string
          item_key: string
          quantity?: string | null
          source?: string
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          deleted_at?: string
          display_name?: string
          id?: string
          item_key?: string
          quantity?: string | null
          source?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_checked: boolean
          name: string
          quantity: string
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          name: string
          quantity?: string
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          name?: string
          quantity?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grocery_overrides: {
        Row: {
          category: string | null
          created_at: string
          id: string
          item_key: string
          quantity: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          item_key: string
          quantity?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          item_key?: string
          quantity?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_deletions: {
        Row: {
          category: string | null
          deleted_at: string
          id: string
          item_name: string
          notes: string | null
          price_per_unit: number | null
          quantity: number
          reason: string
          total_cost: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          deleted_at?: string
          id?: string
          item_name: string
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number
          reason: string
          total_cost?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          deleted_at?: string
          id?: string
          item_name?: string
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number
          reason?: string
          total_cost?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          expiration_date: string | null
          id: string
          name: string
          notes: string | null
          price_per_unit: number | null
          quantity: number
          storage_location: Database["public"]["Enums"]["storage_location"]
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          name: string
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number
          storage_location?: Database["public"]["Enums"]["storage_location"]
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number
          storage_location?: Database["public"]["Enums"]["storage_location"]
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          date: string
          id: string
          meal_slot: string
          notes: string | null
          recipe_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          meal_slot: string
          notes?: string | null
          recipe_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          meal_slot?: string
          notes?: string | null
          recipe_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          breakfast_time: string | null
          calendar_token: string
          created_at: string
          diet_restrictions: string[] | null
          dinner_time: string | null
          display_name: string | null
          email: string | null
          id: string
          lunch_time: string | null
          snack_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          breakfast_time?: string | null
          calendar_token?: string
          created_at?: string
          diet_restrictions?: string[] | null
          dinner_time?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          lunch_time?: string | null
          snack_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          breakfast_time?: string | null
          calendar_token?: string
          created_at?: string
          diet_restrictions?: string[] | null
          dinner_time?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          lunch_time?: string | null
          snack_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          added_to_inventory: boolean
          category: string | null
          created_at: string
          id: string
          name: string
          price: number
          quantity: number
          receipt_id: string
          unit: string | null
          user_id: string
        }
        Insert: {
          added_to_inventory?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name: string
          price?: number
          quantity?: number
          receipt_id: string
          unit?: string | null
          user_id: string
        }
        Update: {
          added_to_inventory?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          quantity?: number
          receipt_id?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipt_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_scans: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          notes: string | null
          receipt_date: string
          store_name: string | null
          total_amount: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          receipt_date?: string
          store_name?: string | null
          total_amount?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          receipt_date?: string
          store_name?: string | null
          total_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          category: string | null
          cook_time: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ingredients: Json
          instructions: Json
          is_ai_generated: boolean | null
          prep_time: number | null
          rating: number | null
          servings: number | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cook_time?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          is_ai_generated?: boolean | null
          prep_time?: number | null
          rating?: number | null
          servings?: number | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cook_time?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          instructions?: Json
          is_ai_generated?: boolean | null
          prep_time?: number | null
          rating?: number | null
          servings?: number | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          next_billing_date: string | null
          payment_method: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_monthly: number
          recipe_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          next_billing_date?: string | null
          payment_method?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          recipe_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          next_billing_date?: string | null
          payment_method?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          recipe_limit?: number
          updated_at?: string
          user_id?: string
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
      storage_location:
        | "fridge"
        | "freezer"
        | "pantry"
        | "cabinet"
        | "counter"
        | "other"
      subscription_plan: "free" | "basic" | "pro" | "unlimited"
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
      storage_location: [
        "fridge",
        "freezer",
        "pantry",
        "cabinet",
        "counter",
        "other",
      ],
      subscription_plan: ["free", "basic", "pro", "unlimited"],
    },
  },
} as const

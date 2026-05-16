export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          created_at: string
          description: string | null
          fal_request_id: string | null
          gen_status: string
          generated_portrait_url: string | null
          id: string
          name: string
          project_id: string
          reference_image_url: string | null
          role: string | null
          visual_traits: Json
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          fal_request_id?: string | null
          gen_status?: string
          generated_portrait_url?: string | null
          id?: string
          name: string
          project_id: string
          reference_image_url?: string | null
          role?: string | null
          visual_traits?: Json
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          fal_request_id?: string | null
          gen_status?: string
          generated_portrait_url?: string | null
          id?: string
          name?: string
          project_id?: string
          reference_image_url?: string | null
          role?: string | null
          visual_traits?: Json
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_characters: {
        Row: {
          character_id: string
          event_id: string
        }
        Insert: {
          character_id: string
          event_id: string
        }
        Update: {
          character_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_characters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          event_ids: string[]
          id: string
          output_url: string | null
          project_id: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          event_ids?: string[]
          id?: string
          output_url?: string | null
          project_id: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          event_ids?: string[]
          id?: string
          output_url?: string | null
          project_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pins: {
        Row: {
          canvas_x: number
          canvas_y: number
          created_at: string
          description: string | null
          fal_request_id: string | null
          gen_status: string
          generated_image_url: string | null
          id: string
          label: string
          project_id: string
        }
        Insert: {
          canvas_x: number
          canvas_y: number
          created_at?: string
          description?: string | null
          fal_request_id?: string | null
          gen_status?: string
          generated_image_url?: string | null
          id?: string
          label: string
          project_id: string
        }
        Update: {
          canvas_x?: number
          canvas_y?: number
          created_at?: string
          description?: string | null
          fal_request_id?: string | null
          gen_status?: string
          generated_image_url?: string | null
          id?: string
          label?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          aesthetic_style: string
          canvas_state: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          style_config: Json
          theme: string
          updated_at: string
        }
        Insert: {
          aesthetic_style: string
          canvas_state?: Json
          created_at?: string
          id?: string
          name: string
          owner_id: string
          style_config?: Json
          theme: string
          updated_at?: string
        }
        Update: {
          aesthetic_style?: string
          canvas_state?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          style_config?: Json
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_logs: {
        Row: {
          action_taken: boolean | null
          created_at: string
          id: string
          project_id: string
          query: string
          response: string
          revert_reference_id: string | null
        }
        Insert: {
          action_taken?: boolean | null
          created_at?: string
          id?: string
          project_id: string
          query: string
          response: string
          revert_reference_id?: string | null
        }
        Update: {
          action_taken?: boolean | null
          created_at?: string
          id?: string
          project_id?: string
          query?: string
          response?: string
          revert_reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_pending_changes: {
        Row: {
          change_type: string
          created_at: string
          id: string
          payload: Json
          project_id: string
          status: string
        }
        Insert: {
          change_type: string
          created_at?: string
          id?: string
          payload?: Json
          project_id: string
          status?: string
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_pending_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_snapshots: {
        Row: {
          change_description: string | null
          created_at: string
          id: string
          project_id: string
          state_blob: Json
        }
        Insert: {
          change_description?: string | null
          created_at?: string
          id?: string
          project_id: string
          state_blob?: Json
        }
        Update: {
          change_description?: string | null
          created_at?: string
          id?: string
          project_id?: string
          state_blob?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          audio_summary: string | null
          audio_url: string | null
          created_at: string
          description: string | null
          fal_request_id: string | null
          gen_status: string
          generated_image_url: string | null
          id: string
          in_world_time: string | null
          is_ghost: boolean
          pin_id: string | null
          project_id: string
          sequence_order: number
          title: string
        }
        Insert: {
          audio_summary?: string | null
          audio_url?: string | null
          created_at?: string
          description?: string | null
          fal_request_id?: string | null
          gen_status?: string
          generated_image_url?: string | null
          id?: string
          in_world_time?: string | null
          is_ghost?: boolean
          pin_id?: string | null
          project_id: string
          sequence_order: number
          title: string
        }
        Update: {
          audio_summary?: string | null
          audio_url?: string | null
          created_at?: string
          description?: string | null
          fal_request_id?: string | null
          gen_status?: string
          generated_image_url?: string | null
          id?: string
          in_world_time?: string | null
          is_ghost?: boolean
          pin_id?: string | null
          project_id?: string
          sequence_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "location_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_member: {
        Args: { proj_id: string }
        Returns: boolean
      }
      storage_project_id: { Args: { object_name: string }; Returns: string }
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const

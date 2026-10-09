// Generated from the local stack: `npm run gen:types`. Do not edit by hand; regenerate after a migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          at: string
          details: NonNullable<Json>
          id: number
          raffle_id: string | null
          reason: string | null
          target_id: string | null
          target_label: string | null
          target_type: string
        }
        ComputedFields: never
        Insert: {
          action: string
          at?: string
          details?: NonNullable<Json>
          id?: never
          raffle_id?: string | null
          reason?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type: string
        }
        Update: {
          action?: string
          at?: string
          details?: NonNullable<Json>
          id?: never
          raffle_id?: string | null
          reason?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      draw_snapshot_entries: {
        Row: {
          eligible: boolean
          email: string
          email_normalized: string
          entry_id: string
          excluding_winner_id: string | null
          excluding_won_at: string | null
          flags: Database['public']['Enums']['flag_rule'][]
          full_name: string
          override_id: string | null
          override_reason: string | null
          raffle_id: string
          reason: Database['public']['Enums']['verdict_reason']
        }
        ComputedFields: never
        Insert: {
          eligible: boolean
          email: string
          email_normalized: string
          entry_id: string
          excluding_winner_id?: string | null
          excluding_won_at?: string | null
          flags?: Database['public']['Enums']['flag_rule'][]
          full_name: string
          override_id?: string | null
          override_reason?: string | null
          raffle_id: string
          reason: Database['public']['Enums']['verdict_reason']
        }
        Update: {
          eligible?: boolean
          email?: string
          email_normalized?: string
          entry_id?: string
          excluding_winner_id?: string | null
          excluding_won_at?: string | null
          flags?: Database['public']['Enums']['flag_rule'][]
          full_name?: string
          override_id?: string | null
          override_reason?: string | null
          raffle_id?: string
          reason?: Database['public']['Enums']['verdict_reason']
        }
        Relationships: [
          {
            foreignKeyName: 'draw_snapshot_entries_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'draw_snapshot_entries_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'draw_snapshots'
            referencedColumns: ['raffle_id']
          },
        ]
      }
      draw_snapshots: {
        Row: {
          drawn_at: string
          eligible_count: number
          excluded_count: number
          flagged_count: number
          raffle_id: string
          winner_count: number
        }
        ComputedFields: never
        Insert: {
          drawn_at: string
          eligible_count: number
          excluded_count: number
          flagged_count: number
          raffle_id: string
          winner_count: number
        }
        Update: {
          drawn_at?: string
          eligible_count?: number
          excluded_count?: number
          flagged_count?: number
          raffle_id?: string
          winner_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'draw_snapshots_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: true
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      eligibility_overrides: {
        Row: {
          cleared_at: string | null
          cleared_reason: string | null
          created_at: string
          email: string
          email_normalized: string | null
          expires_at: string | null
          id: string
          kind: Database['public']['Enums']['override_kind']
          reason: string
        }
        ComputedFields: never
        Insert: {
          cleared_at?: string | null
          cleared_reason?: string | null
          created_at?: string
          email: string
          email_normalized?: never
          expires_at?: string | null
          id?: string
          kind: Database['public']['Enums']['override_kind']
          reason: string
        }
        Update: {
          cleared_at?: string | null
          cleared_reason?: string | null
          created_at?: string
          email?: string
          email_normalized?: never
          expires_at?: string | null
          id?: string
          kind?: Database['public']['Enums']['override_kind']
          reason?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          added_by_admin: boolean
          created_at: string
          device_id: string | null
          email: string
          email_normalized: string | null
          full_name: string
          id: string
          raffle_id: string
          removed_at: string | null
          removed_reason: string | null
        }
        ComputedFields: never
        Insert: {
          added_by_admin?: boolean
          created_at?: string
          device_id?: string | null
          email: string
          email_normalized?: never
          full_name: string
          id?: string
          raffle_id: string
          removed_at?: string | null
          removed_reason?: string | null
        }
        Update: {
          added_by_admin?: boolean
          created_at?: string
          device_id?: string | null
          email?: string
          email_normalized?: never
          full_name?: string
          id?: string
          raffle_id?: string
          removed_at?: string | null
          removed_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'entries_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      flag_dismissals: {
        Row: {
          created_at: string
          entry_a: string
          entry_b: string
          id: string
          raffle_id: string
          reason: string
          rule: Database['public']['Enums']['flag_rule']
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          entry_a: string
          entry_b: string
          id?: string
          raffle_id: string
          reason: string
          rule: Database['public']['Enums']['flag_rule']
        }
        Update: {
          created_at?: string
          entry_a?: string
          entry_b?: string
          id?: string
          raffle_id?: string
          reason?: string
          rule?: Database['public']['Enums']['flag_rule']
        }
        Relationships: [
          {
            foreignKeyName: 'flag_dismissals_entry_a_fkey'
            columns: ['entry_a']
            isOneToOne: false
            referencedRelation: 'entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'flag_dismissals_entry_b_fkey'
            columns: ['entry_b']
            isOneToOne: false
            referencedRelation: 'entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'flag_dismissals_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
        ]
      }
      raffles: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          close_time: string
          created_at: string
          details: string | null
          drawn_at: string | null
          exclusion_enabled: boolean
          exclusion_months: number
          id: string
          prize: string | null
          state: Database['public']['Enums']['raffle_state']
          title: string
          winner_count: number
          status: string | null
        }
        ComputedFields: 'status'
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          close_time: string
          created_at?: string
          details?: string | null
          drawn_at?: string | null
          exclusion_enabled?: boolean
          exclusion_months?: number
          id?: string
          prize?: string | null
          state?: Database['public']['Enums']['raffle_state']
          title: string
          winner_count?: number
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          close_time?: string
          created_at?: string
          details?: string | null
          drawn_at?: string | null
          exclusion_enabled?: boolean
          exclusion_months?: number
          id?: string
          prize?: string | null
          state?: Database['public']['Enums']['raffle_state']
          title?: string
          winner_count?: number
        }
        Relationships: []
      }
      winners: {
        Row: {
          created_at: string
          email: string
          email_normalized: string | null
          entry_id: string | null
          full_name: string
          id: string
          note: string | null
          position: number | null
          raffle_id: string | null
          replaced_at: string | null
          replaced_reason: string | null
          replaces_winner_id: string | null
          source: Database['public']['Enums']['winner_source']
          status: Database['public']['Enums']['winner_status']
          won_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email: string
          email_normalized?: never
          entry_id?: string | null
          full_name: string
          id?: string
          note?: string | null
          position?: number | null
          raffle_id?: string | null
          replaced_at?: string | null
          replaced_reason?: string | null
          replaces_winner_id?: string | null
          source: Database['public']['Enums']['winner_source']
          status?: Database['public']['Enums']['winner_status']
          won_at: string
        }
        Update: {
          created_at?: string
          email?: string
          email_normalized?: never
          entry_id?: string | null
          full_name?: string
          id?: string
          note?: string | null
          position?: number | null
          raffle_id?: string | null
          replaced_at?: string | null
          replaced_reason?: string | null
          replaces_winner_id?: string | null
          source?: Database['public']['Enums']['winner_source']
          status?: Database['public']['Enums']['winner_status']
          won_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'winners_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'winners_raffle_id_fkey'
            columns: ['raffle_id']
            isOneToOne: false
            referencedRelation: 'raffles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'winners_replaces_winner_id_fkey'
            columns: ['replaces_winner_id']
            isOneToOne: false
            referencedRelation: 'winners'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_entry: {
        Args: { p_email: string; p_full_name: string; p_raffle_id: string }
        Returns: string
      }
      add_past_winner: {
        Args: { p_email: string; p_full_name: string; p_note?: string; p_won_at: string }
        Returns: string
      }
      admin_entries: {
        Args: { p_raffle_id: string }
        Returns: {
          added_by_admin: boolean
          created_at: string
          device_id: string
          eligible: boolean
          email: string
          email_normalized: string
          excluding_won_at: string
          flags: Database['public']['Enums']['flag_rule'][]
          full_name: string
          id: string
          is_returning: boolean
          override_reason: string
          raffle_id: string
          reason: Database['public']['Enums']['verdict_reason']
          removed_at: string
          removed_reason: string
          status_source: string
        }[]
      }
      admin_entry_flags: {
        Args: { p_raffle_id: string }
        Returns: {
          dismissed: boolean
          entry_id: string
          other_entry_id: string
          other_full_name: string
          other_removed: boolean
          rule: Database['public']['Enums']['flag_rule']
        }[]
      }
      alternates_remaining: { Args: { p_raffle_id: string }; Returns: number }
      cancel_raffle: { Args: { p_raffle_id: string; p_reason: string }; Returns: undefined }
      clear_override: { Args: { p_override_id: string; p_reason: string }; Returns: undefined }
      close_raffle_early: { Args: { p_raffle_id: string }; Returns: undefined }
      create_raffle: {
        Args: {
          p_close_time: string
          p_details?: string
          p_exclusion_enabled?: boolean
          p_exclusion_months?: number
          p_prize?: string
          p_title: string
          p_winner_count?: number
        }
        Returns: string
      }
      delete_past_winner: { Args: { p_reason?: string; p_winner_id: string }; Returns: undefined }
      dismiss_flag: {
        Args: {
          p_entry_a: string
          p_entry_b: string
          p_raffle_id: string
          p_reason: string
          p_rule: Database['public']['Enums']['flag_rule']
        }
        Returns: string
      }
      draw: {
        Args: { p_raffle_id: string }
        Returns: {
          created_at: string
          email: string
          email_normalized: string | null
          entry_id: string | null
          full_name: string
          id: string
          note: string | null
          position: number | null
          raffle_id: string | null
          replaced_at: string | null
          replaced_reason: string | null
          replaces_winner_id: string | null
          source: Database['public']['Enums']['winner_source']
          status: Database['public']['Enums']['winner_status']
          won_at: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'winners'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      keepalive: { Args: Record<PropertyKey, never>; Returns: string }
      public_raffle_state: {
        Args: Record<PropertyKey, never>
        Returns: {
          close_time: string
          details: string
          prize: string
          raffle_id: string
          status: string
          title: string
          winner_names: string[]
        }[]
      }
      raffle_slots: {
        Args: { p_raffle_id: string }
        Returns: {
          email: string
          full_name: string
          position: number
          source: Database['public']['Enums']['winner_source']
          vacant: boolean
          winner_id: string
          won_at: string
        }[]
      }
      redraw: {
        Args: { p_reason: string; p_winner_id: string }
        Returns: {
          new_winner_id: string
          position: number
          replaced_winner_id: string
          vacant: boolean
        }[]
      }
      remove_entry: { Args: { p_entry_id: string; p_reason: string }; Returns: undefined }
      restore_entry: { Args: { p_entry_id: string; p_reason?: string }; Returns: undefined }
      set_override: {
        Args: {
          p_email: string
          p_expires_at?: string
          p_kind: Database['public']['Enums']['override_kind']
          p_reason: string
        }
        Returns: string
      }
      status: {
        Args: {
          r: Omit<
            Database['public']['Tables']['raffles']['Row'],
            Database['public']['Tables']['raffles']['ComputedFields']
          >
        }
        Returns: string
      }
      update_raffle: {
        Args: {
          p_close_time: string
          p_details: string
          p_exclusion_enabled: boolean
          p_exclusion_months: number
          p_prize: string
          p_raffle_id: string
          p_title: string
          p_winner_count: number
        }
        Returns: undefined
      }
    }
    Enums: {
      flag_rule: 'same_name' | 'email_match' | 'same_device'
      override_kind: 'force_eligible' | 'force_excluded'
      raffle_state: 'open' | 'drawn' | 'cancelled'
      verdict_reason:
        | 'eligible'
        | 'override_eligible'
        | 'override_excluded'
        | 'exclusion_window'
        | 'removed'
      winner_source: 'draw' | 'redraw' | 'past'
      winner_status: 'standing' | 'replaced'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      flag_rule: ['same_name', 'email_match', 'same_device'],
      override_kind: ['force_eligible', 'force_excluded'],
      raffle_state: ['open', 'drawn', 'cancelled'],
      verdict_reason: [
        'eligible',
        'override_eligible',
        'override_excluded',
        'exclusion_window',
        'removed',
      ],
      winner_source: ['draw', 'redraw', 'past'],
      winner_status: ['standing', 'replaced'],
    },
  },
} as const

/**
 * Tipos de la base de datos.
 *
 * Espejan exactamente las migraciones de supabase/migrations. Cuando haya un
 * proyecto de Supabase, se regeneran con `pnpm db:types` y este archivo pasa a
 * ser generado; hasta entonces se mantiene a mano para que todo el código esté
 * tipado desde el primer día.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["app_role"];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      audit_logs: {
        Row: {
          id: number;
          actor_type: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          actor_type?: string;
          actor_user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      integrations: {
        Row: {
          id: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          status: Database["public"]["Enums"]["integration_status"];
          connected_by: string | null;
          connected_at: string | null;
          disconnected_at: string | null;
          last_sync_at: string | null;
          last_webhook_at: string | null;
          last_error: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          status?: Database["public"]["Enums"]["integration_status"];
          connected_by?: string | null;
          connected_at?: string | null;
          disconnected_at?: string | null;
          last_sync_at?: string | null;
          last_webhook_at?: string | null;
          last_error?: string | null;
          settings?: Json;
        };
        Update: {
          status?: Database["public"]["Enums"]["integration_status"];
          connected_by?: string | null;
          connected_at?: string | null;
          disconnected_at?: string | null;
          last_sync_at?: string | null;
          last_webhook_at?: string | null;
          last_error?: string | null;
          settings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "integrations_connected_by_fkey";
            columns: ["connected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      mercadolibre_accounts: {
        Row: {
          id: string;
          integration_id: string;
          ml_user_id: number;
          nickname: string;
          site_id: string;
          email: string | null;
          permalink: string | null;
          raw: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          integration_id: string;
          ml_user_id: number;
          nickname: string;
          site_id?: string;
          email?: string | null;
          permalink?: string | null;
          raw?: Json;
        };
        Update: {
          nickname?: string;
          site_id?: string;
          email?: string | null;
          permalink?: string | null;
          raw?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "mercadolibre_accounts_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: true;
            referencedRelation: "integrations";
            referencedColumns: ["id"];
          },
        ];
      };

      mercadolibre_tokens: {
        Row: {
          account_id: string;
          access_token_enc: string;
          refresh_token_enc: string;
          access_token_expires_at: string;
          scope: string | null;
          refreshed_at: string | null;
          refresh_lock_until: string | null;
          refresh_failures: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          access_token_enc: string;
          refresh_token_enc: string;
          access_token_expires_at: string;
          scope?: string | null;
          refreshed_at?: string | null;
          refresh_lock_until?: string | null;
          refresh_failures?: number;
        };
        Update: {
          access_token_enc?: string;
          refresh_token_enc?: string;
          access_token_expires_at?: string;
          scope?: string | null;
          refreshed_at?: string | null;
          refresh_lock_until?: string | null;
          refresh_failures?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mercadolibre_tokens_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: true;
            referencedRelation: "mercadolibre_accounts";
            referencedColumns: ["id"];
          },
        ];
      };

      mercadolibre_items: {
        Row: {
          ml_item_id: string;
          account_id: string;
          title: string;
          thumbnail_url: string | null;
          permalink: string | null;
          price: number | null;
          currency_id: string | null;
          available_quantity: number | null;
          status: string | null;
          raw: Json;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          ml_item_id: string;
          account_id: string;
          title: string;
          thumbnail_url?: string | null;
          permalink?: string | null;
          price?: number | null;
          currency_id?: string | null;
          available_quantity?: number | null;
          status?: string | null;
          raw?: Json;
          synced_at?: string;
        };
        Update: {
          title?: string;
          thumbnail_url?: string | null;
          permalink?: string | null;
          price?: number | null;
          currency_id?: string | null;
          available_quantity?: number | null;
          status?: string | null;
          raw?: Json;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mercadolibre_items_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "mercadolibre_accounts";
            referencedColumns: ["id"];
          },
        ];
      };

      questions: {
        Row: {
          id: string;
          account_id: string;
          ml_question_id: number;
          ml_item_id: string;
          ml_seller_id: number;
          ml_buyer_id: number | null;
          text: string;
          status: Database["public"]["Enums"]["question_status"];
          ml_status: string;
          ml_date_created: string;
          answer_text: string | null;
          answered_at: string | null;
          answered_by: string | null;
          answer_source: Database["public"]["Enums"]["answer_source"] | null;
          last_error: string | null;
          raw: Json;
          last_synced_at: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          ml_question_id: number;
          ml_item_id: string;
          ml_seller_id: number;
          ml_buyer_id?: number | null;
          text: string;
          status?: Database["public"]["Enums"]["question_status"];
          ml_status: string;
          ml_date_created: string;
          answer_text?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          answer_source?: Database["public"]["Enums"]["answer_source"] | null;
          last_error?: string | null;
          raw?: Json;
          last_synced_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          text?: string;
          status?: Database["public"]["Enums"]["question_status"];
          ml_status?: string;
          answer_text?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          answer_source?: Database["public"]["Enums"]["answer_source"] | null;
          last_error?: string | null;
          raw?: Json;
          last_synced_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "mercadolibre_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_ml_item_id_fkey";
            columns: ["ml_item_id"];
            isOneToOne: false;
            referencedRelation: "mercadolibre_items";
            referencedColumns: ["ml_item_id"];
          },
          {
            foreignKeyName: "questions_answered_by_fkey";
            columns: ["answered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      question_answers: {
        Row: {
          id: string;
          question_id: string;
          text: string;
          status: Database["public"]["Enums"]["answer_status"];
          source: Database["public"]["Enums"]["answer_source"];
          sent_by: string | null;
          sent_at: string | null;
          ml_response: Json | null;
          error_code: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          text: string;
          status: Database["public"]["Enums"]["answer_status"];
          source?: Database["public"]["Enums"]["answer_source"];
          sent_by?: string | null;
          sent_at?: string | null;
          ml_response?: Json | null;
          error_code?: string | null;
          error_message?: string | null;
        };
        Update: {
          status?: Database["public"]["Enums"]["answer_status"];
          sent_at?: string | null;
          ml_response?: Json | null;
          error_code?: string | null;
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_answers_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      webhook_events: {
        Row: {
          id: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          external_id: string;
          topic: string;
          resource: string;
          ml_user_id: number | null;
          application_id: number | null;
          ml_attempts: number | null;
          sent_at: string | null;
          received_at: string;
          payload: Json;
          status: Database["public"]["Enums"]["webhook_event_status"];
          process_attempts: number;
          next_retry_at: string | null;
          processed_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: Database["public"]["Enums"]["integration_provider"];
          external_id: string;
          topic: string;
          resource: string;
          ml_user_id?: number | null;
          application_id?: number | null;
          ml_attempts?: number | null;
          sent_at?: string | null;
          received_at?: string;
          payload: Json;
          status?: Database["public"]["Enums"]["webhook_event_status"];
          process_attempts?: number;
          next_retry_at?: string | null;
          processed_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          status?: Database["public"]["Enums"]["webhook_event_status"];
          process_attempts?: number;
          next_retry_at?: string | null;
          processed_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
    };

    Views: Record<never, never>;

    Functions: {
      question_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: {
          pending_count: number;
          pending_over_24h_count: number;
          answered_today_count: number;
          answered_7d_count: number;
          avg_response_minutes_7d: number | null;
          oldest_pending_at: string | null;
        }[];
      };
      mark_question_answered: {
        Args: { p_answer_id: string; p_ml_response?: Json };
        Returns: undefined;
      };
      mark_answer_failed: {
        Args: { p_answer_id: string; p_error_code: string; p_error_message: string };
        Returns: undefined;
      };
      register_token_refresh_failure: {
        Args: { p_account_id: string; p_max_failures?: number; p_auth_problem?: boolean };
        Returns: number;
      };
    };

    Enums: {
      app_role: "admin" | "operator" | "viewer";
      integration_provider: "mercadolibre";
      integration_status: "connected" | "needs_reauth" | "disconnected" | "error";
      question_status: "pending" | "answered" | "archived";
      answer_status: "sending" | "sent" | "failed";
      answer_source: "pana" | "external";
      webhook_event_status: "received" | "processing" | "processed" | "failed" | "ignored";
    };

    CompositeTypes: Record<never, never>;
  };
};

/* ------------------------------------------------------------------ atajos */

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

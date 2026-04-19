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
      addresses: {
        Row: {
          address_line2: string | null
          address_type: string
          city: string
          company_id: string | null
          country: string
          county: string
          created_at: string | null
          eircode: string | null
          id: string
          is_active: boolean | null
          location_id: string | null
          street_address: string
          updated_at: string | null
        }
        Insert: {
          address_line2?: string | null
          address_type?: string
          city: string
          company_id?: string | null
          country?: string
          county: string
          created_at?: string | null
          eircode?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          street_address: string
          updated_at?: string | null
        }
        Update: {
          address_line2?: string | null
          address_type?: string
          city?: string
          company_id?: string | null
          country?: string
          county?: string
          created_at?: string | null
          eircode?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          street_address?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          brand_id: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      company_supplier_settings: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          special_pricing_enabled: boolean
          supplier_id: string
          threshold_percentage: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          special_pricing_enabled?: boolean
          supplier_id: string
          threshold_percentage?: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          special_pricing_enabled?: boolean
          supplier_id?: string
          threshold_percentage?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_supplier_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_supplier_settings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      location_supplier_credentials: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_error_message: string | null
          last_login_at: string | null
          last_login_status: string | null
          location_id: string
          login_url: string | null
          password_secret_id: string
          supplier_id: string
          updated_at: string | null
          username: string
          website_url: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error_message?: string | null
          last_login_at?: string | null
          last_login_status?: string | null
          location_id: string
          login_url?: string | null
          password_secret_id: string
          supplier_id: string
          updated_at?: string | null
          username: string
          website_url?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error_message?: string | null
          last_login_at?: string | null
          last_login_status?: string | null
          location_id?: string
          login_url?: string | null
          password_secret_id?: string
          supplier_id?: string
          updated_at?: string | null
          username?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_supplier_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_supplier_credentials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_supplier_credentials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          location_number: number
          location_type: string
          manager_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_number: number
          location_type: string
          manager_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_number?: number
          location_type?: string
          manager_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_locations_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      master_products: {
        Row: {
          account: string | null
          article_code: string
          brand_id: string
          created_at: string | null
          description: string
          ean_code: string
          ean_history: Json | null
          id: string
          is_active: boolean | null
          unit_size: string | null
          updated_at: string | null
        }
        Insert: {
          account?: string | null
          article_code: string
          brand_id: string
          created_at?: string | null
          description: string
          ean_code: string
          ean_history?: Json | null
          id?: string
          is_active?: boolean | null
          unit_size?: string | null
          updated_at?: string | null
        }
        Update: {
          account?: string | null
          article_code?: string
          brand_id?: string
          created_at?: string | null
          description?: string
          ean_code?: string
          ean_history?: Json | null
          id?: string
          is_active?: boolean | null
          unit_size?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          baseline_unit_price: number | null
          created_at: string | null
          id: string
          master_product_id: string
          order_id: string
          override_reason: string | null
          quantity: number
          supplier_product_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          baseline_unit_price?: number | null
          created_at?: string | null
          id?: string
          master_product_id: string
          order_id: string
          override_reason?: string | null
          quantity: number
          supplier_product_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          baseline_unit_price?: number | null
          created_at?: string | null
          id?: string
          master_product_id?: string
          order_id?: string
          override_reason?: string | null
          quantity?: number
          supplier_product_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          location_id: string
          notes: string | null
          order_date: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          location_id: string
          notes?: string | null
          order_date: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          location_id?: string
          notes?: string | null
          order_date?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_calculations: {
        Row: {
          baseline_price: number
          best_external_price: number | null
          best_external_supplier_id: string | null
          calculation_date: string | null
          chosen_price: number
          chosen_supplier_id: string
          company_id: string
          delta_vs_baseline: number | null
          id: string
          is_saving: boolean | null
          order_item_id: string
          savings_percentage: number | null
        }
        Insert: {
          baseline_price: number
          best_external_price?: number | null
          best_external_supplier_id?: string | null
          calculation_date?: string | null
          chosen_price: number
          chosen_supplier_id: string
          company_id: string
          delta_vs_baseline?: number | null
          id?: string
          is_saving?: boolean | null
          order_item_id: string
          savings_percentage?: number | null
        }
        Update: {
          baseline_price?: number
          best_external_price?: number | null
          best_external_supplier_id?: string | null
          calculation_date?: string | null
          chosen_price?: number
          chosen_supplier_id?: string
          company_id?: string
          delta_vs_baseline?: number | null
          id?: string
          is_saving?: boolean | null
          order_item_id?: string
          savings_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_calculations_best_external_supplier_id_fkey"
            columns: ["best_external_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_calculations_chosen_supplier_id_fkey"
            columns: ["chosen_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_calculations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_calculations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ssrs_scrape_runs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          current_rows_merged: number
          id: string
          raw_rows_inserted: number
          source_job_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          current_rows_merged?: number
          id?: string
          raw_rows_inserted?: number
          source_job_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          current_rows_merged?: number
          id?: string
          raw_rows_inserted?: number
          source_job_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ssrs_scrape_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ssrs_store_product_rows: {
        Row: {
          article_linking: string | null
          case_qty: string | null
          commodity_code: string | null
          commodity_name: string | null
          company_id: string
          cost_price: number | null
          created_at: string
          delisted: string | null
          department_code: string | null
          department_name: string | null
          description: string
          drs: string | null
          ean_plu: string
          family_code: string | null
          family_name: string | null
          id: string
          location_id: string | null
          lu: string | null
          lv: string | null
          margin_percent: string | null
          must_stock: string | null
          page_number: number
          root_article_code: string
          row_index: number
          run_id: string
          scraped_at: string
          size: string | null
          store_name: string
          store_number: string
          store_selling_price: number | null
          subdepartment_code: string | null
          subdepartment_name: string | null
          supplier: string | null
          sv_code: string | null
          vat: string | null
        }
        Insert: {
          article_linking?: string | null
          case_qty?: string | null
          commodity_code?: string | null
          commodity_name?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string
          delisted?: string | null
          department_code?: string | null
          department_name?: string | null
          description: string
          drs?: string | null
          ean_plu: string
          family_code?: string | null
          family_name?: string | null
          id?: string
          location_id?: string | null
          lu?: string | null
          lv?: string | null
          margin_percent?: string | null
          must_stock?: string | null
          page_number: number
          root_article_code: string
          row_index: number
          run_id: string
          scraped_at?: string
          size?: string | null
          store_name: string
          store_number: string
          store_selling_price?: number | null
          subdepartment_code?: string | null
          subdepartment_name?: string | null
          supplier?: string | null
          sv_code?: string | null
          vat?: string | null
        }
        Update: {
          article_linking?: string | null
          case_qty?: string | null
          commodity_code?: string | null
          commodity_name?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string
          delisted?: string | null
          department_code?: string | null
          department_name?: string | null
          description?: string
          drs?: string | null
          ean_plu?: string
          family_code?: string | null
          family_name?: string | null
          id?: string
          location_id?: string | null
          lu?: string | null
          lv?: string | null
          margin_percent?: string | null
          must_stock?: string | null
          page_number?: number
          root_article_code?: string
          row_index?: number
          run_id?: string
          scraped_at?: string
          size?: string | null
          store_name?: string
          store_number?: string
          store_selling_price?: number | null
          subdepartment_code?: string | null
          subdepartment_name?: string | null
          supplier?: string | null
          sv_code?: string | null
          vat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssrs_store_product_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssrs_store_product_rows_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssrs_store_product_rows_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ssrs_scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ssrs_store_products: {
        Row: {
          article_linking: string | null
          case_qty: string | null
          commodity_code: string | null
          commodity_name: string | null
          company_id: string
          cost_price: number | null
          created_at: string
          delisted: string | null
          department_code: string | null
          department_name: string | null
          description: string
          drs: string | null
          ean_plu: string
          family_code: string | null
          family_name: string | null
          id: string
          location_id: string | null
          lu: string | null
          lv: string | null
          margin_percent: string | null
          must_stock: string | null
          report_page: number | null
          root_article_code: string
          run_id: string
          scraped_at: string
          size: string | null
          store_name: string
          store_number: string
          store_selling_price: number | null
          subdepartment_code: string | null
          subdepartment_name: string | null
          supplier: string | null
          sv_code: string | null
          updated_at: string
          vat: string | null
        }
        Insert: {
          article_linking?: string | null
          case_qty?: string | null
          commodity_code?: string | null
          commodity_name?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string
          delisted?: string | null
          department_code?: string | null
          department_name?: string | null
          description: string
          drs?: string | null
          ean_plu: string
          family_code?: string | null
          family_name?: string | null
          id?: string
          location_id?: string | null
          lu?: string | null
          lv?: string | null
          margin_percent?: string | null
          must_stock?: string | null
          report_page?: number | null
          root_article_code: string
          run_id: string
          scraped_at?: string
          size?: string | null
          store_name: string
          store_number: string
          store_selling_price?: number | null
          subdepartment_code?: string | null
          subdepartment_name?: string | null
          supplier?: string | null
          sv_code?: string | null
          updated_at?: string
          vat?: string | null
        }
        Update: {
          article_linking?: string | null
          case_qty?: string | null
          commodity_code?: string | null
          commodity_name?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string
          delisted?: string | null
          department_code?: string | null
          department_name?: string | null
          description?: string
          drs?: string | null
          ean_plu?: string
          family_code?: string | null
          family_name?: string | null
          id?: string
          location_id?: string | null
          lu?: string | null
          lv?: string | null
          margin_percent?: string | null
          must_stock?: string | null
          report_page?: number | null
          root_article_code?: string
          run_id?: string
          scraped_at?: string
          size?: string | null
          store_name?: string
          store_number?: string
          store_selling_price?: number | null
          subdepartment_code?: string | null
          subdepartment_name?: string | null
          supplier?: string | null
          sv_code?: string | null
          updated_at?: string
          vat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssrs_store_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssrs_store_products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssrs_store_products_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ssrs_scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_company_prices: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          master_product_id: string
          negotiated_price: number
          notes: string | null
          supplier_id: string
          supplier_product_code: string
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          master_product_id: string
          negotiated_price: number
          notes?: string | null
          supplier_id: string
          supplier_product_code: string
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          master_product_id?: string
          negotiated_price?: number
          notes?: string | null
          supplier_id?: string
          supplier_product_code?: string
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_company_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_company_prices_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_company_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_history: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          new_price: number | null
          old_price: number | null
          supplier_product_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          supplier_product_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          supplier_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_history_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          availability_status: string | null
          current_price: number
          id: string
          internal_product_id: string | null
          last_updated: string | null
          master_product_id: string
          pack_count: number | null
          pack_unit_size: string | null
          scraped_from_company_id: string | null
          supplier_id: string
          supplier_product_code: string | null
          unit_cost_incl_vat: number | null
          vat_rate: number | null
        }
        Insert: {
          availability_status?: string | null
          current_price: number
          id?: string
          internal_product_id?: string | null
          last_updated?: string | null
          master_product_id: string
          pack_count?: number | null
          pack_unit_size?: string | null
          scraped_from_company_id?: string | null
          supplier_id: string
          supplier_product_code?: string | null
          unit_cost_incl_vat?: number | null
          vat_rate?: number | null
        }
        Update: {
          availability_status?: string | null
          current_price?: number
          id?: string
          internal_product_id?: string | null
          last_updated?: string | null
          master_product_id?: string
          pack_count?: number | null
          pack_unit_size?: string | null
          scraped_from_company_id?: string | null
          supplier_id?: string
          supplier_product_code?: string | null
          unit_cost_incl_vat?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_scraped_from_company_id_fkey"
            columns: ["scraped_from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_info: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          contact_info?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          location_id: string | null
          role: string
          theme_mode: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          first_name: string
          id: string
          last_name: string
          location_id?: string | null
          role: string
          theme_mode?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          location_id?: string | null
          role?: string
          theme_mode?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_location_credential: {
        Args: {
          p_company_id: string
          p_location_id: string
          p_login_url?: string
          p_password: string
          p_supplier_id: string
          p_username: string
          p_website_url?: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_location_credential: {
        Args: { p_credential_id: string }
        Returns: undefined
      }
      get_company_accounts: {
        Args: { p_company_id: string }
        Returns: {
          account: string
          product_count: number
        }[]
      }
      get_decrypted_secret: { Args: { secret_id: string }; Returns: string }
      get_order_savings_detail: {
        Args: { p_order_id: string }
        Returns: {
          baseline_price: number
          best_external_price: number
          chosen_price: number
          delta_vs_baseline: number
          is_saving: boolean
          location_name: string
          order_date: string
          order_id: string
          order_item_id: string
          product_description: string
          quantity: number
          savings_percentage: number
        }[]
      }
      get_pricing_comparison: {
        Args: {
          p_company_id: string
          p_include_unavailable?: boolean
          p_limit?: number
          p_product_ids?: string[]
          p_supplier_ids?: string[]
        }
        Returns: {
          article_code: string
          availability_status: string
          catalog_price: number
          description: string
          ean_code: string
          final_price: number
          internal_product_id: string
          is_active: boolean
          is_special_price: boolean
          pack_count: number
          pack_unit_size: string
          product_id: string
          special_price_notes: string
          supplier_id: string
          supplier_name: string
          supplier_product_code: string
          unit_cost_incl_vat: number
          unit_size: string
          valid_until: string
        }[]
      }
      get_savings_by_account: {
        Args: {
          p_account: string
          p_company_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          account: string
          avg_savings_percentage: number
          calculation_count: number
          company_id: string
          company_name: string
          total_products: number
          total_savings: number
        }[]
      }
      get_savings_by_company: {
        Args: {
          p_company_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          avg_savings_percentage: number
          brand: string
          calculation_count: number
          company_id: string
          company_name: string
          date_range_end: string
          date_range_start: string
          net_savings: number
          overspend_count: number
          savings_count: number
          total_overspend_vs_baseline: number
          total_savings_vs_baseline: number
        }[]
      }
      get_savings_by_location: {
        Args: {
          p_end_date?: string
          p_location_id: string
          p_start_date?: string
        }
        Returns: {
          avg_savings_percentage: number
          calculation_count: number
          company_id: string
          company_name: string
          location_id: string
          location_name: string
          location_type: string
          net_savings: number
          overspend_count: number
          savings_count: number
          total_overspend_vs_baseline: number
          total_savings_vs_baseline: number
        }[]
      }
      get_savings_by_location_and_account: {
        Args: {
          p_account: string
          p_end_date?: string
          p_location_id: string
          p_start_date?: string
        }
        Returns: {
          account: string
          avg_savings_percentage: number
          calculation_count: number
          company_name: string
          location_id: string
          location_name: string
          total_savings: number
        }[]
      }
      get_savings_by_supplier: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_supplier_id: string
        }
        Returns: {
          avg_savings_percentage: number
          is_active: boolean
          overspend_count: number
          savings_count: number
          supplier_id: string
          supplier_name: string
          times_chosen: number
          total_delta_vs_baseline: number
          total_order_value: number
        }[]
      }
      get_savings_by_user: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string }
        Returns: {
          avg_savings_percentage: number
          full_name: string
          orders_created: number
          total_order_value: number
          total_savings: number
          user_id: string
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_location_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      merge_ssrs_run_to_current: { Args: { p_run_id: string }; Returns: number }
      update_location_credential: {
        Args: {
          p_credential_id: string
          p_is_active?: boolean
          p_login_url?: string
          p_password?: string
          p_username: string
          p_website_url?: string
        }
        Returns: undefined
      }
      verify_data_counts: {
        Args: never
        Returns: {
          record_count: number
          table_name: string
        }[]
      }
      verify_foreign_keys: {
        Args: never
        Returns: {
          column_name: string
          references_column: string
          references_table: string
          table_name: string
        }[]
      }
      verify_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
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

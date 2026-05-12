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
      _stg_prod_map: {
        Row: {
          aplicacion_id: string | null
          codigo: string
          formula_id: string | null
          is_active: boolean | null
          marca_id: string | null
          uso_id: string | null
          viscosidad_id: string | null
        }
        Insert: {
          aplicacion_id?: string | null
          codigo: string
          formula_id?: string | null
          is_active?: boolean | null
          marca_id?: string | null
          uso_id?: string | null
          viscosidad_id?: string | null
        }
        Update: {
          aplicacion_id?: string | null
          codigo?: string
          formula_id?: string | null
          is_active?: boolean | null
          marca_id?: string | null
          uso_id?: string | null
          viscosidad_id?: string | null
        }
        Relationships: []
      }
      automation_actions: {
        Row: {
          action_config: Json
          action_type: string
          automation_id: string
          created_at: string
          id: string
          position: number
        }
        Insert: {
          action_config?: Json
          action_type: string
          automation_id: string
          created_at?: string
          id?: string
          position?: number
        }
        Update: {
          action_config?: Json
          action_type?: string
          automation_id?: string
          created_at?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          actions_executed: number
          automation_id: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          run_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          actions_executed?: number
          automation_id: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          run_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          actions_executed?: number
          automation_id?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          run_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          entity_type: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          run_count: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          run_count?: number
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          run_count?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_logos: {
        Row: {
          created_at: string | null
          id: string
          key: string
          label: string
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          label: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          label?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cobranza_aplicaciones: {
        Row: {
          creado_por: string | null
          created_at: string
          documento_id: string
          estatus_aplicacion: Database["public"]["Enums"]["estatus_aplicacion_cobranza"]
          fecha_aplicacion: string
          id: string
          monto_aplicado: number
          observaciones: string | null
          origen_aplicacion: string | null
          pago_id: string
          tipo_documento: Database["public"]["Enums"]["tipo_doc_cobranza"]
          updated_at: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          documento_id: string
          estatus_aplicacion?: Database["public"]["Enums"]["estatus_aplicacion_cobranza"]
          fecha_aplicacion?: string
          id?: string
          monto_aplicado: number
          observaciones?: string | null
          origen_aplicacion?: string | null
          pago_id: string
          tipo_documento: Database["public"]["Enums"]["tipo_doc_cobranza"]
          updated_at?: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          documento_id?: string
          estatus_aplicacion?: Database["public"]["Enums"]["estatus_aplicacion_cobranza"]
          fecha_aplicacion?: string
          id?: string
          monto_aplicado?: number
          observaciones?: string | null
          origen_aplicacion?: string | null
          pago_id?: string
          tipo_documento?: Database["public"]["Enums"]["tipo_doc_cobranza"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranza_aplicaciones_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranza_aplicaciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "cobranza_pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranza_pago_archivos: {
        Row: {
          fecha_carga: string
          id: string
          nombre_archivo: string
          pago_id: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga: string | null
        }
        Insert: {
          fecha_carga?: string
          id?: string
          nombre_archivo: string
          pago_id: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga?: string | null
        }
        Update: {
          fecha_carga?: string
          id?: string
          nombre_archivo?: string
          pago_id?: string
          tipo_archivo?: string
          url_archivo?: string
          usuario_carga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranza_pago_archivos_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "cobranza_pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranza_pagos: {
        Row: {
          banco: string | null
          creado_por: string | null
          created_at: string
          empresa_id: string
          empresa_vendedora:
            | Database["public"]["Enums"]["empresa_vendedora"]
            | null
          estado_pago: Database["public"]["Enums"]["estado_pago_cobranza"]
          estatus_pago: Database["public"]["Enums"]["estatus_pago_cobranza"]
          fecha_pago: string
          id: string
          moneda: string
          monto_aplicado: number
          monto_disponible: number
          monto_total: number
          observaciones: string | null
          plaza_id: string | null
          referencia_pago: string | null
          tipo_pago: string | null
          updated_at: string
        }
        Insert: {
          banco?: string | null
          creado_por?: string | null
          created_at?: string
          empresa_id: string
          empresa_vendedora?:
            | Database["public"]["Enums"]["empresa_vendedora"]
            | null
          estado_pago?: Database["public"]["Enums"]["estado_pago_cobranza"]
          estatus_pago?: Database["public"]["Enums"]["estatus_pago_cobranza"]
          fecha_pago?: string
          id?: string
          moneda?: string
          monto_aplicado?: number
          monto_disponible?: number
          monto_total: number
          observaciones?: string | null
          plaza_id?: string | null
          referencia_pago?: string | null
          tipo_pago?: string | null
          updated_at?: string
        }
        Update: {
          banco?: string | null
          creado_por?: string | null
          created_at?: string
          empresa_id?: string
          empresa_vendedora?:
            | Database["public"]["Enums"]["empresa_vendedora"]
            | null
          estado_pago?: Database["public"]["Enums"]["estado_pago_cobranza"]
          estatus_pago?: Database["public"]["Enums"]["estatus_pago_cobranza"]
          fecha_pago?: string
          id?: string
          moneda?: string
          monto_aplicado?: number
          monto_disponible?: number
          monto_total?: number
          observaciones?: string | null
          plaza_id?: string | null
          referencia_pago?: string | null
          tipo_pago?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranza_pagos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranza_pagos_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          barrera_entrada: string | null
          city: string | null
          created_at: string
          created_by: string | null
          customer_score: number | null
          email: string | null
          equipo: string | null
          estatus_cliente_id: string | null
          estatus_recompra_chevron:
            | Database["public"]["Enums"]["estatus_recompra"]
            | null
          estatus_recompra_phillips66:
            | Database["public"]["Enums"]["estatus_recompra"]
            | null
          evaluacion_lubricante: string | null
          fecha_conversion_cliente: string | null
          fecha_ultima_compra: string | null
          fecha_ultima_compra_chevron: string | null
          fecha_ultima_compra_phillips66: string | null
          forma_pago: string | null
          frecuencia_compra_chevron_dias: number | null
          frecuencia_compra_dias: number | null
          frecuencia_compra_phillips66_dias: number | null
          id: string
          id_contpaq: string | null
          industrias: string[] | null
          industry: string | null
          is_active: boolean
          lista_precios: string | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago_sat"] | null
          name: string
          notes: string | null
          origen_contacto: string | null
          phone: string | null
          plaza_id: string
          potencial_cliente: string | null
          potencial_unidades: string | null
          primary_contact_id: string | null
          prioridad_cliente_id: string | null
          proxima_recompra_chevron: string | null
          proxima_recompra_phillips66: string | null
          razon_social: string | null
          riesgo_cambio_marca: string | null
          rol_lubricante: string | null
          segmento_id: string | null
          state: string | null
          ticket_promedio: number | null
          ticket_promedio_chevron: number | null
          ticket_promedio_phillips66: number | null
          tipo_cliente_comercial: string | null
          tipo_cliente_id: string | null
          tipo_destino_lubricante: string | null
          tipo_pago: Database["public"]["Enums"]["tipo_pago"] | null
          tomador_decision: string | null
          total_facturas_chevron: number | null
          total_facturas_phillips66: number | null
          updated_at: string
          uso_cfdi: Database["public"]["Enums"]["uso_cfdi"] | null
          volumen_mensual_estimado: number | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          barrera_entrada?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          customer_score?: number | null
          email?: string | null
          equipo?: string | null
          estatus_cliente_id?: string | null
          estatus_recompra_chevron?:
            | Database["public"]["Enums"]["estatus_recompra"]
            | null
          estatus_recompra_phillips66?:
            | Database["public"]["Enums"]["estatus_recompra"]
            | null
          evaluacion_lubricante?: string | null
          fecha_conversion_cliente?: string | null
          fecha_ultima_compra?: string | null
          fecha_ultima_compra_chevron?: string | null
          fecha_ultima_compra_phillips66?: string | null
          forma_pago?: string | null
          frecuencia_compra_chevron_dias?: number | null
          frecuencia_compra_dias?: number | null
          frecuencia_compra_phillips66_dias?: number | null
          id?: string
          id_contpaq?: string | null
          industrias?: string[] | null
          industry?: string | null
          is_active?: boolean
          lista_precios?: string | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          name: string
          notes?: string | null
          origen_contacto?: string | null
          phone?: string | null
          plaza_id: string
          potencial_cliente?: string | null
          potencial_unidades?: string | null
          primary_contact_id?: string | null
          prioridad_cliente_id?: string | null
          proxima_recompra_chevron?: string | null
          proxima_recompra_phillips66?: string | null
          razon_social?: string | null
          riesgo_cambio_marca?: string | null
          rol_lubricante?: string | null
          segmento_id?: string | null
          state?: string | null
          ticket_promedio?: number | null
          ticket_promedio_chevron?: number | null
          ticket_promedio_phillips66?: number | null
          tipo_cliente_comercial?: string | null
          tipo_cliente_id?: string | null
          tipo_destino_lubricante?: string | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          tomador_decision?: string | null
          total_facturas_chevron?: number | null
          total_facturas_phillips66?: number | null
          updated_at?: string
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
          volumen_mensual_estimado?: number | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          barrera_entrada?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          customer_score?: number | null
          email?: string | null
          equipo?: string | null
          estatus_cliente_id?: string | null
          estatus_recompra_chevron?:
            | Database["public"]["Enums"]["estatus_recompra"]
            | null
          estatus_recompra_phillips66?:
            | Database["public"]["Enums"]["estatus_recompra"]
            | null
          evaluacion_lubricante?: string | null
          fecha_conversion_cliente?: string | null
          fecha_ultima_compra?: string | null
          fecha_ultima_compra_chevron?: string | null
          fecha_ultima_compra_phillips66?: string | null
          forma_pago?: string | null
          frecuencia_compra_chevron_dias?: number | null
          frecuencia_compra_dias?: number | null
          frecuencia_compra_phillips66_dias?: number | null
          id?: string
          id_contpaq?: string | null
          industrias?: string[] | null
          industry?: string | null
          is_active?: boolean
          lista_precios?: string | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          name?: string
          notes?: string | null
          origen_contacto?: string | null
          phone?: string | null
          plaza_id?: string
          potencial_cliente?: string | null
          potencial_unidades?: string | null
          primary_contact_id?: string | null
          prioridad_cliente_id?: string | null
          proxima_recompra_chevron?: string | null
          proxima_recompra_phillips66?: string | null
          razon_social?: string | null
          riesgo_cambio_marca?: string | null
          rol_lubricante?: string | null
          segmento_id?: string | null
          state?: string | null
          ticket_promedio?: number | null
          ticket_promedio_chevron?: number | null
          ticket_promedio_phillips66?: number | null
          tipo_cliente_comercial?: string | null
          tipo_cliente_id?: string | null
          tipo_destino_lubricante?: string | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          tomador_decision?: string | null
          total_facturas_chevron?: number | null
          total_facturas_phillips66?: number | null
          updated_at?: string
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
          volumen_mensual_estimado?: number | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_estatus_cliente_id_fkey"
            columns: ["estatus_cliente_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_prioridad_cliente_id_fkey"
            columns: ["prioridad_cliente_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tipo_cliente_id_fkey"
            columns: ["tipo_cliente_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      company_ejecutivos: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_ejecutivos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_plazas: {
        Row: {
          company_id: string
          created_at: string
          id: string
          plaza_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          plaza_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          plaza_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_plazas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_plazas_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
      }
      company_productos_competencia: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          marca_competencia: string | null
          notas: string | null
          precio_actual: number | null
          producto_descripcion: string
          unidad_volumen: string | null
          updated_at: string
          volumen_estimado: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          marca_competencia?: string | null
          notas?: string | null
          precio_actual?: number | null
          producto_descripcion: string
          unidad_volumen?: string | null
          updated_at?: string
          volumen_estimado?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          marca_competencia?: string | null
          notas?: string | null
          precio_actual?: number | null
          producto_descripcion?: string
          unidad_volumen?: string | null
          updated_at?: string
          volumen_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_productos_competencia_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_productos_competencia_fotos: {
        Row: {
          created_at: string
          id: string
          producto_id: string
          url_foto: string
        }
        Insert: {
          created_at?: string
          id?: string
          producto_id: string
          url_foto: string
        }
        Update: {
          created_at?: string
          id?: string
          producto_id?: string
          url_foto?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_productos_competencia_fotos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "company_productos_competencia"
            referencedColumns: ["id"]
          },
        ]
      }
      condiciones_comerciales: {
        Row: {
          contenido: string
          created_at: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id: string
          updated_at: string
        }
        Insert: {
          contenido?: string
          created_at?: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          updated_at?: string
        }
        Update: {
          contenido?: string
          created_at?: string
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_ejecutivos: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_ejecutivos_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto_intereses: {
        Row: {
          contacto_id: string
          created_at: string
          interes_id: string
        }
        Insert: {
          contacto_id: string
          created_at?: string
          interes_id: string
        }
        Update: {
          contacto_id?: string
          created_at?: string
          interes_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacto_intereses_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacto_intereses_interes_id_fkey"
            columns: ["interes_id"]
            isOneToOne: false
            referencedRelation: "intereses_giro"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          comm_cel: boolean
          comm_email: boolean
          comm_email2: boolean
          comm_tel: boolean
          comm_tel_emp: boolean
          comm_whatsapp: boolean
          company_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          email2: string | null
          first_name: string
          id: string
          influencia_id: string | null
          is_active: boolean
          job_title: string | null
          last_name: string
          mobile: string | null
          no_contactar: boolean
          no_contactar_fecha: string | null
          no_contactar_motivo: string | null
          notes: string | null
          phone: string | null
          plaza_id: string | null
          rol_id: string | null
          sede: Database["public"]["Enums"]["sede_contacto"] | null
          tel_emp: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          comm_cel?: boolean
          comm_email?: boolean
          comm_email2?: boolean
          comm_tel?: boolean
          comm_tel_emp?: boolean
          comm_whatsapp?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          email2?: string | null
          first_name: string
          id?: string
          influencia_id?: string | null
          is_active?: boolean
          job_title?: string | null
          last_name: string
          mobile?: string | null
          no_contactar?: boolean
          no_contactar_fecha?: string | null
          no_contactar_motivo?: string | null
          notes?: string | null
          phone?: string | null
          plaza_id?: string | null
          rol_id?: string | null
          sede?: Database["public"]["Enums"]["sede_contacto"] | null
          tel_emp?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          comm_cel?: boolean
          comm_email?: boolean
          comm_email2?: boolean
          comm_tel?: boolean
          comm_tel_emp?: boolean
          comm_whatsapp?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          email2?: string | null
          first_name?: string
          id?: string
          influencia_id?: string | null
          is_active?: boolean
          job_title?: string | null
          last_name?: string
          mobile?: string | null
          no_contactar?: boolean
          no_contactar_fecha?: string | null
          no_contactar_motivo?: string | null
          notes?: string | null
          phone?: string | null
          plaza_id?: string | null
          rol_id?: string | null
          sede?: Database["public"]["Enums"]["sede_contacto"] | null
          tel_emp?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_influencia_id_fkey"
            columns: ["influencia_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_date: string
          channel: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          destinatario_phone: string | null
          documento_id: string | null
          id: string
          message_type: string | null
          template_id: string | null
          title: string
          type: string
          user_id: string
          wa_conversation_id: string | null
          wa_message_id: string | null
        }
        Insert: {
          activity_date?: string
          channel?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          destinatario_phone?: string | null
          documento_id?: string | null
          id?: string
          message_type?: string | null
          template_id?: string | null
          title: string
          type: string
          user_id: string
          wa_conversation_id?: string | null
          wa_message_id?: string | null
        }
        Update: {
          activity_date?: string
          channel?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          destinatario_phone?: string | null
          documento_id?: string | null
          id?: string
          message_type?: string | null
          template_id?: string | null
          title?: string
          type?: string
          user_id?: string
          wa_conversation_id?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_collaborators: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_collaborators_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "crm_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_change_logs: {
        Row: {
          action: string
          created_at: string
          deal_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          deal_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          deal_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_deals: {
        Row: {
          categoria_interes_id: string | null
          close_date: string | null
          company_id: string
          contact_id: string | null
          convertido_a_cliente: boolean
          cotizado_unidades: number
          created_at: string
          created_by: string | null
          facturado_unidades: number
          fecha_conversion: string | null
          id: string
          mes_negocio: string | null
          motivo_perdida_id: string | null
          notes: string | null
          origen_prospecto_id: string | null
          owner_id: string | null
          pedido_unidades: number
          pipeline_id: string
          pipeline_type: Database["public"]["Enums"]["pipeline_type"]
          plaza_id: string | null
          potencial_unidades: number | null
          probability: number
          proxima_fecha_seguimiento: string | null
          stage_id: string
          tipo_negocio: Database["public"]["Enums"]["tipo_negocio_crm"]
          title: string
          updated_at: string
          value: number
          volumen_mensual_estimado: number | null
        }
        Insert: {
          categoria_interes_id?: string | null
          close_date?: string | null
          company_id: string
          contact_id?: string | null
          convertido_a_cliente?: boolean
          cotizado_unidades?: number
          created_at?: string
          created_by?: string | null
          facturado_unidades?: number
          fecha_conversion?: string | null
          id?: string
          mes_negocio?: string | null
          motivo_perdida_id?: string | null
          notes?: string | null
          origen_prospecto_id?: string | null
          owner_id?: string | null
          pedido_unidades?: number
          pipeline_id: string
          pipeline_type?: Database["public"]["Enums"]["pipeline_type"]
          plaza_id?: string | null
          potencial_unidades?: number | null
          probability?: number
          proxima_fecha_seguimiento?: string | null
          stage_id: string
          tipo_negocio?: Database["public"]["Enums"]["tipo_negocio_crm"]
          title: string
          updated_at?: string
          value?: number
          volumen_mensual_estimado?: number | null
        }
        Update: {
          categoria_interes_id?: string | null
          close_date?: string | null
          company_id?: string
          contact_id?: string | null
          convertido_a_cliente?: boolean
          cotizado_unidades?: number
          created_at?: string
          created_by?: string | null
          facturado_unidades?: number
          fecha_conversion?: string | null
          id?: string
          mes_negocio?: string | null
          motivo_perdida_id?: string | null
          notes?: string | null
          origen_prospecto_id?: string | null
          owner_id?: string | null
          pedido_unidades?: number
          pipeline_id?: string
          pipeline_type?: Database["public"]["Enums"]["pipeline_type"]
          plaza_id?: string | null
          potencial_unidades?: number | null
          probability?: number
          proxima_fecha_seguimiento?: string | null
          stage_id?: string
          tipo_negocio?: Database["public"]["Enums"]["tipo_negocio_crm"]
          title?: string
          updated_at?: string
          value?: number
          volumen_mensual_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_categoria_interes_id_fkey"
            columns: ["categoria_interes_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_motivo_perdida_id_fkey"
            columns: ["motivo_perdida_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_origen_prospecto_id_fkey"
            columns: ["origen_prospecto_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_item_collaborators: {
        Row: {
          added_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_item_collaborators_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "crm_items"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_items: {
        Row: {
          assigned_to: string | null
          canal: string | null
          company_id: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          fecha_actividad: string | null
          fecha_creacion: string
          fecha_programada: string | null
          fecha_terminacion: string | null
          fecha_vencimiento: string | null
          id: string
          kind: Database["public"]["Enums"]["crm_item_kind"]
          marca: string | null
          mensaje_sugerido: string | null
          metadata: Json
          notas_internas: string | null
          origen: string | null
          pipeline_id: string | null
          priority: Database["public"]["Enums"]["crm_item_priority"]
          resultado: string | null
          status: Database["public"]["Enums"]["crm_item_status"]
          title: string
          type: Database["public"]["Enums"]["crm_item_type"]
          updated_at: string
          whatsapp_last_sent_at: string | null
          whatsapp_status: string | null
        }
        Insert: {
          assigned_to?: string | null
          canal?: string | null
          company_id?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          fecha_actividad?: string | null
          fecha_creacion?: string
          fecha_programada?: string | null
          fecha_terminacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["crm_item_kind"]
          marca?: string | null
          mensaje_sugerido?: string | null
          metadata?: Json
          notas_internas?: string | null
          origen?: string | null
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["crm_item_priority"]
          resultado?: string | null
          status?: Database["public"]["Enums"]["crm_item_status"]
          title: string
          type?: Database["public"]["Enums"]["crm_item_type"]
          updated_at?: string
          whatsapp_last_sent_at?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          assigned_to?: string | null
          canal?: string | null
          company_id?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          fecha_actividad?: string | null
          fecha_creacion?: string
          fecha_programada?: string | null
          fecha_terminacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["crm_item_kind"]
          marca?: string | null
          mensaje_sugerido?: string | null
          metadata?: Json
          notas_internas?: string | null
          origen?: string | null
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["crm_item_priority"]
          resultado?: string | null
          status?: Database["public"]["Enums"]["crm_item_status"]
          title?: string
          type?: Database["public"]["Enums"]["crm_item_type"]
          updated_at?: string
          whatsapp_last_sent_at?: string | null
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_items_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          marca: string
          nombre: string
          pipeline_type: Database["public"]["Enums"]["pipeline_type"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          marca: string
          nombre: string
          pipeline_type?: Database["public"]["Enums"]["pipeline_type"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          marca?: string
          nombre?: string
          pipeline_type?: Database["public"]["Enums"]["pipeline_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_task_collaborators: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_collaborators_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_task_subtasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          company_id: string | null
          completed: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          mensaje_sugerido: string | null
          origen_tarea_id: string | null
          priority: string
          programable_entrega: boolean
          recurrence: string
          reschedule_count: number
          reschedule_reason: string | null
          task_status: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
          whatsapp_last_sent_at: string | null
          whatsapp_status: Database["public"]["Enums"]["whatsapp_task_status"]
        }
        Insert: {
          company_id?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          mensaje_sugerido?: string | null
          origen_tarea_id?: string | null
          priority?: string
          programable_entrega?: boolean
          recurrence?: string
          reschedule_count?: number
          reschedule_reason?: string | null
          task_status?: string
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
          whatsapp_last_sent_at?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_task_status"]
        }
        Update: {
          company_id?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          mensaje_sugerido?: string | null
          origen_tarea_id?: string | null
          priority?: string
          programable_entrega?: boolean
          recurrence?: string
          reschedule_count?: number
          reschedule_reason?: string | null
          task_status?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
          whatsapp_last_sent_at?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_task_status"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_origen_tarea_id_fkey"
            columns: ["origen_tarea_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_repurchase_metrics: {
        Row: {
          calculado_en: string
          empresa_id: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estatus: Database["public"]["Enums"]["estatus_recompra"] | null
          fecha_ultima_compra: string | null
          frecuencia_dias: number | null
          id: string
          proxima_recompra: string | null
          ticket_promedio: number | null
          total_facturas: number | null
        }
        Insert: {
          calculado_en?: string
          empresa_id: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estatus?: Database["public"]["Enums"]["estatus_recompra"] | null
          fecha_ultima_compra?: string | null
          frecuencia_dias?: number | null
          id?: string
          proxima_recompra?: string | null
          ticket_promedio?: number | null
          total_facturas?: number | null
        }
        Update: {
          calculado_en?: string
          empresa_id?: string
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          estatus?: Database["public"]["Enums"]["estatus_recompra"] | null
          fecha_ultima_compra?: string | null
          frecuencia_dias?: number | null
          id?: string
          proxima_recompra?: string | null
          ticket_promedio?: number | null
          total_facturas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_repurchase_metrics_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      direcciones_empresa: {
        Row: {
          calle: string
          ciudad: string | null
          codigo_google: string | null
          codigo_postal: string | null
          coordenadas_lat: number | null
          coordenadas_lng: number | null
          created_at: string
          direccion_completa: string | null
          empresa_id: string
          estado: string | null
          id: string
          is_active: boolean
          nombre: string | null
          pais: string | null
          referencia: string | null
          tipo: Database["public"]["Enums"]["tipo_direccion"]
          tipos: string[]
          updated_at: string
        }
        Insert: {
          calle: string
          ciudad?: string | null
          codigo_google?: string | null
          codigo_postal?: string | null
          coordenadas_lat?: number | null
          coordenadas_lng?: number | null
          created_at?: string
          direccion_completa?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          is_active?: boolean
          nombre?: string | null
          pais?: string | null
          referencia?: string | null
          tipo?: Database["public"]["Enums"]["tipo_direccion"]
          tipos?: string[]
          updated_at?: string
        }
        Update: {
          calle?: string
          ciudad?: string | null
          codigo_google?: string | null
          codigo_postal?: string | null
          coordenadas_lat?: number | null
          coordenadas_lng?: number | null
          created_at?: string
          direccion_completa?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          is_active?: boolean
          nombre?: string | null
          pais?: string | null
          referencia?: string | null
          tipo?: Database["public"]["Enums"]["tipo_direccion"]
          tipos?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direcciones_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_acuse_archivos: {
        Row: {
          documento_id: string
          fecha_carga: string
          id: string
          nombre_archivo: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga: string | null
        }
        Insert: {
          documento_id: string
          fecha_carga?: string
          id?: string
          nombre_archivo: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga?: string | null
        }
        Update: {
          documento_id?: string
          fecha_carga?: string
          id?: string
          nombre_archivo?: string
          tipo_archivo?: string
          url_archivo?: string
          usuario_carga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_acuse_archivos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_archivos_firmados: {
        Row: {
          categoria: string
          documento_id: string
          fecha_carga: string
          id: string
          nombre_archivo: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga: string | null
        }
        Insert: {
          categoria?: string
          documento_id: string
          fecha_carga?: string
          id?: string
          nombre_archivo: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga?: string | null
        }
        Update: {
          categoria?: string
          documento_id?: string
          fecha_carga?: string
          id?: string
          nombre_archivo?: string
          tipo_archivo?: string
          url_archivo?: string
          usuario_carga?: string | null
        }
        Relationships: []
      }
      documento_direccion_bitacora: {
        Row: {
          created_at: string
          direccion_anterior: string | null
          direccion_nueva: string
          documento_id: string
          id: string
          latitud: number | null
          longitud: number | null
          origen: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          direccion_anterior?: string | null
          direccion_nueva: string
          documento_id: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          origen?: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          direccion_anterior?: string | null
          direccion_nueva?: string
          documento_id?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          origen?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      documento_fotos_entrega: {
        Row: {
          created_at: string
          documento_id: string
          id: string
          nombre: string | null
          url: string
        }
        Insert: {
          created_at?: string
          documento_id: string
          id?: string
          nombre?: string | null
          url: string
        }
        Update: {
          created_at?: string
          documento_id?: string
          id?: string
          nombre?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_fotos_entrega_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_orden_compra_archivos: {
        Row: {
          documento_id: string
          fecha_carga: string
          id: string
          nombre_archivo: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga: string | null
        }
        Insert: {
          documento_id: string
          fecha_carga?: string
          id?: string
          nombre_archivo: string
          tipo_archivo: string
          url_archivo: string
          usuario_carga?: string | null
        }
        Update: {
          documento_id?: string
          fecha_carga?: string
          id?: string
          nombre_archivo?: string
          tipo_archivo?: string
          url_archivo?: string
          usuario_carga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_orden_compra_archivos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_productos: {
        Row: {
          cantidad: number
          created_at: string
          descuento_porcentaje: number
          documento_id: string
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
          unidades_equivalentes: number
        }
        Insert: {
          cantidad?: number
          created_at?: string
          descuento_porcentaje?: number
          documento_id: string
          id?: string
          precio_unitario?: number
          producto_id: string
          subtotal?: number
          unidades_equivalentes?: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descuento_porcentaje?: number
          documento_id?: string
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
          unidades_equivalentes?: number
        }
        Relationships: [
          {
            foreignKeyName: "documento_productos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_productos_backup_2026_04_22: {
        Row: {
          cantidad: number | null
          created_at: string | null
          descuento_porcentaje: number | null
          documento_id: string | null
          id: string | null
          precio_unitario: number | null
          producto_id: string | null
          subtotal: number | null
          unidades_equivalentes: number | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string | null
          descuento_porcentaje?: number | null
          documento_id?: string | null
          id?: string | null
          precio_unitario?: number | null
          producto_id?: string | null
          subtotal?: number | null
          unidades_equivalentes?: number | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string | null
          descuento_porcentaje?: number | null
          documento_id?: string | null
          id?: string | null
          precio_unitario?: number | null
          producto_id?: string | null
          subtotal?: number | null
          unidades_equivalentes?: number | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          contacto_id: string | null
          cotizacion_original_id: string | null
          created_at: string
          created_by: string | null
          direccion_envio: string | null
          direccion_envio_lat: number | null
          direccion_envio_lng: number | null
          direccion_envio_nombre: string | null
          ejecutivo_venta_id: string | null
          empresa_id: string | null
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estado_cobranza:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_entrega_corporativa:
            | Database["public"]["Enums"]["estatus_entrega_corporativa"]
            | null
          estatus_factura: Database["public"]["Enums"]["estatus_factura"] | null
          estatus_pedido: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento: string
          fecha_entrega_programada: string | null
          fecha_entrega_real: string | null
          fecha_oc_cliente: string | null
          fecha_vencimiento: string | null
          follow_up_status: Database["public"]["Enums"]["cotizacion_followup_status"]
          forma_pago: string | null
          id: string
          is_active: boolean
          iva_importe: number
          iva_porcentaje: number
          metodo_pago: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm: string | null
          negocio_id: string | null
          notas: string | null
          numero_cotizacion: string | null
          numero_factura: string | null
          numero_oc_cliente: string | null
          numero_pedido: string | null
          pdf_url: string | null
          plaza_id: string | null
          saldo_pendiente_cobranza: number
          subtotal: number
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
          tipo_pago: Database["public"]["Enums"]["tipo_pago"] | null
          total: number
          unidades_equivalentes_total: number
          updated_at: string
          uso_cfdi: Database["public"]["Enums"]["uso_cfdi"] | null
          whatsapp_last_sent_at: string | null
        }
        Insert: {
          contacto_id?: string | null
          cotizacion_original_id?: string | null
          created_at?: string
          created_by?: string | null
          direccion_envio?: string | null
          direccion_envio_lat?: number | null
          direccion_envio_lng?: number | null
          direccion_envio_nombre?: string | null
          ejecutivo_venta_id?: string | null
          empresa_id?: string | null
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estado_cobranza?:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion?:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_entrega_corporativa?:
            | Database["public"]["Enums"]["estatus_entrega_corporativa"]
            | null
          estatus_factura?:
            | Database["public"]["Enums"]["estatus_factura"]
            | null
          estatus_pedido?: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento?: string
          fecha_entrega_programada?: string | null
          fecha_entrega_real?: string | null
          fecha_oc_cliente?: string | null
          fecha_vencimiento?: string | null
          follow_up_status?: Database["public"]["Enums"]["cotizacion_followup_status"]
          forma_pago?: string | null
          id?: string
          is_active?: boolean
          iva_importe?: number
          iva_porcentaje?: number
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm?: string | null
          negocio_id?: string | null
          notas?: string | null
          numero_cotizacion?: string | null
          numero_factura?: string | null
          numero_oc_cliente?: string | null
          numero_pedido?: string | null
          pdf_url?: string | null
          plaza_id?: string | null
          saldo_pendiente_cobranza?: number
          subtotal?: number
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          total?: number
          unidades_equivalentes_total?: number
          updated_at?: string
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
          whatsapp_last_sent_at?: string | null
        }
        Update: {
          contacto_id?: string | null
          cotizacion_original_id?: string | null
          created_at?: string
          created_by?: string | null
          direccion_envio?: string | null
          direccion_envio_lat?: number | null
          direccion_envio_lng?: number | null
          direccion_envio_nombre?: string | null
          ejecutivo_venta_id?: string | null
          empresa_id?: string | null
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          estado_cobranza?:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion?:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_entrega_corporativa?:
            | Database["public"]["Enums"]["estatus_entrega_corporativa"]
            | null
          estatus_factura?:
            | Database["public"]["Enums"]["estatus_factura"]
            | null
          estatus_pedido?: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento?: string
          fecha_entrega_programada?: string | null
          fecha_entrega_real?: string | null
          fecha_oc_cliente?: string | null
          fecha_vencimiento?: string | null
          follow_up_status?: Database["public"]["Enums"]["cotizacion_followup_status"]
          forma_pago?: string | null
          id?: string
          is_active?: boolean
          iva_importe?: number
          iva_porcentaje?: number
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm?: string | null
          negocio_id?: string | null
          notas?: string | null
          numero_cotizacion?: string | null
          numero_factura?: string | null
          numero_oc_cliente?: string | null
          numero_pedido?: string | null
          pdf_url?: string | null
          plaza_id?: string | null
          saldo_pendiente_cobranza?: number
          subtotal?: number
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          total?: number
          unidades_equivalentes_total?: number
          updated_at?: string
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
          whatsapp_last_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cotizacion_original_id_fkey"
            columns: ["cotizacion_original_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_backup_2026_04_22: {
        Row: {
          contacto_id: string | null
          cotizacion_original_id: string | null
          created_at: string | null
          created_by: string | null
          direccion_envio: string | null
          direccion_envio_lat: number | null
          direccion_envio_lng: number | null
          ejecutivo_venta_id: string | null
          empresa_id: string | null
          empresa_vendedora:
            | Database["public"]["Enums"]["empresa_vendedora"]
            | null
          estado_cobranza:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_entrega_corporativa:
            | Database["public"]["Enums"]["estatus_entrega_corporativa"]
            | null
          estatus_factura: Database["public"]["Enums"]["estatus_factura"] | null
          estatus_pedido: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento: string | null
          fecha_entrega_programada: string | null
          fecha_oc_cliente: string | null
          fecha_vencimiento: string | null
          id: string | null
          is_active: boolean | null
          iva_importe: number | null
          iva_porcentaje: number | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm: string | null
          notas: string | null
          numero_cotizacion: string | null
          numero_factura: string | null
          numero_oc_cliente: string | null
          numero_pedido: string | null
          pdf_url: string | null
          plaza_id: string | null
          saldo_pendiente_cobranza: number | null
          subtotal: number | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento"] | null
          tipo_pago: Database["public"]["Enums"]["tipo_pago"] | null
          total: number | null
          unidades_equivalentes_total: number | null
          updated_at: string | null
          uso_cfdi: Database["public"]["Enums"]["uso_cfdi"] | null
        }
        Insert: {
          contacto_id?: string | null
          cotizacion_original_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direccion_envio?: string | null
          direccion_envio_lat?: number | null
          direccion_envio_lng?: number | null
          ejecutivo_venta_id?: string | null
          empresa_id?: string | null
          empresa_vendedora?:
            | Database["public"]["Enums"]["empresa_vendedora"]
            | null
          estado_cobranza?:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion?:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_entrega_corporativa?:
            | Database["public"]["Enums"]["estatus_entrega_corporativa"]
            | null
          estatus_factura?:
            | Database["public"]["Enums"]["estatus_factura"]
            | null
          estatus_pedido?: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento?: string | null
          fecha_entrega_programada?: string | null
          fecha_oc_cliente?: string | null
          fecha_vencimiento?: string | null
          id?: string | null
          is_active?: boolean | null
          iva_importe?: number | null
          iva_porcentaje?: number | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm?: string | null
          notas?: string | null
          numero_cotizacion?: string | null
          numero_factura?: string | null
          numero_oc_cliente?: string | null
          numero_pedido?: string | null
          pdf_url?: string | null
          plaza_id?: string | null
          saldo_pendiente_cobranza?: number | null
          subtotal?: number | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"] | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          total?: number | null
          unidades_equivalentes_total?: number | null
          updated_at?: string | null
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
        }
        Update: {
          contacto_id?: string | null
          cotizacion_original_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direccion_envio?: string | null
          direccion_envio_lat?: number | null
          direccion_envio_lng?: number | null
          ejecutivo_venta_id?: string | null
          empresa_id?: string | null
          empresa_vendedora?:
            | Database["public"]["Enums"]["empresa_vendedora"]
            | null
          estado_cobranza?:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion?:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_entrega_corporativa?:
            | Database["public"]["Enums"]["estatus_entrega_corporativa"]
            | null
          estatus_factura?:
            | Database["public"]["Enums"]["estatus_factura"]
            | null
          estatus_pedido?: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento?: string | null
          fecha_entrega_programada?: string | null
          fecha_oc_cliente?: string | null
          fecha_vencimiento?: string | null
          id?: string | null
          is_active?: boolean | null
          iva_importe?: number | null
          iva_porcentaje?: number | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm?: string | null
          notas?: string | null
          numero_cotizacion?: string | null
          numero_factura?: string | null
          numero_oc_cliente?: string | null
          numero_pedido?: string | null
          pdf_url?: string | null
          plaza_id?: string | null
          saldo_pendiente_cobranza?: number | null
          subtotal?: number | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"] | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          total?: number | null
          unidades_equivalentes_total?: number | null
          updated_at?: string | null
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
        }
        Relationships: []
      }
      email_group_members: {
        Row: {
          created_at: string
          email: string
          group_id: string
          id: string
          nombre: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          group_id: string
          id?: string
          nombre?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          group_id?: string
          id?: string
          nombre?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "email_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      email_groups: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          is_active: boolean
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresa_marcas: {
        Row: {
          created_at: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id: string
          marca_id: string
        }
        Insert: {
          created_at?: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          marca_id: string
        }
        Update: {
          created_at?: string
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          marca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_marcas_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_programadas: {
        Row: {
          created_at: string
          delivered_latitude: number | null
          delivered_longitude: number | null
          documento_id: string
          evidencia_url: string | null
          fecha_entrega: string
          fecha_entrega_real: string | null
          id: string
          notas: string | null
          orden_ruta: number
          repartidor_id: string
          ruta_id: string | null
          updated_at: string
          vehiculo_id: string
        }
        Insert: {
          created_at?: string
          delivered_latitude?: number | null
          delivered_longitude?: number | null
          documento_id: string
          evidencia_url?: string | null
          fecha_entrega: string
          fecha_entrega_real?: string | null
          id?: string
          notas?: string | null
          orden_ruta?: number
          repartidor_id: string
          ruta_id?: string | null
          updated_at?: string
          vehiculo_id: string
        }
        Update: {
          created_at?: string
          delivered_latitude?: number | null
          delivered_longitude?: number | null
          documento_id?: string
          evidencia_url?: string | null
          fecha_entrega?: string
          fecha_entrega_real?: string | null
          id?: string
          notas?: string | null
          orden_ruta?: number
          repartidor_id?: string
          ruta_id?: string | null
          updated_at?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_programadas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_programadas_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "repartidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_programadas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_programadas_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      intereses_giro: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      plazas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      presentaciones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          unidades_equivalentes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          unidades_equivalentes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          unidades_equivalentes?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          option_type: Database["public"]["Enums"]["product_option_type"]
          parent_id: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          option_type: Database["public"]["Enums"]["product_option_type"]
          parent_id?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          option_type?: Database["public"]["Enums"]["product_option_type"]
          parent_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          aplicacion_id: string | null
          categoria_id: string | null
          codigo: string
          costo_actual: number
          created_at: string
          created_by: string | null
          descripcion: string | null
          formula_id: string | null
          id: string
          is_active: boolean
          linea_id: string | null
          marca_id: string | null
          nombre_producto: string
          precio_base_uf1: number
          precio_lista_galper: number
          precio_r1: number
          precio_r2: number
          precio_r3: number
          precio_r4: number
          precio_uf2: number
          precio_uf3: number
          precio_uf4: number
          presentacion_id: string | null
          updated_at: string
          uso_id: string | null
          viscosidad_id: string | null
        }
        Insert: {
          aplicacion_id?: string | null
          categoria_id?: string | null
          codigo: string
          costo_actual?: number
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          formula_id?: string | null
          id?: string
          is_active?: boolean
          linea_id?: string | null
          marca_id?: string | null
          nombre_producto: string
          precio_base_uf1?: number
          precio_lista_galper?: number
          precio_r1?: number
          precio_r2?: number
          precio_r3?: number
          precio_r4?: number
          precio_uf2?: number
          precio_uf3?: number
          precio_uf4?: number
          presentacion_id?: string | null
          updated_at?: string
          uso_id?: string | null
          viscosidad_id?: string | null
        }
        Update: {
          aplicacion_id?: string | null
          categoria_id?: string | null
          codigo?: string
          costo_actual?: number
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          formula_id?: string | null
          id?: string
          is_active?: boolean
          linea_id?: string | null
          marca_id?: string | null
          nombre_producto?: string
          precio_base_uf1?: number
          precio_lista_galper?: number
          precio_r1?: number
          precio_r2?: number
          precio_r3?: number
          precio_r4?: number
          precio_uf2?: number
          precio_uf3?: number
          precio_uf4?: number
          presentacion_id?: string | null
          updated_at?: string
          uso_id?: string | null
          viscosidad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_aplicacion_id_fkey"
            columns: ["aplicacion_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_uso_id_fkey"
            columns: ["uso_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_viscosidad_id_fkey"
            columns: ["viscosidad_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          plaza_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          plaza_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          plaza_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
      }
      repartidores: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          licencia: string | null
          nombre: string
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          licencia?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          licencia?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      role_module_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      ruta_repartidores: {
        Row: {
          created_at: string
          id: string
          repartidor_id: string
          ruta_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          repartidor_id: string
          ruta_id: string
        }
        Update: {
          created_at?: string
          id?: string
          repartidor_id?: string
          ruta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruta_repartidores_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "repartidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruta_repartidores_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      rutas_entrega: {
        Row: {
          capacidad_kg: number | null
          capacidad_volumen: number | null
          cerrada: boolean
          created_at: string
          created_by: string | null
          estatus: string | null
          fecha_entrega: string
          id: string
          km_recorridos: number | null
          plaza_id: string
          repartidor_id: string
          ruta_finished_at: string | null
          ruta_finished_by: string | null
          ruta_started_at: string | null
          ruta_started_by: string | null
          updated_at: string
          vehiculo_id: string
        }
        Insert: {
          capacidad_kg?: number | null
          capacidad_volumen?: number | null
          cerrada?: boolean
          created_at?: string
          created_by?: string | null
          estatus?: string | null
          fecha_entrega: string
          id?: string
          km_recorridos?: number | null
          plaza_id: string
          repartidor_id: string
          ruta_finished_at?: string | null
          ruta_finished_by?: string | null
          ruta_started_at?: string | null
          ruta_started_by?: string | null
          updated_at?: string
          vehiculo_id: string
        }
        Update: {
          capacidad_kg?: number | null
          capacidad_volumen?: number | null
          cerrada?: boolean
          created_at?: string
          created_by?: string | null
          estatus?: string | null
          fecha_entrega?: string
          id?: string
          km_recorridos?: number | null
          plaza_id?: string
          repartidor_id?: string
          ruta_finished_at?: string | null
          ruta_finished_by?: string | null
          ruta_started_at?: string | null
          ruta_started_by?: string | null
          updated_at?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rutas_entrega_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_entrega_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "repartidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_entrega_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          template_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          template_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          template_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_attachments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_placeholders: {
        Row: {
          applies_to: Database["public"]["Enums"]["placeholder_scope"]
          created_at: string
          description: string | null
          example_value: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          source_field: string | null
          source_table: string | null
          updated_at: string
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["placeholder_scope"]
          created_at?: string
          description?: string | null
          example_value?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          source_field?: string | null
          source_table?: string | null
          updated_at?: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["placeholder_scope"]
          created_at?: string
          description?: string | null
          example_value?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          source_field?: string | null
          source_table?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          bcc_emails: Json
          body: string
          category: Database["public"]["Enums"]["template_category"]
          cc_emails: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          reply_to: string | null
          subject: string | null
          system_key: string | null
          to_emails: Json
          type: Database["public"]["Enums"]["template_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bcc_emails?: Json
          body: string
          category?: Database["public"]["Enums"]["template_category"]
          cc_emails?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          reply_to?: string | null
          subject?: string | null
          system_key?: string | null
          to_emails?: Json
          type: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bcc_emails?: Json
          body?: string
          category?: Database["public"]["Enums"]["template_category"]
          cc_emails?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reply_to?: string | null
          subject?: string | null
          system_key?: string | null
          to_emails?: Json
          type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tipos_direccion: {
        Row: {
          clave: string
          created_at: string
          etiqueta: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          clave: string
          created_at?: string
          etiqueta: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          clave?: string
          created_at?: string
          etiqueta?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_merge_log: {
        Row: {
          affected_counts: Json
          created_at: string
          id: string
          performed_by: string | null
          source_email: string | null
          source_user_id: string
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          affected_counts?: Json
          created_at?: string
          id?: string
          performed_by?: string | null
          source_email?: string | null
          source_user_id: string
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          affected_counts?: Json
          created_at?: string
          id?: string
          performed_by?: string | null
          source_email?: string | null
          source_user_id?: string
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehiculos: {
        Row: {
          color: string
          created_at: string
          icon: Database["public"]["Enums"]["vehiculo_icon"]
          id: string
          is_active: boolean
          nombre: string
          placas: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: Database["public"]["Enums"]["vehiculo_icon"]
          id?: string
          is_active?: boolean
          nombre: string
          placas?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: Database["public"]["Enums"]["vehiculo_icon"]
          id?: string
          is_active?: boolean
          nombre?: string
          placas?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          business_phone_number_id: string
          color: string
          created_at: string
          display_phone: string | null
          id: string
          is_active: boolean
          label: string
          status: string
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          business_phone_number_id: string
          color?: string
          created_at?: string
          display_phone?: string | null
          id?: string
          is_active?: boolean
          label: string
          status?: string
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          business_phone_number_id?: string
          color?: string
          created_at?: string
          display_phone?: string | null
          id?: string
          is_active?: boolean
          label?: string
          status?: string
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_auto_replies_log: {
        Row: {
          id: string
          reason: string
          sent_at: string
          template_name: string | null
          wa_phone: string
        }
        Insert: {
          id?: string
          reason: string
          sent_at?: string
          template_name?: string | null
          wa_phone: string
        }
        Update: {
          id?: string
          reason?: string
          sent_at?: string
          template_name?: string | null
          wa_phone?: string
        }
        Relationships: []
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          wa_message_id: string | null
          wa_phone: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          wa_message_id?: string | null
          wa_phone: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          wa_message_id?: string | null
          wa_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          business_phone_number_id: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          finished_at: string | null
          header_image_url: string | null
          header_video_url: string | null
          id: string
          nombre: string
          scheduled_at: string | null
          sent_count: number
          skipped_count: number
          started_at: string | null
          status: string
          template_id: string | null
          template_language: string
          template_name: string
          template_variables: Json | null
          total_recipients: number
          updated_at: string
        }
        Insert: {
          business_phone_number_id?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          finished_at?: string | null
          header_image_url?: string | null
          header_video_url?: string | null
          id?: string
          nombre: string
          scheduled_at?: string | null
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          template_language?: string
          template_name: string
          template_variables?: Json | null
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          business_phone_number_id?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          finished_at?: string | null
          header_image_url?: string | null
          header_video_url?: string | null
          id?: string
          nombre?: string
          scheduled_at?: string | null
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          template_language?: string
          template_name?: string
          template_variables?: Json | null
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          business_phone_number_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          last_inbound_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          status: string
          unread_count: number
          updated_at: string
          wa_phone: string
          wa_profile_name: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_phone_number_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          wa_phone: string
          wa_profile_name?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_phone_number_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          wa_phone?: string
          wa_profile_name?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_keyword_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          match_type: string
          priority: number
          reply_template_language: string | null
          reply_template_name: string | null
          reply_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          match_type?: string
          priority?: number
          reply_template_language?: string | null
          reply_template_name?: string | null
          reply_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          match_type?: string
          priority?: number
          reply_template_language?: string | null
          reply_template_name?: string | null
          reply_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          business_phone_number_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          direction: string | null
          error_message: string | null
          id: string
          media_filename: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_storage_path: string | null
          media_type: string | null
          media_url: string | null
          message_body: string | null
          sender_phone: string | null
          status: string | null
          template_name: string | null
          wa_id: string | null
          wa_profile_name: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          business_phone_number_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_storage_path?: string | null
          media_type?: string | null
          media_url?: string | null
          message_body?: string | null
          sender_phone?: string | null
          status?: string | null
          template_name?: string | null
          wa_id?: string | null
          wa_profile_name?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          business_phone_number_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_storage_path?: string | null
          media_type?: string | null
          media_url?: string | null
          message_body?: string | null
          sender_phone?: string | null
          status?: string | null
          template_name?: string | null
          wa_id?: string | null
          wa_profile_name?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_notification_queue: {
        Row: {
          cancelled_at: string | null
          contact_phone: string | null
          conversation_id: string | null
          created_at: string
          id: string
          notification_type: string
          payload: Json
          recipient_phone: string | null
          recipient_user_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          notification_type?: string
          payload?: Json
          recipient_phone?: string | null
          recipient_user_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          notification_type?: string
          payload?: Json
          recipient_phone?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_quick_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_global: boolean
          shortcut: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_global?: boolean
          shortcut: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_global?: boolean
          shortcut?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          admin_phone: string | null
          alert_template_language: string | null
          alert_template_name: string | null
          away_enabled: boolean
          away_template_language: string | null
          away_template_name: string | null
          bot_enabled: boolean
          business_hours: Json
          critical_escalation_enabled: boolean
          critical_escalation_hours: number
          id: number
          notification_delay_minutes: number
          supervisor_phone: string | null
          unassigned_strategy: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_phone?: string | null
          alert_template_language?: string | null
          alert_template_name?: string | null
          away_enabled?: boolean
          away_template_language?: string | null
          away_template_name?: string | null
          bot_enabled?: boolean
          business_hours?: Json
          critical_escalation_enabled?: boolean
          critical_escalation_hours?: number
          id?: number
          notification_delay_minutes?: number
          supervisor_phone?: string | null
          unassigned_strategy?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_phone?: string | null
          alert_template_language?: string | null
          alert_template_name?: string | null
          away_enabled?: boolean
          away_template_language?: string | null
          away_template_name?: string | null
          bot_enabled?: boolean
          business_hours?: Json
          critical_escalation_enabled?: boolean
          critical_escalation_hours?: number
          id?: number
          notification_delay_minutes?: number
          supervisor_phone?: string | null
          unassigned_strategy?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body: string | null
          business_phone_number_id: string | null
          buttons: Json | null
          category: string | null
          components: Json | null
          created_at: string
          header_image_url: string | null
          header_text: string | null
          header_type: string
          header_video_url: string | null
          id: string
          language: string
          last_synced_at: string | null
          meta_template_id: string | null
          name: string
          quality_score: string | null
          rejection_reason: string | null
          source_body: string | null
          status: string
          updated_at: string
          variable_map: Json
          waba_id: string | null
        }
        Insert: {
          body?: string | null
          business_phone_number_id?: string | null
          buttons?: Json | null
          category?: string | null
          components?: Json | null
          created_at?: string
          header_image_url?: string | null
          header_text?: string | null
          header_type?: string
          header_video_url?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          meta_template_id?: string | null
          name: string
          quality_score?: string | null
          rejection_reason?: string | null
          source_body?: string | null
          status?: string
          updated_at?: string
          variable_map?: Json
          waba_id?: string | null
        }
        Update: {
          body?: string | null
          business_phone_number_id?: string | null
          buttons?: Json | null
          category?: string | null
          components?: Json | null
          created_at?: string
          header_image_url?: string | null
          header_text?: string | null
          header_type?: string
          header_video_url?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          meta_template_id?: string | null
          name?: string
          quality_score?: string | null
          rejection_reason?: string | null
          source_body?: string | null
          status?: string
          updated_at?: string
          variable_map?: Json
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      crm_items_unified: {
        Row: {
          assigned_to: string | null
          canal: string | null
          company_id: string | null
          completed_by: string | null
          contact_id: string | null
          created_by: string | null
          deal_id: string | null
          description: string | null
          fecha_actividad: string | null
          fecha_creacion: string | null
          fecha_programada: string | null
          fecha_terminacion: string | null
          fecha_vencimiento: string | null
          id: string | null
          kind: Database["public"]["Enums"]["crm_item_kind"] | null
          marca: string | null
          origen: string | null
          pipeline_id: string | null
          priority: string | null
          resultado: string | null
          source_table: string | null
          status: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      backfill_documentos_negocio_id: { Args: never; Returns: Json }
      brand_from_empresa_vendedora: {
        Args: { _ev: Database["public"]["Enums"]["empresa_vendedora"] }
        Returns: string
      }
      can_view_company: {
        Args: { _company_id: string; _created_by: string; _user_id: string }
        Returns: boolean
      }
      can_view_contact: {
        Args: {
          _company_id: string
          _contact_id: string
          _created_by: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_crm_deal: {
        Args: {
          _company_id: string
          _created_by: string
          _owner_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_documento: {
        Args: {
          _created_by: string
          _ejecutivo_venta_id: string
          _empresa_id: string
          _user_id: string
        }
        Returns: boolean
      }
      company_has_sold_units: {
        Args: {
          _company_id: string
          _empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
        }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_user_safe: { Args: { _user_id: string }; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_emails: {
        Args: never
        Returns: {
          email: string
          full_name: string
        }[]
      }
      get_company_metrics: {
        Args: { _company_id: string; _marca?: string }
        Returns: {
          marca_label: string
          promedio_mensual_subtotal: number
          promedio_mensual_unidades: number
          total_subtotal: number
          total_unidades: number
        }[]
      }
      get_company_saldo_vencido: {
        Args: { _company_id: string }
        Returns: number
      }
      get_or_create_deal_recompra_mes: {
        Args: { p_company_id: string; p_marca: string; p_mes?: string }
        Returns: string
      }
      get_user_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["access_level"]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_team_member_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_companies: {
        Args: { _duplicate_id: string; _primary_id: string }
        Returns: Json
      }
      merge_contacts: {
        Args: { _duplicate_id: string; _primary_id: string }
        Returns: Json
      }
      merge_users: {
        Args: { _source_user_id: string; _target_user_id: string }
        Returns: Json
      }
      module_owner_allows: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _owner: string
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalc_deal_units: { Args: { p_deal_id: string }; Returns: undefined }
      recalc_recompra_deals_for_doc: {
        Args: {
          p_empresa_id: string
          p_empresa_vendedora: string
          p_fecha: string
        }
        Returns: undefined
      }
      recalc_repurchase_for_company: {
        Args: {
          _empresa_id: string
          _empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
        }
        Returns: undefined
      }
      recompute_documento_cobranza: {
        Args: { _documento_id: string }
        Returns: undefined
      }
      recompute_pago_balance: { Args: { _pago_id: string }; Returns: undefined }
      repair_whatsapp_account_links: { Args: never; Returns: Json }
      resolve_documento_negocio: {
        Args: {
          _contacto_id: string
          _created_by: string
          _empresa_id: string
          _empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
        }
        Returns: string
      }
      resolve_template_placeholders: {
        Args: {
          _contacto_id?: string
          _documento_id?: string
          _pago_id?: string
        }
        Returns: Json
      }
      seed_crm_pipeline:
        | { Args: { p_marca: string; p_user_id: string }; Returns: string }
        | {
            Args: { p_marca: string; p_nombre?: string; p_user_id: string }
            Returns: string
          }
      user_can_access_crm_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      user_related_counts: { Args: { _user_id: string }; Returns: Json }
    }
    Enums: {
      access_level: "todos" | "equipo" | "propio" | "ninguno"
      app_module:
        | "directorio"
        | "crm_chevron"
        | "crm_phillips66"
        | "cotizaciones"
        | "inventario"
        | "entregas"
        | "transferencias"
        | "facturacion"
        | "productos"
        | "proyectos"
        | "capacitacion"
        | "reportes"
        | "modificar_pdf_cotizacion"
        | "eliminar_pdf_cotizacion"
        | "cobranza"
        | "pedidos"
        | "tareas"
        | "actividades"
      app_role:
        | "admin"
        | "manager"
        | "sales"
        | "delivery"
        | "warehouse"
        | "customer_service"
        | "accounting"
      approval_status: "pendiente" | "aprobado" | "rechazado"
      cotizacion_followup_status:
        | "enviada"
        | "seguimiento_1"
        | "seguimiento_2"
        | "seguimiento_3"
        | "vencida"
        | "sin_actividad"
      crm_item_kind: "tarea" | "actividad"
      crm_item_priority: "baja" | "media" | "alta" | "urgente"
      crm_item_status:
        | "pendiente"
        | "en_progreso"
        | "completada"
        | "cancelada"
        | "vencida"
      crm_item_type:
        | "call"
        | "email"
        | "meeting"
        | "note"
        | "field_visit"
        | "whatsapp"
        | "follow_up"
        | "task"
        | "visita"
        | "otro"
      empresa_vendedora: "lumaggs_chevron" | "galsa_phillips66"
      estado_cobranza_doc:
        | "pendiente"
        | "parcial"
        | "pagada"
        | "vencida"
        | "cancelada"
      estado_pago_cobranza:
        | "registrado"
        | "no_aplicado"
        | "aplicado_parcial"
        | "aplicado_total"
        | "cancelado"
      estatus_aplicacion_cobranza: "activa" | "cancelada"
      estatus_cotizacion:
        | "borrador"
        | "enviada"
        | "aceptada"
        | "rechazada"
        | "vencida"
        | "impresa"
      estatus_entrega_corporativa:
        | "solicitada"
        | "programada"
        | "entregada"
        | "acuse_enviado"
      estatus_factura:
        | "pendiente"
        | "pagada"
        | "parcial"
        | "vencida"
        | "cancelada"
        | "vigente"
      estatus_pago_cobranza:
        | "recibido"
        | "enviado_validar"
        | "validado"
        | "aplicado"
      estatus_pedido:
        | "confirmado_cliente"
        | "espera_autorizacion_precio"
        | "precio_autorizado"
        | "validado_contabilidad"
        | "programado_entrega"
        | "entregado"
        | "cancelado"
      estatus_recompra:
        | "al_dia"
        | "proximo"
        | "vencido"
        | "en_riesgo"
        | "dormido"
        | "sin_historial"
      metodo_pago_sat: "PUE" | "PPD"
      pipeline_type: "primera_compra" | "recompra"
      placeholder_scope: "email" | "whatsapp" | "ambos"
      product_option_type:
        | "marca"
        | "aplicacion"
        | "uso"
        | "formula"
        | "viscosidad"
        | "categoria"
        | "linea"
        | "estatus_cliente"
        | "prioridad_cliente"
        | "segmento_cliente"
        | "tipo_cliente"
        | "contacto_rol"
        | "contacto_influencia"
        | "origen_prospecto"
        | "motivo_perdida"
      sede_contacto: "mexicali" | "tijuana"
      template_category:
        | "seguimiento_cotizacion"
        | "recompra"
        | "expansion"
        | "prospecto"
        | "cobranza"
        | "entrega"
        | "pago"
        | "credito"
        | "general"
      template_type: "email" | "whatsapp"
      tipo_direccion:
        | "envio"
        | "fiscal"
        | "comercial"
        | "sucursal"
        | "principal"
      tipo_doc_cobranza: "factura" | "pedido" | "cotizacion"
      tipo_documento:
        | "cotizacion"
        | "pedido"
        | "factura"
        | "entrega_corporativa"
      tipo_negocio_crm: "prospecto" | "expansion" | "recompra" | "otro"
      tipo_pago: "contado" | "credito" | "credito_cescemex" | "credito_directo"
      uso_cfdi:
        | "G01"
        | "G02"
        | "G03"
        | "I01"
        | "I02"
        | "I03"
        | "I04"
        | "I05"
        | "I06"
        | "I07"
        | "I08"
        | "D01"
        | "D02"
        | "D03"
        | "D04"
        | "D05"
        | "D06"
        | "D07"
        | "D08"
        | "D09"
        | "D10"
        | "P01"
        | "S01"
        | "CP01"
        | "CN01"
      vehiculo_icon: "pickup" | "truck"
      whatsapp_task_status:
        | "pendiente"
        | "enviado"
        | "respondido"
        | "no_respondio"
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
      access_level: ["todos", "equipo", "propio", "ninguno"],
      app_module: [
        "directorio",
        "crm_chevron",
        "crm_phillips66",
        "cotizaciones",
        "inventario",
        "entregas",
        "transferencias",
        "facturacion",
        "productos",
        "proyectos",
        "capacitacion",
        "reportes",
        "modificar_pdf_cotizacion",
        "eliminar_pdf_cotizacion",
        "cobranza",
        "pedidos",
        "tareas",
        "actividades",
      ],
      app_role: [
        "admin",
        "manager",
        "sales",
        "delivery",
        "warehouse",
        "customer_service",
        "accounting",
      ],
      approval_status: ["pendiente", "aprobado", "rechazado"],
      cotizacion_followup_status: [
        "enviada",
        "seguimiento_1",
        "seguimiento_2",
        "seguimiento_3",
        "vencida",
        "sin_actividad",
      ],
      crm_item_kind: ["tarea", "actividad"],
      crm_item_priority: ["baja", "media", "alta", "urgente"],
      crm_item_status: [
        "pendiente",
        "en_progreso",
        "completada",
        "cancelada",
        "vencida",
      ],
      crm_item_type: [
        "call",
        "email",
        "meeting",
        "note",
        "field_visit",
        "whatsapp",
        "follow_up",
        "task",
        "visita",
        "otro",
      ],
      empresa_vendedora: ["lumaggs_chevron", "galsa_phillips66"],
      estado_cobranza_doc: [
        "pendiente",
        "parcial",
        "pagada",
        "vencida",
        "cancelada",
      ],
      estado_pago_cobranza: [
        "registrado",
        "no_aplicado",
        "aplicado_parcial",
        "aplicado_total",
        "cancelado",
      ],
      estatus_aplicacion_cobranza: ["activa", "cancelada"],
      estatus_cotizacion: [
        "borrador",
        "enviada",
        "aceptada",
        "rechazada",
        "vencida",
        "impresa",
      ],
      estatus_entrega_corporativa: [
        "solicitada",
        "programada",
        "entregada",
        "acuse_enviado",
      ],
      estatus_factura: [
        "pendiente",
        "pagada",
        "parcial",
        "vencida",
        "cancelada",
        "vigente",
      ],
      estatus_pago_cobranza: [
        "recibido",
        "enviado_validar",
        "validado",
        "aplicado",
      ],
      estatus_pedido: [
        "confirmado_cliente",
        "espera_autorizacion_precio",
        "precio_autorizado",
        "validado_contabilidad",
        "programado_entrega",
        "entregado",
        "cancelado",
      ],
      estatus_recompra: [
        "al_dia",
        "proximo",
        "vencido",
        "en_riesgo",
        "dormido",
        "sin_historial",
      ],
      metodo_pago_sat: ["PUE", "PPD"],
      pipeline_type: ["primera_compra", "recompra"],
      placeholder_scope: ["email", "whatsapp", "ambos"],
      product_option_type: [
        "marca",
        "aplicacion",
        "uso",
        "formula",
        "viscosidad",
        "categoria",
        "linea",
        "estatus_cliente",
        "prioridad_cliente",
        "segmento_cliente",
        "tipo_cliente",
        "contacto_rol",
        "contacto_influencia",
        "origen_prospecto",
        "motivo_perdida",
      ],
      sede_contacto: ["mexicali", "tijuana"],
      template_category: [
        "seguimiento_cotizacion",
        "recompra",
        "expansion",
        "prospecto",
        "cobranza",
        "entrega",
        "pago",
        "credito",
        "general",
      ],
      template_type: ["email", "whatsapp"],
      tipo_direccion: ["envio", "fiscal", "comercial", "sucursal", "principal"],
      tipo_doc_cobranza: ["factura", "pedido", "cotizacion"],
      tipo_documento: [
        "cotizacion",
        "pedido",
        "factura",
        "entrega_corporativa",
      ],
      tipo_negocio_crm: ["prospecto", "expansion", "recompra", "otro"],
      tipo_pago: ["contado", "credito", "credito_cescemex", "credito_directo"],
      uso_cfdi: [
        "G01",
        "G02",
        "G03",
        "I01",
        "I02",
        "I03",
        "I04",
        "I05",
        "I06",
        "I07",
        "I08",
        "D01",
        "D02",
        "D03",
        "D04",
        "D05",
        "D06",
        "D07",
        "D08",
        "D09",
        "D10",
        "P01",
        "S01",
        "CP01",
        "CN01",
      ],
      vehiculo_icon: ["pickup", "truck"],
      whatsapp_task_status: [
        "pendiente",
        "enviado",
        "respondido",
        "no_respondio",
      ],
    },
  },
} as const

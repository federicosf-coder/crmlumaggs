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
          estado_pago: Database["public"]["Enums"]["estado_pago_cobranza"]
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
          estado_pago?: Database["public"]["Enums"]["estado_pago_cobranza"]
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
          estado_pago?: Database["public"]["Enums"]["estado_pago_cobranza"]
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
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          equipo: string | null
          evaluacion_lubricante: string | null
          id: string
          industrias: string[] | null
          industry: string | null
          is_active: boolean
          lista_precios: string | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago_sat"] | null
          name: string
          notes: string | null
          origen_contacto: string | null
          phone: string | null
          plaza_id: string | null
          potencial_unidades: string | null
          riesgo_cambio_marca: string | null
          rol_lubricante: string | null
          state: string | null
          tipo_cliente_comercial: string | null
          tipo_destino_lubricante: string | null
          tipo_pago: Database["public"]["Enums"]["tipo_pago"] | null
          tomador_decision: string | null
          updated_at: string
          uso_cfdi: Database["public"]["Enums"]["uso_cfdi"] | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          equipo?: string | null
          evaluacion_lubricante?: string | null
          id?: string
          industrias?: string[] | null
          industry?: string | null
          is_active?: boolean
          lista_precios?: string | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          name: string
          notes?: string | null
          origen_contacto?: string | null
          phone?: string | null
          plaza_id?: string | null
          potencial_unidades?: string | null
          riesgo_cambio_marca?: string | null
          rol_lubricante?: string | null
          state?: string | null
          tipo_cliente_comercial?: string | null
          tipo_destino_lubricante?: string | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          tomador_decision?: string | null
          updated_at?: string
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          equipo?: string | null
          evaluacion_lubricante?: string | null
          id?: string
          industrias?: string[] | null
          industry?: string | null
          is_active?: boolean
          lista_precios?: string | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          name?: string
          notes?: string | null
          origen_contacto?: string | null
          phone?: string | null
          plaza_id?: string | null
          potencial_unidades?: string | null
          riesgo_cambio_marca?: string | null
          rol_lubricante?: string | null
          state?: string | null
          tipo_cliente_comercial?: string | null
          tipo_destino_lubricante?: string | null
          tipo_pago?: Database["public"]["Enums"]["tipo_pago"] | null
          tomador_decision?: string | null
          updated_at?: string
          uso_cfdi?: Database["public"]["Enums"]["uso_cfdi"] | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
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
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          job_title: string | null
          last_name: string
          mobile: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_name: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_name?: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_date: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          activity_date?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          activity_date?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          title?: string
          type?: string
          user_id?: string
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
      crm_deals: {
        Row: {
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string
          probability: number
          stage_id: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id: string
          probability?: number
          stage_id: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string
          probability?: number
          stage_id?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          marca: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          marca?: string
          nombre?: string
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
      crm_tasks: {
        Row: {
          company_id: string | null
          completed: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          programable_entrega: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          programable_entrega?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          programable_entrega?: boolean
          title?: string
          updated_at?: string
          user_id?: string
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
          empresa_id: string
          estado: string | null
          id: string
          is_active: boolean
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
          empresa_id: string
          estado?: string | null
          id?: string
          is_active?: boolean
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
          empresa_id?: string
          estado?: string | null
          id?: string
          is_active?: boolean
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
      documentos: {
        Row: {
          contacto_id: string | null
          cotizacion_original_id: string | null
          created_at: string
          created_by: string | null
          direccion_envio: string | null
          direccion_envio_lat: number | null
          direccion_envio_lng: number | null
          ejecutivo_venta_id: string | null
          empresa_id: string | null
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estado_cobranza:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_factura: Database["public"]["Enums"]["estatus_factura"] | null
          estatus_pedido: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento: string
          fecha_entrega_programada: string | null
          fecha_vencimiento: string | null
          id: string
          is_active: boolean
          iva_importe: number
          iva_porcentaje: number
          metodo_pago: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm: string | null
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
        }
        Insert: {
          contacto_id?: string | null
          cotizacion_original_id?: string | null
          created_at?: string
          created_by?: string | null
          direccion_envio?: string | null
          direccion_envio_lat?: number | null
          direccion_envio_lng?: number | null
          ejecutivo_venta_id?: string | null
          empresa_id?: string | null
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estado_cobranza?:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion?:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_factura?:
            | Database["public"]["Enums"]["estatus_factura"]
            | null
          estatus_pedido?: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento?: string
          fecha_entrega_programada?: string | null
          fecha_vencimiento?: string | null
          id?: string
          is_active?: boolean
          iva_importe?: number
          iva_porcentaje?: number
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm?: string | null
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
        }
        Update: {
          contacto_id?: string | null
          cotizacion_original_id?: string | null
          created_at?: string
          created_by?: string | null
          direccion_envio?: string | null
          direccion_envio_lat?: number | null
          direccion_envio_lng?: number | null
          ejecutivo_venta_id?: string | null
          empresa_id?: string | null
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          estado_cobranza?:
            | Database["public"]["Enums"]["estado_cobranza_doc"]
            | null
          estatus_cotizacion?:
            | Database["public"]["Enums"]["estatus_cotizacion"]
            | null
          estatus_factura?:
            | Database["public"]["Enums"]["estatus_factura"]
            | null
          estatus_pedido?: Database["public"]["Enums"]["estatus_pedido"] | null
          fecha_documento?: string
          fecha_entrega_programada?: string | null
          fecha_vencimiento?: string | null
          id?: string
          is_active?: boolean
          iva_importe?: number
          iva_porcentaje?: number
          metodo_pago?: Database["public"]["Enums"]["metodo_pago_sat"] | null
          negocio_crm?: string | null
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
            foreignKeyName: "documentos_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
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
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          licencia?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          licencia?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
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
          created_at: string
          created_by: string | null
          fecha_entrega: string
          id: string
          plaza_id: string
          repartidor_id: string
          updated_at: string
          vehiculo_id: string
        }
        Insert: {
          capacidad_kg?: number | null
          capacidad_volumen?: number | null
          created_at?: string
          created_by?: string | null
          fecha_entrega: string
          id?: string
          plaza_id: string
          repartidor_id: string
          updated_at?: string
          vehiculo_id: string
        }
        Update: {
          capacidad_kg?: number | null
          capacidad_volumen?: number | null
          created_at?: string
          created_by?: string | null
          fecha_entrega?: string
          id?: string
          plaza_id?: string
          repartidor_id?: string
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
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          placas: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          placas?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          placas?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      recompute_documento_cobranza: {
        Args: { _documento_id: string }
        Returns: undefined
      }
      recompute_pago_balance: { Args: { _pago_id: string }; Returns: undefined }
      seed_crm_pipeline:
        | { Args: { p_marca: string; p_user_id: string }; Returns: string }
        | {
            Args: { p_marca: string; p_nombre?: string; p_user_id: string }
            Returns: string
          }
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
      app_role:
        | "admin"
        | "manager"
        | "sales"
        | "delivery"
        | "warehouse"
        | "customer_service"
        | "accounting"
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
      estatus_factura:
        | "pendiente"
        | "pagada"
        | "parcial"
        | "vencida"
        | "cancelada"
      estatus_pedido:
        | "confirmado_cliente"
        | "espera_autorizacion_precio"
        | "precio_autorizado"
        | "validado_contabilidad"
        | "programado_entrega"
        | "entregado"
        | "cancelado"
      metodo_pago_sat: "PUE" | "PPD"
      product_option_type:
        | "marca"
        | "aplicacion"
        | "uso"
        | "formula"
        | "viscosidad"
        | "categoria"
        | "linea"
      tipo_direccion:
        | "envio"
        | "fiscal"
        | "comercial"
        | "sucursal"
        | "principal"
      tipo_doc_cobranza: "factura" | "pedido" | "cotizacion"
      tipo_documento: "cotizacion" | "pedido" | "factura"
      tipo_pago: "contado" | "credito" | "credito_cescemex"
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
      estatus_factura: [
        "pendiente",
        "pagada",
        "parcial",
        "vencida",
        "cancelada",
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
      metodo_pago_sat: ["PUE", "PPD"],
      product_option_type: [
        "marca",
        "aplicacion",
        "uso",
        "formula",
        "viscosidad",
        "categoria",
        "linea",
      ],
      tipo_direccion: ["envio", "fiscal", "comercial", "sucursal", "principal"],
      tipo_doc_cobranza: ["factura", "pedido", "cotizacion"],
      tipo_documento: ["cotizacion", "pedido", "factura"],
      tipo_pago: ["contado", "credito", "credito_cescemex"],
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
    },
  },
} as const

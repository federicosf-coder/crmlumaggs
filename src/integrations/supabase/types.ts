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
      automatizacion_constructores: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      automatizacion_ejecucion_log: {
        Row: {
          ejecucion_id: string
          ejecutado_at: string
          estatus: string
          id: string
          paso_id: string | null
          resultado: Json | null
        }
        Insert: {
          ejecucion_id: string
          ejecutado_at?: string
          estatus: string
          id?: string
          paso_id?: string | null
          resultado?: Json | null
        }
        Update: {
          ejecucion_id?: string
          ejecutado_at?: string
          estatus?: string
          id?: string
          paso_id?: string | null
          resultado?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automatizacion_ejecucion_log_ejecucion_id_fkey"
            columns: ["ejecucion_id"]
            isOneToOne: false
            referencedRelation: "automatizacion_ejecuciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automatizacion_ejecucion_log_paso_id_fkey"
            columns: ["paso_id"]
            isOneToOne: false
            referencedRelation: "automatizacion_pasos"
            referencedColumns: ["id"]
          },
        ]
      }
      automatizacion_ejecuciones: {
        Row: {
          automatizacion_id: string
          completado_at: string | null
          contexto: Json
          correlation_key: string | null
          disparado_por: string | null
          entidad_id: string | null
          entidad_tipo: string | null
          estatus: string
          evento_clave: string | null
          id: string
          iniciado_at: string
          paso_actual: number
        }
        Insert: {
          automatizacion_id: string
          completado_at?: string | null
          contexto?: Json
          correlation_key?: string | null
          disparado_por?: string | null
          entidad_id?: string | null
          entidad_tipo?: string | null
          estatus?: string
          evento_clave?: string | null
          id?: string
          iniciado_at?: string
          paso_actual?: number
        }
        Update: {
          automatizacion_id?: string
          completado_at?: string | null
          contexto?: Json
          correlation_key?: string | null
          disparado_por?: string | null
          entidad_id?: string | null
          entidad_tipo?: string | null
          estatus?: string
          evento_clave?: string | null
          id?: string
          iniciado_at?: string
          paso_actual?: number
        }
        Relationships: [
          {
            foreignKeyName: "automatizacion_ejecuciones_automatizacion_id_fkey"
            columns: ["automatizacion_id"]
            isOneToOne: false
            referencedRelation: "automatizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      automatizacion_eventos_catalogo: {
        Row: {
          categoria: string
          clave: string
          created_at: string
          descripcion: string | null
          etiqueta: string
          id: string
          is_active: boolean
          requiere_umbral: boolean
          umbral_default: number | null
          umbral_label: string | null
          updated_at: string
        }
        Insert: {
          categoria: string
          clave: string
          created_at?: string
          descripcion?: string | null
          etiqueta: string
          id?: string
          is_active?: boolean
          requiere_umbral?: boolean
          umbral_default?: number | null
          umbral_label?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          clave?: string
          created_at?: string
          descripcion?: string | null
          etiqueta?: string
          id?: string
          is_active?: boolean
          requiere_umbral?: boolean
          umbral_default?: number | null
          umbral_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      automatizacion_pasos: {
        Row: {
          automatizacion_id: string
          config: Json
          created_at: string
          id: string
          orden: number
          requiere_aprobacion: boolean | null
          tipo_paso: string
        }
        Insert: {
          automatizacion_id: string
          config?: Json
          created_at?: string
          id?: string
          orden: number
          requiere_aprobacion?: boolean | null
          tipo_paso: string
        }
        Update: {
          automatizacion_id?: string
          config?: Json
          created_at?: string
          id?: string
          orden?: number
          requiere_aprobacion?: boolean | null
          tipo_paso?: string
        }
        Relationships: [
          {
            foreignKeyName: "automatizacion_pasos_automatizacion_id_fkey"
            columns: ["automatizacion_id"]
            isOneToOne: false
            referencedRelation: "automatizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      automatizacion_solicitudes_funcion: {
        Row: {
          automatizacion_id: string | null
          created_at: string
          descripcion_necesidad: string
          estatus: string
          id: string
          nombre_solicitada: string | null
          paso_id: string | null
          resuelto_at: string | null
          solicitado_por: string
        }
        Insert: {
          automatizacion_id?: string | null
          created_at?: string
          descripcion_necesidad: string
          estatus?: string
          id?: string
          nombre_solicitada?: string | null
          paso_id?: string | null
          resuelto_at?: string | null
          solicitado_por: string
        }
        Update: {
          automatizacion_id?: string | null
          created_at?: string
          descripcion_necesidad?: string
          estatus?: string
          id?: string
          nombre_solicitada?: string | null
          paso_id?: string | null
          resuelto_at?: string | null
          solicitado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "automatizacion_solicitudes_funcion_automatizacion_id_fkey"
            columns: ["automatizacion_id"]
            isOneToOne: false
            referencedRelation: "automatizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automatizacion_solicitudes_funcion_paso_id_fkey"
            columns: ["paso_id"]
            isOneToOne: false
            referencedRelation: "automatizacion_pasos"
            referencedColumns: ["id"]
          },
        ]
      }
      automatizacion_usuarios: {
        Row: {
          automatizacion_id: string
          created_at: string
          id: string
          rol: string
          user_id: string
        }
        Insert: {
          automatizacion_id: string
          created_at?: string
          id?: string
          rol?: string
          user_id: string
        }
        Update: {
          automatizacion_id?: string
          created_at?: string
          id?: string
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automatizacion_usuarios_automatizacion_id_fkey"
            columns: ["automatizacion_id"]
            isOneToOne: false
            referencedRelation: "automatizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      automatizaciones: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string
          descripcion: string | null
          id: string
          nivel_acceso: string
          nombre: string
          requiere_aprobacion: boolean
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by: string
          descripcion?: string | null
          id?: string
          nivel_acceso?: string
          nombre: string
          requiere_aprobacion?: boolean
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string
          descripcion?: string | null
          id?: string
          nivel_acceso?: string
          nombre?: string
          requiere_aprobacion?: boolean
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      biblioteca_archivos: {
        Row: {
          categoria_id: string | null
          created_at: string
          created_by: string
          current_version_id: string | null
          descripcion: string | null
          estado: string
          etiquetas: string[] | null
          id: string
          marca: string | null
          nombre: string
          updated_at: string
          vigencia_desde: string | null
          vigencia_hasta: string | null
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          created_by: string
          current_version_id?: string | null
          descripcion?: string | null
          estado?: string
          etiquetas?: string[] | null
          id?: string
          marca?: string | null
          nombre: string
          updated_at?: string
          vigencia_desde?: string | null
          vigencia_hasta?: string | null
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          descripcion?: string | null
          estado?: string
          etiquetas?: string[] | null
          id?: string
          marca?: string | null
          nombre?: string
          updated_at?: string
          vigencia_desde?: string | null
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_archivos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_biblioteca_archivos_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_versiones"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_categorias: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number | null
          parent_id: string | null
          solo_admin: boolean
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number | null
          parent_id?: string | null
          solo_admin?: boolean
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          parent_id?: string | null
          solo_admin?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_versiones: {
        Row: {
          archivo_id: string
          created_at: string
          id: string
          mime_type: string | null
          nombre_archivo: string
          notas_cambio: string | null
          size_bytes: number | null
          storage_path: string
          subido_por: string
          version: number
        }
        Insert: {
          archivo_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nombre_archivo: string
          notas_cambio?: string | null
          size_bytes?: number | null
          storage_path: string
          subido_por: string
          version: number
        }
        Update: {
          archivo_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nombre_archivo?: string
          notas_cambio?: string | null
          size_bytes?: number | null
          storage_path?: string
          subido_por?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_versiones_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_archivos"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          doc_id: string | null
          embedding: string | null
          id: string
          model_version: string
          page: number | null
          source_type: string
          title: string | null
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          doc_id?: string | null
          embedding?: string | null
          id?: string
          model_version?: string
          page?: number | null
          source_type?: string
          title?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          doc_id?: string | null
          embedding?: string | null
          id?: string
          model_version?: string
          page?: number | null
          source_type?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_knowledge_chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "bot_knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_knowledge_docs: {
        Row: {
          bucket: string
          chunk_count: number
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          indexed_at: string | null
          source_type: string
          status: string
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bucket?: string
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          indexed_at?: string | null
          source_type?: string
          status?: string
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          indexed_at?: string | null
          source_type?: string
          status?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_lead_profiles: {
        Row: {
          assigned_salesperson: string | null
          business_phone_number_id: string | null
          cliente_nombre: string | null
          company_id: string | null
          contact_id: string | null
          contexto_negocio: Json
          conversation_id: string | null
          conversation_stage: string
          cotizacion_solicitada: boolean
          created_at: string
          empresa_nombre: string | null
          id: string
          intent: string | null
          lead_id: string | null
          municipio: string | null
          notas_comerciales: string | null
          productos_solicitados: Json
          recomendaciones: Json
          resumen: string | null
          tipo_cliente: string | null
          transferred_at: string | null
          updated_at: string
          vehiculos: Json
          wa_phone: string
          zone: string | null
        }
        Insert: {
          assigned_salesperson?: string | null
          business_phone_number_id?: string | null
          cliente_nombre?: string | null
          company_id?: string | null
          contact_id?: string | null
          contexto_negocio?: Json
          conversation_id?: string | null
          conversation_stage?: string
          cotizacion_solicitada?: boolean
          created_at?: string
          empresa_nombre?: string | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          municipio?: string | null
          notas_comerciales?: string | null
          productos_solicitados?: Json
          recomendaciones?: Json
          resumen?: string | null
          tipo_cliente?: string | null
          transferred_at?: string | null
          updated_at?: string
          vehiculos?: Json
          wa_phone: string
          zone?: string | null
        }
        Update: {
          assigned_salesperson?: string | null
          business_phone_number_id?: string | null
          cliente_nombre?: string | null
          company_id?: string | null
          contact_id?: string | null
          contexto_negocio?: Json
          conversation_id?: string | null
          conversation_stage?: string
          cotizacion_solicitada?: boolean
          created_at?: string
          empresa_nombre?: string | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          municipio?: string | null
          notas_comerciales?: string | null
          productos_solicitados?: Json
          recomendaciones?: Json
          resumen?: string | null
          tipo_cliente?: string | null
          transferred_at?: string | null
          updated_at?: string
          vehiculos?: Json
          wa_phone?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_lead_profiles_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      catalogo_externo_productos: {
        Row: {
          aplicacion: string | null
          codigo_proveedor: string | null
          created_at: string
          empaque: string | null
          empresa_vendedora: string
          familia: string | null
          id: string
          is_active: boolean
          nombre: string
          precio_lista_mxn: number | null
          precio_lista_usd: number | null
          precio_por_uom: number | null
          precio_por_uom_mxn: number | null
          precio_por_uom_usd: number | null
          uom: string | null
          updated_at: string
        }
        Insert: {
          aplicacion?: string | null
          codigo_proveedor?: string | null
          created_at?: string
          empaque?: string | null
          empresa_vendedora: string
          familia?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          precio_lista_mxn?: number | null
          precio_lista_usd?: number | null
          precio_por_uom?: number | null
          precio_por_uom_mxn?: number | null
          precio_por_uom_usd?: number | null
          uom?: string | null
          updated_at?: string
        }
        Update: {
          aplicacion?: string | null
          codigo_proveedor?: string | null
          created_at?: string
          empaque?: string | null
          empresa_vendedora?: string
          familia?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          precio_lista_mxn?: number | null
          precio_lista_usd?: number | null
          precio_por_uom?: number | null
          precio_por_uom_mxn?: number | null
          precio_por_uom_usd?: number | null
          uom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cescemex_costos_config: {
        Row: {
          anio: number
          aportacion_chevron: number
          costo_poliza_total: number
          costo_por_cliente: number
          id: string
          margen_utilidad_pct: number
          notas: string | null
          recuperacion_siniestros: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anio: number
          aportacion_chevron?: number
          costo_poliza_total?: number
          costo_por_cliente?: number
          id?: string
          margen_utilidad_pct?: number
          notas?: string | null
          recuperacion_siniestros?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anio?: number
          aportacion_chevron?: number
          costo_poliza_total?: number
          costo_por_cliente?: number
          id?: string
          margen_utilidad_pct?: number
          notas?: string | null
          recuperacion_siniestros?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cliente_solicitud_lineas: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          notas: string | null
          producto_id: string
          solicitud_id: string
        }
        Insert: {
          cantidad?: number
          created_at?: string
          id?: string
          notas?: string | null
          producto_id: string
          solicitud_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          notas?: string | null
          producto_id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_solicitud_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_solicitud_lineas_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "cliente_solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_solicitudes: {
        Row: {
          contacto_id: string | null
          created_at: string
          created_by: string | null
          documento_id: string | null
          empresa_id: string
          empresa_vendedora: string | null
          estatus: string
          id: string
          titulo: string | null
          updated_at: string
          whatsapp_conversation_id: string | null
        }
        Insert: {
          contacto_id?: string | null
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          empresa_id: string
          empresa_vendedora?: string | null
          estatus?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          whatsapp_conversation_id?: string | null
        }
        Update: {
          contacto_id?: string | null
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          empresa_id?: string
          empresa_vendedora?: string | null
          estatus?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          whatsapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_solicitudes_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_solicitudes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_solicitudes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_solicitudes_whatsapp_conversation_id_fkey"
            columns: ["whatsapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          metodo_pago: string
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
          metodo_pago?: string
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
          metodo_pago?: string
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
          clabe_bancaria: string | null
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
          limite_credito: number | null
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
          tarjeta_ultimos4: string | null
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
          clabe_bancaria?: string | null
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
          limite_credito?: number | null
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
          tarjeta_ultimos4?: string | null
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
          clabe_bancaria?: string | null
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
          limite_credito?: number | null
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
          tarjeta_ultimos4?: string | null
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
      comprobante_cliente_aliases: {
        Row: {
          alias_normalizado: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          updated_at: string
          veces_usado: number
        }
        Insert: {
          alias_normalizado: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          updated_at?: string
          veces_usado?: number
        }
        Update: {
          alias_normalizado?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          updated_at?: string
          veces_usado?: number
        }
        Relationships: [
          {
            foreignKeyName: "comprobante_cliente_aliases_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobantes_intake: {
        Row: {
          banco_extraido: string | null
          canal: Database["public"]["Enums"]["comprobante_intake_canal"]
          clabe_extraida: string | null
          clasificado_at: string | null
          clasificado_por: string | null
          cobranza_pago_id: string | null
          created_at: string
          ejecutivo_id: string
          empresa_id: string | null
          estatus: Database["public"]["Enums"]["comprobante_intake_estatus"]
          extraccion_error: string | null
          extraccion_raw: Json | null
          fecha_extraida: string | null
          id: string
          metodo_extraido: string | null
          mime_type: string | null
          monto_extraido: number | null
          nombre_archivo: string | null
          nombre_detectado: string | null
          referencia_extraida: string | null
          storage_path: string
          tarjeta_ultimos4_extraida: string | null
          updated_at: string
        }
        Insert: {
          banco_extraido?: string | null
          canal: Database["public"]["Enums"]["comprobante_intake_canal"]
          clabe_extraida?: string | null
          clasificado_at?: string | null
          clasificado_por?: string | null
          cobranza_pago_id?: string | null
          created_at?: string
          ejecutivo_id: string
          empresa_id?: string | null
          estatus?: Database["public"]["Enums"]["comprobante_intake_estatus"]
          extraccion_error?: string | null
          extraccion_raw?: Json | null
          fecha_extraida?: string | null
          id?: string
          metodo_extraido?: string | null
          mime_type?: string | null
          monto_extraido?: number | null
          nombre_archivo?: string | null
          nombre_detectado?: string | null
          referencia_extraida?: string | null
          storage_path: string
          tarjeta_ultimos4_extraida?: string | null
          updated_at?: string
        }
        Update: {
          banco_extraido?: string | null
          canal?: Database["public"]["Enums"]["comprobante_intake_canal"]
          clabe_extraida?: string | null
          clasificado_at?: string | null
          clasificado_por?: string | null
          cobranza_pago_id?: string | null
          created_at?: string
          ejecutivo_id?: string
          empresa_id?: string | null
          estatus?: Database["public"]["Enums"]["comprobante_intake_estatus"]
          extraccion_error?: string | null
          extraccion_raw?: Json | null
          fecha_extraida?: string | null
          id?: string
          metodo_extraido?: string | null
          mime_type?: string | null
          monto_extraido?: number | null
          nombre_archivo?: string | null
          nombre_detectado?: string | null
          referencia_extraida?: string | null
          storage_path?: string
          tarjeta_ultimos4_extraida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_intake_cobranza_pago_id_fkey"
            columns: ["cobranza_pago_id"]
            isOneToOne: false
            referencedRelation: "cobranza_pagos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_intake_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          contacto_cobranza: boolean
          contacto_credito: boolean
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
          origen_lead: string | null
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
          contacto_cobranza?: boolean
          contacto_credito?: boolean
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
          origen_lead?: string | null
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
          contacto_cobranza?: boolean
          contacto_credito?: boolean
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
          origen_lead?: string | null
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
      credit_client_sessions: {
        Row: {
          created_at: string
          credit_request_id: string
          email: string
          id: string
          otp_code: string
          otp_expires_at: string
          party_id: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          credit_request_id: string
          email: string
          id?: string
          otp_code: string
          otp_expires_at: string
          party_id?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          credit_request_id?: string
          email?: string
          id?: string
          otp_code?: string
          otp_expires_at?: string
          party_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "credit_client_sessions_credit_request_id_fkey"
            columns: ["credit_request_id"]
            isOneToOne: false
            referencedRelation: "credit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_client_sessions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "credit_request_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_doc_templates: {
        Row: {
          activo: boolean
          contenido_html: string
          created_at: string
          entidad: string
          footer_html: string | null
          header_html: string | null
          id: string
          key: string
          margenes: Json
          nombre: string
          pagina_tamano: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          contenido_html?: string
          created_at?: string
          entidad?: string
          footer_html?: string | null
          header_html?: string | null
          id?: string
          key: string
          margenes?: Json
          nombre: string
          pagina_tamano?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          contenido_html?: string
          created_at?: string
          entidad?: string
          footer_html?: string | null
          header_html?: string | null
          id?: string
          key?: string
          margenes?: Json
          nombre?: string
          pagina_tamano?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      credit_doc_types: {
        Row: {
          aplica_cescemex: boolean
          aplica_directo: boolean
          aplica_fisica: boolean
          aplica_moral: boolean
          aplica_si_aval_distinto: boolean
          created_at: string
          descripcion: string | null
          id: string
          instrucciones_cliente: string | null
          is_active: boolean
          nombre: string
          permite_multiples: boolean
          requerido: boolean
          sort_order: number
          updated_at: string
          validez_tipo: string
          vigencia_dias: number | null
        }
        Insert: {
          aplica_cescemex?: boolean
          aplica_directo?: boolean
          aplica_fisica?: boolean
          aplica_moral?: boolean
          aplica_si_aval_distinto?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          instrucciones_cliente?: string | null
          is_active?: boolean
          nombre: string
          permite_multiples?: boolean
          requerido?: boolean
          sort_order?: number
          updated_at?: string
          validez_tipo?: string
          vigencia_dias?: number | null
        }
        Update: {
          aplica_cescemex?: boolean
          aplica_directo?: boolean
          aplica_fisica?: boolean
          aplica_moral?: boolean
          aplica_si_aval_distinto?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          instrucciones_cliente?: string | null
          is_active?: boolean
          nombre?: string
          permite_multiples?: boolean
          requerido?: boolean
          sort_order?: number
          updated_at?: string
          validez_tipo?: string
          vigencia_dias?: number | null
        }
        Relationships: []
      }
      credit_request_comments: {
        Row: {
          contenido: string
          created_at: string
          credit_request_id: string
          id: string
          party_id: string | null
          user_id: string | null
          visibilidad: Database["public"]["Enums"]["credito_visibilidad"]
        }
        Insert: {
          contenido: string
          created_at?: string
          credit_request_id: string
          id?: string
          party_id?: string | null
          user_id?: string | null
          visibilidad?: Database["public"]["Enums"]["credito_visibilidad"]
        }
        Update: {
          contenido?: string
          created_at?: string
          credit_request_id?: string
          id?: string
          party_id?: string | null
          user_id?: string | null
          visibilidad?: Database["public"]["Enums"]["credito_visibilidad"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_request_comments_credit_request_id_fkey"
            columns: ["credit_request_id"]
            isOneToOne: false
            referencedRelation: "credit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_request_comments_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "credit_request_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_request_docs: {
        Row: {
          aprobado_fecha: string | null
          aprobado_por: string | null
          created_at: string
          credit_request_id: string
          doc_type_id: string | null
          estado: Database["public"]["Enums"]["credito_doc_estado"]
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: string
          metadata: Json
          nombre_archivo: string | null
          nombre_personalizado: string | null
          notas_rechazo: string | null
          party_id: string | null
          subido_por: string | null
          subido_por_cliente: boolean
          tipo_archivo: string | null
          updated_at: string
          url_archivo: string | null
          visibilidad: Database["public"]["Enums"]["credito_visibilidad"]
        }
        Insert: {
          aprobado_fecha?: string | null
          aprobado_por?: string | null
          created_at?: string
          credit_request_id: string
          doc_type_id?: string | null
          estado?: Database["public"]["Enums"]["credito_doc_estado"]
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          metadata?: Json
          nombre_archivo?: string | null
          nombre_personalizado?: string | null
          notas_rechazo?: string | null
          party_id?: string | null
          subido_por?: string | null
          subido_por_cliente?: boolean
          tipo_archivo?: string | null
          updated_at?: string
          url_archivo?: string | null
          visibilidad?: Database["public"]["Enums"]["credito_visibilidad"]
        }
        Update: {
          aprobado_fecha?: string | null
          aprobado_por?: string | null
          created_at?: string
          credit_request_id?: string
          doc_type_id?: string | null
          estado?: Database["public"]["Enums"]["credito_doc_estado"]
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          metadata?: Json
          nombre_archivo?: string | null
          nombre_personalizado?: string | null
          notas_rechazo?: string | null
          party_id?: string | null
          subido_por?: string | null
          subido_por_cliente?: boolean
          tipo_archivo?: string | null
          updated_at?: string
          url_archivo?: string | null
          visibilidad?: Database["public"]["Enums"]["credito_visibilidad"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_request_docs_credit_request_id_fkey"
            columns: ["credit_request_id"]
            isOneToOne: false
            referencedRelation: "credit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_request_docs_doc_type_id_fkey"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "credit_doc_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_request_docs_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "credit_request_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_request_history: {
        Row: {
          created_at: string
          credit_request_id: string
          estado_anterior: Database["public"]["Enums"]["credito_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["credito_estado"]
          id: string
          nota: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credit_request_id: string
          estado_anterior?: Database["public"]["Enums"]["credito_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["credito_estado"]
          id?: string
          nota?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credit_request_id?: string
          estado_anterior?: Database["public"]["Enums"]["credito_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["credito_estado"]
          id?: string
          nota?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_request_history_credit_request_id_fkey"
            columns: ["credit_request_id"]
            isOneToOne: false
            referencedRelation: "credit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_request_parties: {
        Row: {
          client_token: string
          created_at: string
          credit_request_id: string
          email: string
          id: string
          nombre: string
          rol_descripcion: string | null
          ultimo_acceso: string | null
        }
        Insert: {
          client_token?: string
          created_at?: string
          credit_request_id: string
          email: string
          id?: string
          nombre: string
          rol_descripcion?: string | null
          ultimo_acceso?: string | null
        }
        Update: {
          client_token?: string
          created_at?: string
          credit_request_id?: string
          email?: string
          id?: string
          nombre?: string
          rol_descripcion?: string | null
          ultimo_acceso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_request_parties_credit_request_id_fkey"
            columns: ["credit_request_id"]
            isOneToOne: false
            referencedRelation: "credit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_request_responsables: {
        Row: {
          assigned_by: string | null
          created_at: string
          credit_request_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          credit_request_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          credit_request_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_request_responsables_credit_request_id_fkey"
            columns: ["credit_request_id"]
            isOneToOne: false
            referencedRelation: "credit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_requests: {
        Row: {
          accionistas: Json
          administrador_presidente: string | null
          antiguedad: string | null
          assigned_credito: string | null
          assigned_cs: string | null
          aval_ciudad: string | null
          aval_direccion: string | null
          aval_es_distinto: boolean
          aval_nombre: string | null
          aval_regimen_conyugal: string | null
          aval_relacion: string | null
          bc_confirmacion_no_existe: boolean
          bc_data: Json
          bc_es_representante_legal: boolean | null
          bc_tipo_persona: string | null
          cescemex_fecha: string | null
          cescemex_resultado: string | null
          cescemex_share_expires_at: string | null
          cescemex_share_token: string | null
          ciudad_comercial: string | null
          ciudad_fiscal: string | null
          client_email: string | null
          client_nombre_contacto: string | null
          client_token: string
          company_id: string
          contact_id: string | null
          correo_contacto: string | null
          created_at: string
          created_by: string | null
          csf_actividad_economica: string | null
          csf_cp: string | null
          csf_domicilio: string | null
          csf_fecha_inicio_operaciones: string | null
          csf_parseado: boolean
          csf_razon_social: string | null
          csf_regimen_fiscal: string | null
          csf_rfc: string | null
          csf_tipo_persona: string | null
          datos_bancarios: Json
          datos_registro: string | null
          dias_credito: number | null
          direccion_aprobo: boolean
          direccion_aprobo_fecha: string | null
          direccion_aprobo_por: string | null
          domicilio_comercial: string | null
          domicilio_fiscal: string | null
          escritura_constitutiva: string | null
          estado: Database["public"]["Enums"]["credito_estado"]
          estado_cuenta_requerido: boolean
          estado_fiscal: string | null
          fecha_activacion: string | null
          fecha_contrato_enviado: string | null
          fecha_contrato_firmado: string | null
          fecha_limite: string | null
          firma_buro_doc_id: string | null
          firma_buro_fecha: string | null
          firma_buro_nombre: string | null
          firma_confidencialidad_doc_id: string | null
          firma_confidencialidad_fecha: string | null
          firma_confidencialidad_nombre: string | null
          firma_lfpiorpi_doc_id: string | null
          firma_lfpiorpi_fecha: string | null
          firma_lfpiorpi_nombre: string | null
          firma_solicitud_doc_id: string | null
          firma_solicitud_fecha: string | null
          firma_solicitud_galsa_doc_id: string | null
          firma_solicitud_galsa_fecha: string | null
          firma_solicitud_galsa_nombre: string | null
          firma_solicitud_lumaggs_doc_id: string | null
          firma_solicitud_lumaggs_fecha: string | null
          firma_solicitud_lumaggs_nombre: string | null
          firma_solicitud_nombre: string | null
          firma_subsistencia_doc_id: string | null
          firma_subsistencia_fecha: string | null
          firma_subsistencia_nombre: string | null
          folio: string | null
          giro_comercial: string | null
          id: string
          lfpiorpi_beneficiario_controlador: boolean | null
          lfpiorpi_fecha_firma: string | null
          lfpiorpi_lugar_firma: string | null
          lfpiorpi_tiene_documentacion: boolean | null
          lista_69_fecha: string | null
          lista_69_ok: boolean | null
          lista_69_por: string | null
          monto_solicitado: number | null
          monto_solicitado_galsa: number | null
          monto_solicitado_lumaggs: number | null
          motivo_rechazo: string | null
          nombre_comercial: string | null
          poder_en_acta_constitutiva: boolean | null
          poder_representante_requerido: boolean
          promedio_unidades_mensuales: number | null
          razon_social: string | null
          recordatorio_count: number
          referencias_comerciales: Json
          registro_publico_requerido: boolean
          rep_legal_curp: string | null
          rep_legal_fecha_nacimiento: string | null
          rep_legal_nombre: string | null
          rep_legal_num_id: string | null
          rep_legal_pais_nacimiento: string | null
          rep_legal_rfc: string | null
          rep_legal_tipo_id: string | null
          rep_legal_vencimiento_id: string | null
          resumen_empresa: string | null
          resumen_empresa_data: Json | null
          resumen_empresa_generated_at: string | null
          resumen_empresa_generated_by: string | null
          rfc: string | null
          rpp_aval_data: Json
          rpp_aval_doc_path: string | null
          rpp_aval_encontrado: boolean | null
          rpp_solicitante_data: Json
          rpp_solicitante_doc_path: string | null
          rpp_solicitante_encontrado: boolean | null
          short_code: string | null
          solicita_galsa: boolean
          solicita_lumaggs: boolean
          sync_correo_contacto: boolean
          sync_telefono_contacto: boolean
          telefono: string | null
          tipo: Database["public"]["Enums"]["credito_tipo"] | null
          tipo_persona: string | null
          ultima_asamblea: string | null
          ultimo_recordatorio_enviado: string | null
          updated_at: string
        }
        Insert: {
          accionistas?: Json
          administrador_presidente?: string | null
          antiguedad?: string | null
          assigned_credito?: string | null
          assigned_cs?: string | null
          aval_ciudad?: string | null
          aval_direccion?: string | null
          aval_es_distinto?: boolean
          aval_nombre?: string | null
          aval_regimen_conyugal?: string | null
          aval_relacion?: string | null
          bc_confirmacion_no_existe?: boolean
          bc_data?: Json
          bc_es_representante_legal?: boolean | null
          bc_tipo_persona?: string | null
          cescemex_fecha?: string | null
          cescemex_resultado?: string | null
          cescemex_share_expires_at?: string | null
          cescemex_share_token?: string | null
          ciudad_comercial?: string | null
          ciudad_fiscal?: string | null
          client_email?: string | null
          client_nombre_contacto?: string | null
          client_token?: string
          company_id: string
          contact_id?: string | null
          correo_contacto?: string | null
          created_at?: string
          created_by?: string | null
          csf_actividad_economica?: string | null
          csf_cp?: string | null
          csf_domicilio?: string | null
          csf_fecha_inicio_operaciones?: string | null
          csf_parseado?: boolean
          csf_razon_social?: string | null
          csf_regimen_fiscal?: string | null
          csf_rfc?: string | null
          csf_tipo_persona?: string | null
          datos_bancarios?: Json
          datos_registro?: string | null
          dias_credito?: number | null
          direccion_aprobo?: boolean
          direccion_aprobo_fecha?: string | null
          direccion_aprobo_por?: string | null
          domicilio_comercial?: string | null
          domicilio_fiscal?: string | null
          escritura_constitutiva?: string | null
          estado?: Database["public"]["Enums"]["credito_estado"]
          estado_cuenta_requerido?: boolean
          estado_fiscal?: string | null
          fecha_activacion?: string | null
          fecha_contrato_enviado?: string | null
          fecha_contrato_firmado?: string | null
          fecha_limite?: string | null
          firma_buro_doc_id?: string | null
          firma_buro_fecha?: string | null
          firma_buro_nombre?: string | null
          firma_confidencialidad_doc_id?: string | null
          firma_confidencialidad_fecha?: string | null
          firma_confidencialidad_nombre?: string | null
          firma_lfpiorpi_doc_id?: string | null
          firma_lfpiorpi_fecha?: string | null
          firma_lfpiorpi_nombre?: string | null
          firma_solicitud_doc_id?: string | null
          firma_solicitud_fecha?: string | null
          firma_solicitud_galsa_doc_id?: string | null
          firma_solicitud_galsa_fecha?: string | null
          firma_solicitud_galsa_nombre?: string | null
          firma_solicitud_lumaggs_doc_id?: string | null
          firma_solicitud_lumaggs_fecha?: string | null
          firma_solicitud_lumaggs_nombre?: string | null
          firma_solicitud_nombre?: string | null
          firma_subsistencia_doc_id?: string | null
          firma_subsistencia_fecha?: string | null
          firma_subsistencia_nombre?: string | null
          folio?: string | null
          giro_comercial?: string | null
          id?: string
          lfpiorpi_beneficiario_controlador?: boolean | null
          lfpiorpi_fecha_firma?: string | null
          lfpiorpi_lugar_firma?: string | null
          lfpiorpi_tiene_documentacion?: boolean | null
          lista_69_fecha?: string | null
          lista_69_ok?: boolean | null
          lista_69_por?: string | null
          monto_solicitado?: number | null
          monto_solicitado_galsa?: number | null
          monto_solicitado_lumaggs?: number | null
          motivo_rechazo?: string | null
          nombre_comercial?: string | null
          poder_en_acta_constitutiva?: boolean | null
          poder_representante_requerido?: boolean
          promedio_unidades_mensuales?: number | null
          razon_social?: string | null
          recordatorio_count?: number
          referencias_comerciales?: Json
          registro_publico_requerido?: boolean
          rep_legal_curp?: string | null
          rep_legal_fecha_nacimiento?: string | null
          rep_legal_nombre?: string | null
          rep_legal_num_id?: string | null
          rep_legal_pais_nacimiento?: string | null
          rep_legal_rfc?: string | null
          rep_legal_tipo_id?: string | null
          rep_legal_vencimiento_id?: string | null
          resumen_empresa?: string | null
          resumen_empresa_data?: Json | null
          resumen_empresa_generated_at?: string | null
          resumen_empresa_generated_by?: string | null
          rfc?: string | null
          rpp_aval_data?: Json
          rpp_aval_doc_path?: string | null
          rpp_aval_encontrado?: boolean | null
          rpp_solicitante_data?: Json
          rpp_solicitante_doc_path?: string | null
          rpp_solicitante_encontrado?: boolean | null
          short_code?: string | null
          solicita_galsa?: boolean
          solicita_lumaggs?: boolean
          sync_correo_contacto?: boolean
          sync_telefono_contacto?: boolean
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["credito_tipo"] | null
          tipo_persona?: string | null
          ultima_asamblea?: string | null
          ultimo_recordatorio_enviado?: string | null
          updated_at?: string
        }
        Update: {
          accionistas?: Json
          administrador_presidente?: string | null
          antiguedad?: string | null
          assigned_credito?: string | null
          assigned_cs?: string | null
          aval_ciudad?: string | null
          aval_direccion?: string | null
          aval_es_distinto?: boolean
          aval_nombre?: string | null
          aval_regimen_conyugal?: string | null
          aval_relacion?: string | null
          bc_confirmacion_no_existe?: boolean
          bc_data?: Json
          bc_es_representante_legal?: boolean | null
          bc_tipo_persona?: string | null
          cescemex_fecha?: string | null
          cescemex_resultado?: string | null
          cescemex_share_expires_at?: string | null
          cescemex_share_token?: string | null
          ciudad_comercial?: string | null
          ciudad_fiscal?: string | null
          client_email?: string | null
          client_nombre_contacto?: string | null
          client_token?: string
          company_id?: string
          contact_id?: string | null
          correo_contacto?: string | null
          created_at?: string
          created_by?: string | null
          csf_actividad_economica?: string | null
          csf_cp?: string | null
          csf_domicilio?: string | null
          csf_fecha_inicio_operaciones?: string | null
          csf_parseado?: boolean
          csf_razon_social?: string | null
          csf_regimen_fiscal?: string | null
          csf_rfc?: string | null
          csf_tipo_persona?: string | null
          datos_bancarios?: Json
          datos_registro?: string | null
          dias_credito?: number | null
          direccion_aprobo?: boolean
          direccion_aprobo_fecha?: string | null
          direccion_aprobo_por?: string | null
          domicilio_comercial?: string | null
          domicilio_fiscal?: string | null
          escritura_constitutiva?: string | null
          estado?: Database["public"]["Enums"]["credito_estado"]
          estado_cuenta_requerido?: boolean
          estado_fiscal?: string | null
          fecha_activacion?: string | null
          fecha_contrato_enviado?: string | null
          fecha_contrato_firmado?: string | null
          fecha_limite?: string | null
          firma_buro_doc_id?: string | null
          firma_buro_fecha?: string | null
          firma_buro_nombre?: string | null
          firma_confidencialidad_doc_id?: string | null
          firma_confidencialidad_fecha?: string | null
          firma_confidencialidad_nombre?: string | null
          firma_lfpiorpi_doc_id?: string | null
          firma_lfpiorpi_fecha?: string | null
          firma_lfpiorpi_nombre?: string | null
          firma_solicitud_doc_id?: string | null
          firma_solicitud_fecha?: string | null
          firma_solicitud_galsa_doc_id?: string | null
          firma_solicitud_galsa_fecha?: string | null
          firma_solicitud_galsa_nombre?: string | null
          firma_solicitud_lumaggs_doc_id?: string | null
          firma_solicitud_lumaggs_fecha?: string | null
          firma_solicitud_lumaggs_nombre?: string | null
          firma_solicitud_nombre?: string | null
          firma_subsistencia_doc_id?: string | null
          firma_subsistencia_fecha?: string | null
          firma_subsistencia_nombre?: string | null
          folio?: string | null
          giro_comercial?: string | null
          id?: string
          lfpiorpi_beneficiario_controlador?: boolean | null
          lfpiorpi_fecha_firma?: string | null
          lfpiorpi_lugar_firma?: string | null
          lfpiorpi_tiene_documentacion?: boolean | null
          lista_69_fecha?: string | null
          lista_69_ok?: boolean | null
          lista_69_por?: string | null
          monto_solicitado?: number | null
          monto_solicitado_galsa?: number | null
          monto_solicitado_lumaggs?: number | null
          motivo_rechazo?: string | null
          nombre_comercial?: string | null
          poder_en_acta_constitutiva?: boolean | null
          poder_representante_requerido?: boolean
          promedio_unidades_mensuales?: number | null
          razon_social?: string | null
          recordatorio_count?: number
          referencias_comerciales?: Json
          registro_publico_requerido?: boolean
          rep_legal_curp?: string | null
          rep_legal_fecha_nacimiento?: string | null
          rep_legal_nombre?: string | null
          rep_legal_num_id?: string | null
          rep_legal_pais_nacimiento?: string | null
          rep_legal_rfc?: string | null
          rep_legal_tipo_id?: string | null
          rep_legal_vencimiento_id?: string | null
          resumen_empresa?: string | null
          resumen_empresa_data?: Json | null
          resumen_empresa_generated_at?: string | null
          resumen_empresa_generated_by?: string | null
          rfc?: string | null
          rpp_aval_data?: Json
          rpp_aval_doc_path?: string | null
          rpp_aval_encontrado?: boolean | null
          rpp_solicitante_data?: Json
          rpp_solicitante_doc_path?: string | null
          rpp_solicitante_encontrado?: boolean | null
          short_code?: string | null
          solicita_galsa?: boolean
          solicita_lumaggs?: boolean
          sync_correo_contacto?: boolean
          sync_telefono_contacto?: boolean
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["credito_tipo"] | null
          tipo_persona?: string | null
          ultima_asamblea?: string | null
          ultimo_recordatorio_enviado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_firma_buro_doc_id_fkey"
            columns: ["firma_buro_doc_id"]
            isOneToOne: false
            referencedRelation: "credit_request_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_firma_confidencialidad_doc_id_fkey"
            columns: ["firma_confidencialidad_doc_id"]
            isOneToOne: false
            referencedRelation: "credit_request_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_firma_lfpiorpi_doc_id_fkey"
            columns: ["firma_lfpiorpi_doc_id"]
            isOneToOne: false
            referencedRelation: "credit_request_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_firma_solicitud_doc_id_fkey"
            columns: ["firma_solicitud_doc_id"]
            isOneToOne: false
            referencedRelation: "credit_request_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_firma_subsistencia_doc_id_fkey"
            columns: ["firma_subsistencia_doc_id"]
            isOneToOne: false
            referencedRelation: "credit_request_docs"
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
          description: string | null
          destinatario_phone: string | null
          documento_id: string | null
          id: string
          message_type: string | null
          seguimiento_venta_id: string | null
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
          description?: string | null
          destinatario_phone?: string | null
          documento_id?: string | null
          id?: string
          message_type?: string | null
          seguimiento_venta_id?: string | null
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
          description?: string | null
          destinatario_phone?: string | null
          documento_id?: string | null
          id?: string
          message_type?: string | null
          seguimiento_venta_id?: string | null
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
            foreignKeyName: "crm_activities_seguimiento_venta_id_fkey"
            columns: ["seguimiento_venta_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_ventas"
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
      crm_activity_seguimiento: {
        Row: {
          activity_id: string
          created_at: string
          seguimiento_venta_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          seguimiento_venta_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          seguimiento_venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_seguimiento_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "crm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_seguimiento_seguimiento_venta_id_fkey"
            columns: ["seguimiento_venta_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_ventas"
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
        ]
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
      crm_task_seguimiento: {
        Row: {
          created_at: string
          seguimiento_venta_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          seguimiento_venta_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          seguimiento_venta_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_seguimiento_seguimiento_venta_id_fkey"
            columns: ["seguimiento_venta_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_seguimiento_task_id_fkey"
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
          description: string | null
          due_date: string | null
          id: string
          mensaje_sugerido: string | null
          origen_tarea_id: string | null
          parent_category: string | null
          parent_task_id: string | null
          priority: string
          programable_entrega: boolean
          recurrence: string
          reschedule_count: number
          reschedule_reason: string | null
          seguimiento_venta_id: string | null
          sequence_order: number | null
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
          description?: string | null
          due_date?: string | null
          id?: string
          mensaje_sugerido?: string | null
          origen_tarea_id?: string | null
          parent_category?: string | null
          parent_task_id?: string | null
          priority?: string
          programable_entrega?: boolean
          recurrence?: string
          reschedule_count?: number
          reschedule_reason?: string | null
          seguimiento_venta_id?: string | null
          sequence_order?: number | null
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
          description?: string | null
          due_date?: string | null
          id?: string
          mensaje_sugerido?: string | null
          origen_tarea_id?: string | null
          parent_category?: string | null
          parent_task_id?: string | null
          priority?: string
          programable_entrega?: boolean
          recurrence?: string
          reschedule_count?: number
          reschedule_reason?: string | null
          seguimiento_venta_id?: string | null
          sequence_order?: number | null
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
            foreignKeyName: "crm_tasks_origen_tarea_id_fkey"
            columns: ["origen_tarea_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_seguimiento_venta_id_fkey"
            columns: ["seguimiento_venta_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_ventas"
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
          direccion_envio_id: string | null
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
          direccion_envio_id?: string | null
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
          direccion_envio_id?: string | null
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
            foreignKeyName: "documentos_direccion_envio_id_fkey"
            columns: ["direccion_envio_id"]
            isOneToOne: false
            referencedRelation: "direcciones_empresa"
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
      entregas_corporativas: {
        Row: {
          calendario_id: string | null
          cliente: string
          creado_por: string | null
          created_at: string
          estatus: string
          evidencia_firmada_path: string | null
          factura_referencia: string | null
          fecha_programada: string
          id: string
          lugar_entrega_texto: string | null
          notas: string | null
          notificado_at: string | null
          notificado_por: string | null
          numero_pedido: string | null
          pdf_entrega_path: string | null
          ubicacion_id: string | null
          updated_at: string
        }
        Insert: {
          calendario_id?: string | null
          cliente: string
          creado_por?: string | null
          created_at?: string
          estatus?: string
          evidencia_firmada_path?: string | null
          factura_referencia?: string | null
          fecha_programada: string
          id?: string
          lugar_entrega_texto?: string | null
          notas?: string | null
          notificado_at?: string | null
          notificado_por?: string | null
          numero_pedido?: string | null
          pdf_entrega_path?: string | null
          ubicacion_id?: string | null
          updated_at?: string
        }
        Update: {
          calendario_id?: string | null
          cliente?: string
          creado_por?: string | null
          created_at?: string
          estatus?: string
          evidencia_firmada_path?: string | null
          factura_referencia?: string | null
          fecha_programada?: string
          id?: string
          lugar_entrega_texto?: string | null
          notas?: string | null
          notificado_at?: string | null
          notificado_por?: string | null
          numero_pedido?: string | null
          pdf_entrega_path?: string | null
          ubicacion_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_corporativas_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "entregas_corporativas_calendarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_corporativas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "entregas_corporativas_ubicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_corporativas_calendarios: {
        Row: {
          cliente: string
          created_at: string
          datos_extraidos: Json | null
          extraido_por_ia: boolean
          id: string
          nombre_archivo: string
          storage_path: string
          subido_por: string | null
        }
        Insert: {
          cliente: string
          created_at?: string
          datos_extraidos?: Json | null
          extraido_por_ia?: boolean
          id?: string
          nombre_archivo: string
          storage_path: string
          subido_por?: string | null
        }
        Update: {
          cliente?: string
          created_at?: string
          datos_extraidos?: Json | null
          extraido_por_ia?: boolean
          id?: string
          nombre_archivo?: string
          storage_path?: string
          subido_por?: string | null
        }
        Relationships: []
      }
      entregas_corporativas_evidencias: {
        Row: {
          created_at: string
          entrega_id: string
          id: string
          nombre_archivo: string
          storage_path: string
          subido_por: string | null
        }
        Insert: {
          created_at?: string
          entrega_id: string
          id?: string
          nombre_archivo: string
          storage_path: string
          subido_por?: string | null
        }
        Update: {
          created_at?: string
          entrega_id?: string
          id?: string
          nombre_archivo?: string
          storage_path?: string
          subido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_corporativas_evidencias_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas_corporativas"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_corporativas_lineas: {
        Row: {
          cantidad: number
          codigo_producto: string
          created_at: string
          entrega_id: string
          id: string
          nombre_producto: string | null
        }
        Insert: {
          cantidad: number
          codigo_producto: string
          created_at?: string
          entrega_id: string
          id?: string
          nombre_producto?: string | null
        }
        Update: {
          cantidad?: number
          codigo_producto?: string
          created_at?: string
          entrega_id?: string
          id?: string
          nombre_producto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_corporativas_lineas_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas_corporativas"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_corporativas_ubicaciones: {
        Row: {
          activo: boolean
          cliente: string
          created_at: string
          direccion: string | null
          id: string
          instrucciones: string | null
          lat: number | null
          lng: number | null
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cliente: string
          created_at?: string
          direccion?: string | null
          id?: string
          instrucciones?: string | null
          lat?: number | null
          lng?: number | null
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cliente?: string
          created_at?: string
          direccion?: string | null
          id?: string
          instrucciones?: string | null
          lat?: number | null
          lng?: number | null
          nombre?: string
          updated_at?: string
        }
        Relationships: []
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
          fecha_entrega_real_editada_at: string | null
          fecha_entrega_real_editada_por: string | null
          id: string
          km_desde_anterior: number | null
          notas: string | null
          orden_ruta: number
          repartidor_id: string
          ruta_id: string | null
          tiempo_estimado_min: number | null
          tiempo_real_min: number | null
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
          fecha_entrega_real_editada_at?: string | null
          fecha_entrega_real_editada_por?: string | null
          id?: string
          km_desde_anterior?: number | null
          notas?: string | null
          orden_ruta?: number
          repartidor_id: string
          ruta_id?: string | null
          tiempo_estimado_min?: number | null
          tiempo_real_min?: number | null
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
          fecha_entrega_real_editada_at?: string | null
          fecha_entrega_real_editada_por?: string | null
          id?: string
          km_desde_anterior?: number | null
          notas?: string | null
          orden_ruta?: number
          repartidor_id?: string
          ruta_id?: string | null
          tiempo_estimado_min?: number | null
          tiempo_real_min?: number | null
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
      industrias_catalog: {
        Row: {
          clave: string
          created_at: string
          etiqueta: string
          id: string
          is_active: boolean
          ordering: number
          updated_at: string
        }
        Insert: {
          clave: string
          created_at?: string
          etiqueta: string
          id?: string
          is_active?: boolean
          ordering?: number
          updated_at?: string
        }
        Update: {
          clave?: string
          created_at?: string
          etiqueta?: string
          id?: string
          is_active?: boolean
          ordering?: number
          updated_at?: string
        }
        Relationships: []
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
      inv_archivos_referencia: {
        Row: {
          created_at: string | null
          descripcion: string | null
          empresa: string | null
          es_activo: boolean | null
          estatus: string | null
          fecha_vigencia_fin: string | null
          fecha_vigencia_inicio: string | null
          id: string
          nombre_archivo: string
          notas: string | null
          registros_con_error: number | null
          registros_procesados: number | null
          storage_path: string | null
          subido_por: string | null
          tipo: string
          total_registros: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          empresa?: string | null
          es_activo?: boolean | null
          estatus?: string | null
          fecha_vigencia_fin?: string | null
          fecha_vigencia_inicio?: string | null
          id?: string
          nombre_archivo: string
          notas?: string | null
          registros_con_error?: number | null
          registros_procesados?: number | null
          storage_path?: string | null
          subido_por?: string | null
          tipo: string
          total_registros?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          empresa?: string | null
          es_activo?: boolean | null
          estatus?: string | null
          fecha_vigencia_fin?: string | null
          fecha_vigencia_inicio?: string | null
          id?: string
          nombre_archivo?: string
          notas?: string | null
          registros_con_error?: number | null
          registros_procesados?: number | null
          storage_path?: string | null
          subido_por?: string | null
          tipo?: string
          total_registros?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inv_costos_historial: {
        Row: {
          aplicado_at: string | null
          aplicado_por: string | null
          codigo_producto: string
          costo_anterior: number | null
          costo_nuevo: number | null
          empresa: string
          fuente: string | null
          id: string
          lote_id: string | null
          precio_uf1_anterior: number | null
          precio_uf1_nuevo: number | null
        }
        Insert: {
          aplicado_at?: string | null
          aplicado_por?: string | null
          codigo_producto: string
          costo_anterior?: number | null
          costo_nuevo?: number | null
          empresa: string
          fuente?: string | null
          id?: string
          lote_id?: string | null
          precio_uf1_anterior?: number | null
          precio_uf1_nuevo?: number | null
        }
        Update: {
          aplicado_at?: string | null
          aplicado_por?: string | null
          codigo_producto?: string
          costo_anterior?: number | null
          costo_nuevo?: number | null
          empresa?: string
          fuente?: string | null
          id?: string
          lote_id?: string | null
          precio_uf1_anterior?: number | null
          precio_uf1_nuevo?: number | null
        }
        Relationships: []
      }
      inv_costos_producto: {
        Row: {
          archivo_especial_id: string | null
          archivo_galper_id: string | null
          archivo_lista_id: string | null
          autorizado_at: string | null
          autorizado_por: string | null
          codigo_producto: string
          costo_anterior: number | null
          costo_efectivo: number | null
          costo_efectivo_fuente: string | null
          costo_especial: number | null
          costo_especial_fecha: string | null
          costo_galper: number | null
          costo_galper_fecha: string | null
          costo_lista: number | null
          costo_lista_fecha: string | null
          costo_manual: number | null
          costo_manual_notas: string | null
          created_at: string | null
          empresa: string
          estado: string | null
          id: string
          lote_id: string | null
          nivel_alerta: string | null
          nombre_en_archivo: string | null
          nombre_en_catalogo: string | null
          notas_autorizacion: string | null
          precio_propuesto_galper: number | null
          precio_propuesto_r1: number | null
          precio_propuesto_r2: number | null
          precio_propuesto_r3: number | null
          precio_propuesto_r4: number | null
          precio_propuesto_uf1: number | null
          precio_propuesto_uf2: number | null
          precio_propuesto_uf3: number | null
          precio_propuesto_uf4: number | null
          razones_alerta: string[] | null
          updated_at: string | null
          variacion_absoluta: number | null
          variacion_porcentual: number | null
        }
        Insert: {
          archivo_especial_id?: string | null
          archivo_galper_id?: string | null
          archivo_lista_id?: string | null
          autorizado_at?: string | null
          autorizado_por?: string | null
          codigo_producto: string
          costo_anterior?: number | null
          costo_efectivo?: number | null
          costo_efectivo_fuente?: string | null
          costo_especial?: number | null
          costo_especial_fecha?: string | null
          costo_galper?: number | null
          costo_galper_fecha?: string | null
          costo_lista?: number | null
          costo_lista_fecha?: string | null
          costo_manual?: number | null
          costo_manual_notas?: string | null
          created_at?: string | null
          empresa: string
          estado?: string | null
          id?: string
          lote_id?: string | null
          nivel_alerta?: string | null
          nombre_en_archivo?: string | null
          nombre_en_catalogo?: string | null
          notas_autorizacion?: string | null
          precio_propuesto_galper?: number | null
          precio_propuesto_r1?: number | null
          precio_propuesto_r2?: number | null
          precio_propuesto_r3?: number | null
          precio_propuesto_r4?: number | null
          precio_propuesto_uf1?: number | null
          precio_propuesto_uf2?: number | null
          precio_propuesto_uf3?: number | null
          precio_propuesto_uf4?: number | null
          razones_alerta?: string[] | null
          updated_at?: string | null
          variacion_absoluta?: number | null
          variacion_porcentual?: number | null
        }
        Update: {
          archivo_especial_id?: string | null
          archivo_galper_id?: string | null
          archivo_lista_id?: string | null
          autorizado_at?: string | null
          autorizado_por?: string | null
          codigo_producto?: string
          costo_anterior?: number | null
          costo_efectivo?: number | null
          costo_efectivo_fuente?: string | null
          costo_especial?: number | null
          costo_especial_fecha?: string | null
          costo_galper?: number | null
          costo_galper_fecha?: string | null
          costo_lista?: number | null
          costo_lista_fecha?: string | null
          costo_manual?: number | null
          costo_manual_notas?: string | null
          created_at?: string | null
          empresa?: string
          estado?: string | null
          id?: string
          lote_id?: string | null
          nivel_alerta?: string | null
          nombre_en_archivo?: string | null
          nombre_en_catalogo?: string | null
          notas_autorizacion?: string | null
          precio_propuesto_galper?: number | null
          precio_propuesto_r1?: number | null
          precio_propuesto_r2?: number | null
          precio_propuesto_r3?: number | null
          precio_propuesto_r4?: number | null
          precio_propuesto_uf1?: number | null
          precio_propuesto_uf2?: number | null
          precio_propuesto_uf3?: number | null
          precio_propuesto_uf4?: number | null
          razones_alerta?: string[] | null
          updated_at?: string | null
          variacion_absoluta?: number | null
          variacion_porcentual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_costos_producto_archivo_especial_id_fkey"
            columns: ["archivo_especial_id"]
            isOneToOne: false
            referencedRelation: "inv_archivos_referencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_costos_producto_archivo_galper_id_fkey"
            columns: ["archivo_galper_id"]
            isOneToOne: false
            referencedRelation: "inv_archivos_referencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_costos_producto_archivo_lista_id_fkey"
            columns: ["archivo_lista_id"]
            isOneToOne: false
            referencedRelation: "inv_archivos_referencia"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_costos_producto_ignorados: {
        Row: {
          codigo_producto: string
          empresa: string | null
          ignorado_at: string
          ignorado_por: string | null
          motivo: string | null
        }
        Insert: {
          codigo_producto: string
          empresa?: string | null
          ignorado_at?: string
          ignorado_por?: string | null
          motivo?: string | null
        }
        Update: {
          codigo_producto?: string
          empresa?: string | null
          ignorado_at?: string
          ignorado_por?: string | null
          motivo?: string | null
        }
        Relationships: []
      }
      inv_demanda_plaza: {
        Row: {
          almacen: string
          codigo_producto: string
          coeficiente_variacion: number | null
          created_at: string | null
          demanda_diaria_promedio: number | null
          demanda_mensual_promedio: number | null
          dias_periodo: number
          id: string
          num_meses_con_venta: number | null
          periodo_fin: string
          periodo_inicio: string
          ultima_venta: string | null
          unidades_traspaso_salida: number | null
          unidades_vendidas: number | null
          updated_at: string | null
        }
        Insert: {
          almacen: string
          codigo_producto: string
          coeficiente_variacion?: number | null
          created_at?: string | null
          demanda_diaria_promedio?: number | null
          demanda_mensual_promedio?: number | null
          dias_periodo: number
          id?: string
          num_meses_con_venta?: number | null
          periodo_fin: string
          periodo_inicio: string
          ultima_venta?: string | null
          unidades_traspaso_salida?: number | null
          unidades_vendidas?: number | null
          updated_at?: string | null
        }
        Update: {
          almacen?: string
          codigo_producto?: string
          coeficiente_variacion?: number | null
          created_at?: string | null
          demanda_diaria_promedio?: number | null
          demanda_mensual_promedio?: number | null
          dias_periodo?: number
          id?: string
          num_meses_con_venta?: number | null
          periodo_fin?: string
          periodo_inicio?: string
          ultima_venta?: string | null
          unidades_traspaso_salida?: number | null
          unidades_vendidas?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inv_fuentes_suministro: {
        Row: {
          activo: boolean
          code: string
          lead_time_dias: number
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          code: string
          lead_time_dias: number
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          code?: string
          lead_time_dias?: number
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      inv_kardex_cargas: {
        Row: {
          creado_por: string | null
          created_at: string | null
          empresa_vendedora: string
          estatus: string
          fecha_archivo: string | null
          fecha_inicio: string | null
          fecha_vencimiento: string | null
          id: string
          nombre_archivo: string
          notas: string | null
          tipo: string
          total_skus_actualizados: number | null
          total_skus_error: number | null
          total_skus_procesados: number | null
          updated_at: string | null
          url_archivo: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string | null
          empresa_vendedora: string
          estatus?: string
          fecha_archivo?: string | null
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          nombre_archivo: string
          notas?: string | null
          tipo: string
          total_skus_actualizados?: number | null
          total_skus_error?: number | null
          total_skus_procesados?: number | null
          updated_at?: string | null
          url_archivo?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string | null
          empresa_vendedora?: string
          estatus?: string
          fecha_archivo?: string | null
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          nombre_archivo?: string
          notas?: string | null
          tipo?: string
          total_skus_actualizados?: number | null
          total_skus_error?: number | null
          total_skus_procesados?: number | null
          updated_at?: string | null
          url_archivo?: string | null
        }
        Relationships: []
      }
      inv_kardex_lineas: {
        Row: {
          carga_id: string
          codigo_producto: string
          costo_promedio: number | null
          created_at: string | null
          estatus_linea: string | null
          id: string
          mensaje_error: string | null
          nombre_producto: string | null
          stock_almacen_1001: number | null
          stock_almacen_1002: number | null
          stock_almacen_1003: number | null
          stock_almacen_1004: number | null
          stock_total: number | null
          valor_total: number | null
        }
        Insert: {
          carga_id: string
          codigo_producto: string
          costo_promedio?: number | null
          created_at?: string | null
          estatus_linea?: string | null
          id?: string
          mensaje_error?: string | null
          nombre_producto?: string | null
          stock_almacen_1001?: number | null
          stock_almacen_1002?: number | null
          stock_almacen_1003?: number | null
          stock_almacen_1004?: number | null
          stock_total?: number | null
          valor_total?: number | null
        }
        Update: {
          carga_id?: string
          codigo_producto?: string
          costo_promedio?: number | null
          created_at?: string | null
          estatus_linea?: string | null
          id?: string
          mensaje_error?: string | null
          nombre_producto?: string | null
          stock_almacen_1001?: number | null
          stock_almacen_1002?: number | null
          stock_almacen_1003?: number | null
          stock_almacen_1004?: number | null
          stock_total?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_kardex_lineas_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "inv_kardex_cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_minmax: {
        Row: {
          ajustado_manualmente: boolean | null
          almacen: string
          cantidad_reorden_calc: number | null
          cantidad_reorden_efectiva: number | null
          cantidad_reorden_manual: number | null
          clasificacion_abc: string | null
          codigo_producto: string
          creado_por: string | null
          created_at: string | null
          demanda_diaria_hub: number | null
          dias_cobertura_objetivo: number | null
          dias_stock_seguridad: number | null
          id: string
          lead_time_dias: number | null
          maximo_calc: number | null
          maximo_efectivo: number | null
          maximo_manual: number | null
          minimo_calc: number | null
          minimo_efectivo: number | null
          minimo_manual: number | null
          notas: string | null
          ultima_actualizacion_calc: string | null
          updated_at: string | null
        }
        Insert: {
          ajustado_manualmente?: boolean | null
          almacen: string
          cantidad_reorden_calc?: number | null
          cantidad_reorden_efectiva?: number | null
          cantidad_reorden_manual?: number | null
          clasificacion_abc?: string | null
          codigo_producto: string
          creado_por?: string | null
          created_at?: string | null
          demanda_diaria_hub?: number | null
          dias_cobertura_objetivo?: number | null
          dias_stock_seguridad?: number | null
          id?: string
          lead_time_dias?: number | null
          maximo_calc?: number | null
          maximo_efectivo?: number | null
          maximo_manual?: number | null
          minimo_calc?: number | null
          minimo_efectivo?: number | null
          minimo_manual?: number | null
          notas?: string | null
          ultima_actualizacion_calc?: string | null
          updated_at?: string | null
        }
        Update: {
          ajustado_manualmente?: boolean | null
          almacen?: string
          cantidad_reorden_calc?: number | null
          cantidad_reorden_efectiva?: number | null
          cantidad_reorden_manual?: number | null
          clasificacion_abc?: string | null
          codigo_producto?: string
          creado_por?: string | null
          created_at?: string | null
          demanda_diaria_hub?: number | null
          dias_cobertura_objetivo?: number | null
          dias_stock_seguridad?: number | null
          id?: string
          lead_time_dias?: number | null
          maximo_calc?: number | null
          maximo_efectivo?: number | null
          maximo_manual?: number | null
          minimo_calc?: number | null
          minimo_efectivo?: number | null
          minimo_manual?: number | null
          notas?: string | null
          ultima_actualizacion_calc?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inv_niveles_inventario: {
        Row: {
          clasificacion_abc: string | null
          codigo_producto: string
          coeficiente_variacion: number | null
          consumo_hub_mensual: number | null
          costo_promedio: number | null
          created_at: string | null
          dias_cobertura: number | null
          empresa_vendedora: string
          estatus_inventario: string | null
          fecha_ultimo_kardex: string | null
          fuente_suministro: string | null
          id: string
          lead_time_dias: number | null
          nombre_producto: string | null
          piezas_por_tarima: number | null
          presentacion: string | null
          rotacion_anual: number | null
          stock_almacen_1001: number | null
          stock_almacen_1002: number | null
          stock_almacen_1003: number | null
          stock_almacen_1004: number | null
          stock_total: number | null
          unidad: string | null
          updated_at: string | null
          valor_total_inventario: number | null
          venta_mensual_promedio: number | null
        }
        Insert: {
          clasificacion_abc?: string | null
          codigo_producto: string
          coeficiente_variacion?: number | null
          consumo_hub_mensual?: number | null
          costo_promedio?: number | null
          created_at?: string | null
          dias_cobertura?: number | null
          empresa_vendedora?: string
          estatus_inventario?: string | null
          fecha_ultimo_kardex?: string | null
          fuente_suministro?: string | null
          id?: string
          lead_time_dias?: number | null
          nombre_producto?: string | null
          piezas_por_tarima?: number | null
          presentacion?: string | null
          rotacion_anual?: number | null
          stock_almacen_1001?: number | null
          stock_almacen_1002?: number | null
          stock_almacen_1003?: number | null
          stock_almacen_1004?: number | null
          stock_total?: number | null
          unidad?: string | null
          updated_at?: string | null
          valor_total_inventario?: number | null
          venta_mensual_promedio?: number | null
        }
        Update: {
          clasificacion_abc?: string | null
          codigo_producto?: string
          coeficiente_variacion?: number | null
          consumo_hub_mensual?: number | null
          costo_promedio?: number | null
          created_at?: string | null
          dias_cobertura?: number | null
          empresa_vendedora?: string
          estatus_inventario?: string | null
          fecha_ultimo_kardex?: string | null
          fuente_suministro?: string | null
          id?: string
          lead_time_dias?: number | null
          nombre_producto?: string | null
          piezas_por_tarima?: number | null
          presentacion?: string | null
          rotacion_anual?: number | null
          stock_almacen_1001?: number | null
          stock_almacen_1002?: number | null
          stock_almacen_1003?: number | null
          stock_almacen_1004?: number | null
          stock_total?: number | null
          unidad?: string | null
          updated_at?: string | null
          valor_total_inventario?: number | null
          venta_mensual_promedio?: number | null
        }
        Relationships: []
      }
      inv_pedido_archivos: {
        Row: {
          created_at: string | null
          datos_extraidos: Json | null
          extraido_por_ia: boolean | null
          id: string
          nombre_archivo: string
          pedido_id: string
          tipo_archivo: string | null
          url_archivo: string
          usuario_carga: string | null
        }
        Insert: {
          created_at?: string | null
          datos_extraidos?: Json | null
          extraido_por_ia?: boolean | null
          id?: string
          nombre_archivo: string
          pedido_id: string
          tipo_archivo?: string | null
          url_archivo: string
          usuario_carga?: string | null
        }
        Update: {
          created_at?: string | null
          datos_extraidos?: Json | null
          extraido_por_ia?: boolean | null
          id?: string
          nombre_archivo?: string
          pedido_id?: string
          tipo_archivo?: string | null
          url_archivo?: string
          usuario_carga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_pedido_archivos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "inv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_pedido_lineas: {
        Row: {
          cantidad_confirmada: number | null
          cantidad_recibida: number | null
          cantidad_solicitada: number
          codigo_producto: string
          created_at: string | null
          estatus_linea: string | null
          id: string
          moneda: string | null
          nombre_producto: string | null
          notas: string | null
          pedido_id: string
          piezas_por_tarima: number | null
          precio_neto: number | null
          precio_unitario: number | null
          presentacion: string | null
          tarimas: number | null
          unidad_pedido: string | null
          updated_at: string | null
        }
        Insert: {
          cantidad_confirmada?: number | null
          cantidad_recibida?: number | null
          cantidad_solicitada: number
          codigo_producto: string
          created_at?: string | null
          estatus_linea?: string | null
          id?: string
          moneda?: string | null
          nombre_producto?: string | null
          notas?: string | null
          pedido_id: string
          piezas_por_tarima?: number | null
          precio_neto?: number | null
          precio_unitario?: number | null
          presentacion?: string | null
          tarimas?: number | null
          unidad_pedido?: string | null
          updated_at?: string | null
        }
        Update: {
          cantidad_confirmada?: number | null
          cantidad_recibida?: number | null
          cantidad_solicitada?: number
          codigo_producto?: string
          created_at?: string | null
          estatus_linea?: string | null
          id?: string
          moneda?: string | null
          nombre_producto?: string | null
          notas?: string | null
          pedido_id?: string
          piezas_por_tarima?: number | null
          precio_neto?: number | null
          precio_unitario?: number | null
          presentacion?: string | null
          tarimas?: number | null
          unidad_pedido?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_pedido_lineas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "inv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_pedido_requerido_ignorados: {
        Row: {
          codigo_producto: string
          ignorado_at: string
          ignorado_por: string | null
          motivo: string | null
        }
        Insert: {
          codigo_producto: string
          ignorado_at?: string
          ignorado_por?: string | null
          motivo?: string | null
        }
        Update: {
          codigo_producto?: string
          ignorado_at?: string
          ignorado_por?: string | null
          motivo?: string | null
        }
        Relationships: []
      }
      inv_pedidos: {
        Row: {
          almacen_destino: string
          creado_por: string | null
          created_at: string | null
          empresa_vendedora: string
          estatus: string
          fecha_despacho: string | null
          fecha_entrega_estimada: string | null
          fecha_entrega_real: string | null
          fecha_pedido: string | null
          fuente: string | null
          generado_desde_sugeridos: boolean | null
          id: string
          moneda: string | null
          notas: string | null
          numero_orden_proveedor: string | null
          numero_po_interno: string | null
          proveedor: string
          total_monto: number | null
          total_tarimas: number | null
          updated_at: string | null
        }
        Insert: {
          almacen_destino: string
          creado_por?: string | null
          created_at?: string | null
          empresa_vendedora: string
          estatus?: string
          fecha_despacho?: string | null
          fecha_entrega_estimada?: string | null
          fecha_entrega_real?: string | null
          fecha_pedido?: string | null
          fuente?: string | null
          generado_desde_sugeridos?: boolean | null
          id?: string
          moneda?: string | null
          notas?: string | null
          numero_orden_proveedor?: string | null
          numero_po_interno?: string | null
          proveedor: string
          total_monto?: number | null
          total_tarimas?: number | null
          updated_at?: string | null
        }
        Update: {
          almacen_destino?: string
          creado_por?: string | null
          created_at?: string | null
          empresa_vendedora?: string
          estatus?: string
          fecha_despacho?: string | null
          fecha_entrega_estimada?: string | null
          fecha_entrega_real?: string | null
          fecha_pedido?: string | null
          fuente?: string | null
          generado_desde_sugeridos?: boolean | null
          id?: string
          moneda?: string | null
          notas?: string | null
          numero_orden_proveedor?: string | null
          numero_po_interno?: string | null
          proveedor?: string
          total_monto?: number | null
          total_tarimas?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inv_pedidos_activos_config: {
        Row: {
          activo: boolean | null
          auto_abrir_al_cerrar: boolean | null
          created_at: string | null
          dias_anticipacion_apertura: number | null
          fuente: string
          hub_almacen: string
          id: string
          lead_time_dias: number
          minimo_tarimas: number
          moneda: string | null
          nombre: string
          pedido_actual_id: string | null
          proveedor: string
          spokes_almacenes: string[] | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          auto_abrir_al_cerrar?: boolean | null
          created_at?: string | null
          dias_anticipacion_apertura?: number | null
          fuente: string
          hub_almacen: string
          id: string
          lead_time_dias?: number
          minimo_tarimas?: number
          moneda?: string | null
          nombre: string
          pedido_actual_id?: string | null
          proveedor: string
          spokes_almacenes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          auto_abrir_al_cerrar?: boolean | null
          created_at?: string | null
          dias_anticipacion_apertura?: number | null
          fuente?: string
          hub_almacen?: string
          id?: string
          lead_time_dias?: number
          minimo_tarimas?: number
          moneda?: string | null
          nombre?: string
          pedido_actual_id?: string | null
          proveedor?: string
          spokes_almacenes?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_pedidos_activos_config_pedido_actual_id_fkey"
            columns: ["pedido_actual_id"]
            isOneToOne: false
            referencedRelation: "inv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_producto_proveedor: {
        Row: {
          codigo_contpaqi: string
          codigo_proveedor: string
          confirmado: boolean | null
          creado_por: string | null
          created_at: string | null
          id: string
          notas: string | null
          piezas_por_tarima: number | null
          producto_id: string | null
          proveedor: string
          updated_at: string | null
        }
        Insert: {
          codigo_contpaqi: string
          codigo_proveedor: string
          confirmado?: boolean | null
          creado_por?: string | null
          created_at?: string | null
          id?: string
          notas?: string | null
          piezas_por_tarima?: number | null
          producto_id?: string | null
          proveedor: string
          updated_at?: string | null
        }
        Update: {
          codigo_contpaqi?: string
          codigo_proveedor?: string
          confirmado?: boolean | null
          creado_por?: string | null
          created_at?: string | null
          id?: string
          notas?: string | null
          piezas_por_tarima?: number | null
          producto_id?: string | null
          proveedor?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_producto_proveedor_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_recepcion_lineas: {
        Row: {
          cantidad_pedida: number
          cantidad_recibida: number
          codigo_producto: string
          created_at: string | null
          diferencia: number | null
          id: string
          nombre_producto: string | null
          notas: string | null
          pedido_linea_id: string | null
          recepcion_id: string
          tipo_diferencia: string | null
        }
        Insert: {
          cantidad_pedida: number
          cantidad_recibida?: number
          codigo_producto: string
          created_at?: string | null
          diferencia?: number | null
          id?: string
          nombre_producto?: string | null
          notas?: string | null
          pedido_linea_id?: string | null
          recepcion_id: string
          tipo_diferencia?: string | null
        }
        Update: {
          cantidad_pedida?: number
          cantidad_recibida?: number
          codigo_producto?: string
          created_at?: string | null
          diferencia?: number | null
          id?: string
          nombre_producto?: string | null
          notas?: string | null
          pedido_linea_id?: string | null
          recepcion_id?: string
          tipo_diferencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_recepcion_lineas_pedido_linea_id_fkey"
            columns: ["pedido_linea_id"]
            isOneToOne: false
            referencedRelation: "inv_pedido_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_recepcion_lineas_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "inv_recepciones"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_recepciones: {
        Row: {
          almacen_recepcion: string
          created_at: string | null
          fecha_recepcion: string
          id: string
          notas: string | null
          pedido_id: string
          recibido_por: string | null
          tiene_reclamo: boolean | null
          total_skus_con_diferencia: number | null
          total_skus_pedidos: number | null
          total_skus_recibidos_completos: number | null
          updated_at: string | null
        }
        Insert: {
          almacen_recepcion: string
          created_at?: string | null
          fecha_recepcion?: string
          id?: string
          notas?: string | null
          pedido_id: string
          recibido_por?: string | null
          tiene_reclamo?: boolean | null
          total_skus_con_diferencia?: number | null
          total_skus_pedidos?: number | null
          total_skus_recibidos_completos?: number | null
          updated_at?: string | null
        }
        Update: {
          almacen_recepcion?: string
          created_at?: string | null
          fecha_recepcion?: string
          id?: string
          notas?: string | null
          pedido_id?: string
          recibido_por?: string | null
          tiene_reclamo?: boolean | null
          total_skus_con_diferencia?: number | null
          total_skus_pedidos?: number | null
          total_skus_recibidos_completos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_recepciones_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "inv_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_reclamo_archivos: {
        Row: {
          created_at: string | null
          id: string
          nombre_archivo: string
          reclamo_id: string
          tipo_archivo: string | null
          url_archivo: string
          usuario_carga: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre_archivo: string
          reclamo_id: string
          tipo_archivo?: string | null
          url_archivo: string
          usuario_carga?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre_archivo?: string
          reclamo_id?: string
          tipo_archivo?: string | null
          url_archivo?: string
          usuario_carga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_reclamo_archivos_reclamo_id_fkey"
            columns: ["reclamo_id"]
            isOneToOne: false
            referencedRelation: "inv_reclamos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_reclamo_lineas: {
        Row: {
          cantidad_afectada: number
          codigo_producto: string
          created_at: string | null
          descripcion_problema: string | null
          id: string
          nombre_producto: string | null
          reclamo_id: string
          tipo_problema: string | null
        }
        Insert: {
          cantidad_afectada: number
          codigo_producto: string
          created_at?: string | null
          descripcion_problema?: string | null
          id?: string
          nombre_producto?: string | null
          reclamo_id: string
          tipo_problema?: string | null
        }
        Update: {
          cantidad_afectada?: number
          codigo_producto?: string
          created_at?: string | null
          descripcion_problema?: string | null
          id?: string
          nombre_producto?: string | null
          reclamo_id?: string
          tipo_problema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_reclamo_lineas_reclamo_id_fkey"
            columns: ["reclamo_id"]
            isOneToOne: false
            referencedRelation: "inv_reclamos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_reclamos: {
        Row: {
          creado_por: string | null
          created_at: string | null
          descripcion: string | null
          empresa_vendedora: string
          estatus: string
          fecha_envio_proveedor: string | null
          fecha_resolucion: string | null
          id: string
          pedido_id: string
          recepcion_id: string
          resolucion: string | null
          tipo_reclamo: string
          total_skus_afectados: number | null
          updated_at: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_vendedora: string
          estatus?: string
          fecha_envio_proveedor?: string | null
          fecha_resolucion?: string | null
          id?: string
          pedido_id: string
          recepcion_id: string
          resolucion?: string | null
          tipo_reclamo: string
          total_skus_afectados?: number | null
          updated_at?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_vendedora?: string
          estatus?: string
          fecha_envio_proveedor?: string | null
          fecha_resolucion?: string | null
          id?: string
          pedido_id?: string
          recepcion_id?: string
          resolucion?: string | null
          tipo_reclamo?: string
          total_skus_afectados?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_reclamos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "inv_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reclamos_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "inv_recepciones"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_restricciones: {
        Row: {
          activa: boolean | null
          codigo_producto: string | null
          creado_por: string | null
          created_at: string | null
          descripcion: string
          excluir_de_pedido: boolean | null
          fecha_fin: string | null
          fecha_inicio: string
          fecha_resolucion: string | null
          id: string
          marca: string | null
          notas_resolucion: string | null
          pedido_activo_id: string | null
          permitir_override: boolean | null
          resuelta: boolean | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          codigo_producto?: string | null
          creado_por?: string | null
          created_at?: string | null
          descripcion: string
          excluir_de_pedido?: boolean | null
          fecha_fin?: string | null
          fecha_inicio?: string
          fecha_resolucion?: string | null
          id?: string
          marca?: string | null
          notas_resolucion?: string | null
          pedido_activo_id?: string | null
          permitir_override?: boolean | null
          resuelta?: boolean | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          codigo_producto?: string | null
          creado_por?: string | null
          created_at?: string | null
          descripcion?: string
          excluir_de_pedido?: boolean | null
          fecha_fin?: string | null
          fecha_inicio?: string
          fecha_resolucion?: string | null
          id?: string
          marca?: string | null
          notas_resolucion?: string | null
          pedido_activo_id?: string | null
          permitir_override?: boolean | null
          resuelta?: boolean | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inv_solicitudes_extraordinarias: {
        Row: {
          activo: boolean
          cantidad: number
          codigo_producto: string | null
          created_at: string
          estatus: string
          id: string
          motivo: string
          notas_revision: string | null
          producto_descripcion: string | null
          revisado_at: string | null
          revisado_por: string | null
          solicitado_por: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cantidad: number
          codigo_producto?: string | null
          created_at?: string
          estatus?: string
          id?: string
          motivo: string
          notas_revision?: string | null
          producto_descripcion?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          solicitado_por: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cantidad?: number
          codigo_producto?: string | null
          created_at?: string
          estatus?: string
          id?: string
          motivo?: string
          notas_revision?: string | null
          producto_descripcion?: string | null
          revisado_at?: string | null
          revisado_por?: string | null
          solicitado_por?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      inv_traspaso_lineas: {
        Row: {
          cantidad_aprobada: number | null
          cantidad_enviada: number | null
          cantidad_recibida: number | null
          cantidad_sugerida: number
          codigo_producto: string
          created_at: string | null
          id: string
          minimo_destino: number | null
          motivo: string | null
          nombre_producto: string | null
          stock_destino_actual: number | null
          stock_origen_actual: number | null
          traspaso_id: string
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          cantidad_aprobada?: number | null
          cantidad_enviada?: number | null
          cantidad_recibida?: number | null
          cantidad_sugerida: number
          codigo_producto: string
          created_at?: string | null
          id?: string
          minimo_destino?: number | null
          motivo?: string | null
          nombre_producto?: string | null
          stock_destino_actual?: number | null
          stock_origen_actual?: number | null
          traspaso_id: string
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          cantidad_aprobada?: number | null
          cantidad_enviada?: number | null
          cantidad_recibida?: number | null
          cantidad_sugerida?: number
          codigo_producto?: string
          created_at?: string | null
          id?: string
          minimo_destino?: number | null
          motivo?: string | null
          nombre_producto?: string | null
          stock_destino_actual?: number | null
          stock_origen_actual?: number | null
          traspaso_id?: string
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_traspaso_lineas_traspaso_id_fkey"
            columns: ["traspaso_id"]
            isOneToOne: false
            referencedRelation: "inv_traspasos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_traspasos: {
        Row: {
          almacen_destino: string
          almacen_origen: string
          aprobado_por: string | null
          creado_por: string | null
          created_at: string | null
          es_consolidado: boolean | null
          estatus: string
          fecha_envio: string | null
          fecha_recepcion: string | null
          fecha_sugerida: string | null
          generado_automaticamente: boolean | null
          id: string
          notas: string | null
          total_skus: number | null
          updated_at: string | null
          viaje_id: string | null
        }
        Insert: {
          almacen_destino: string
          almacen_origen: string
          aprobado_por?: string | null
          creado_por?: string | null
          created_at?: string | null
          es_consolidado?: boolean | null
          estatus?: string
          fecha_envio?: string | null
          fecha_recepcion?: string | null
          fecha_sugerida?: string | null
          generado_automaticamente?: boolean | null
          id?: string
          notas?: string | null
          total_skus?: number | null
          updated_at?: string | null
          viaje_id?: string | null
        }
        Update: {
          almacen_destino?: string
          almacen_origen?: string
          aprobado_por?: string | null
          creado_por?: string | null
          created_at?: string | null
          es_consolidado?: boolean | null
          estatus?: string
          fecha_envio?: string | null
          fecha_recepcion?: string | null
          fecha_sugerida?: string | null
          generado_automaticamente?: boolean | null
          id?: string
          notas?: string | null
          total_skus?: number | null
          updated_at?: string | null
          viaje_id?: string | null
        }
        Relationships: []
      }
      lead_integration_events: {
        Row: {
          created_at: string
          error: string | null
          form_id: string | null
          id: string
          integration_id: string | null
          lead_id: string | null
          leadgen_id: string | null
          page_id: string | null
          payload: Json | null
          resultado: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          form_id?: string | null
          id?: string
          integration_id?: string | null
          lead_id?: string | null
          leadgen_id?: string | null
          page_id?: string | null
          payload?: Json | null
          resultado?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          form_id?: string | null
          id?: string
          integration_id?: string | null
          lead_id?: string | null
          leadgen_id?: string | null
          page_id?: string | null
          payload?: Json | null
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_integration_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "lead_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_integration_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_integration_forms: {
        Row: {
          created_at: string
          field_map: Json
          form_id: string
          form_name: string | null
          id: string
          integration_id: string
          is_active: boolean
          page_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_map?: Json
          form_id: string
          form_name?: string | null
          id?: string
          integration_id: string
          is_active?: boolean
          page_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_map?: Json
          form_id?: string
          form_name?: string | null
          id?: string
          integration_id?: string
          is_active?: boolean
          page_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_integration_forms_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "lead_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_integration_pages: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          is_active: boolean
          page_access_token: string | null
          page_id: string
          page_name: string | null
          subscribed_at: string | null
          token_expira_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          is_active?: boolean
          page_access_token?: string | null
          page_id: string
          page_name?: string | null
          subscribed_at?: string | null
          token_expira_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          is_active?: boolean
          page_access_token?: string | null
          page_id?: string
          page_name?: string | null
          subscribed_at?: string | null
          token_expira_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_integration_pages_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "lead_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_integrations: {
        Row: {
          automation_id: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          is_active: boolean
          nombre: string
          source_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          source_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          source_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_integrations_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_integrations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          dominio_permitido: string | null
          id: string
          is_active: boolean
          marca: string | null
          nombre: string
          notificar_whatsapp: string | null
          plaza_id: string | null
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          dominio_permitido?: string | null
          id?: string
          is_active?: boolean
          marca?: string | null
          nombre: string
          notificar_whatsapp?: string | null
          plaza_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          dominio_permitido?: string | null
          id?: string
          is_active?: boolean
          marca?: string | null
          nombre?: string
          notificar_whatsapp?: string | null
          plaza_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          alerta_enviada_at: string | null
          ciudad: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          crm_task_id: string | null
          descartado_motivo: string | null
          email: string | null
          empresa_nombre: string | null
          estado_region: string | null
          estatus: string
          id: string
          interes: string | null
          ip: string | null
          mensaje: string | null
          nombre: string
          page_url: string | null
          payload: Json
          primer_contacto_at: string | null
          referrer: string | null
          responsable_id: string | null
          source_id: string | null
          telefono: string | null
          tomado_at: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          alerta_enviada_at?: string | null
          ciudad?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          crm_task_id?: string | null
          descartado_motivo?: string | null
          email?: string | null
          empresa_nombre?: string | null
          estado_region?: string | null
          estatus?: string
          id?: string
          interes?: string | null
          ip?: string | null
          mensaje?: string | null
          nombre: string
          page_url?: string | null
          payload?: Json
          primer_contacto_at?: string | null
          referrer?: string | null
          responsable_id?: string | null
          source_id?: string | null
          telefono?: string | null
          tomado_at?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          alerta_enviada_at?: string | null
          ciudad?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          crm_task_id?: string | null
          descartado_motivo?: string | null
          email?: string | null
          empresa_nombre?: string | null
          estado_region?: string | null
          estatus?: string
          id?: string
          interes?: string | null
          ip?: string | null
          mensaje?: string | null
          nombre?: string
          page_url?: string | null
          payload?: Json
          primer_contacto_at?: string | null
          referrer?: string | null
          responsable_id?: string | null
          source_id?: string | null
          telefono?: string | null
          tomado_at?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_crm_task_id_fkey"
            columns: ["crm_task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_perdida: {
        Row: {
          activo: boolean
          color: string
          created_at: string
          id: string
          nombre: string
          orden: number
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          color?: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          color?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      plazas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      precio_clasificaciones: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          margen_r1: number
          margen_r2: number
          margen_r3: number
          margen_r4: number
          margen_uf1: number
          margen_uf2: number
          margen_uf3: number
          margen_uf4: number
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          margen_r1?: number
          margen_r2?: number
          margen_r3?: number
          margen_r4?: number
          margen_uf1?: number
          margen_uf2?: number
          margen_uf3?: number
          margen_uf4?: number
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          margen_r1?: number
          margen_r2?: number
          margen_r3?: number
          margen_r4?: number
          margen_uf1?: number
          margen_uf2?: number
          margen_uf3?: number
          margen_uf4?: number
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      precio_config_global: {
        Row: {
          created_at: string
          id: string
          is_singleton: boolean
          margen_r1: number
          margen_r2: number
          margen_r3: number
          margen_r4: number
          margen_uf1: number
          margen_uf2: number
          margen_uf3: number
          margen_uf4: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_singleton?: boolean
          margen_r1?: number
          margen_r2?: number
          margen_r3?: number
          margen_r4?: number
          margen_uf1?: number
          margen_uf2?: number
          margen_uf3?: number
          margen_uf4?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_singleton?: boolean
          margen_r1?: number
          margen_r2?: number
          margen_r3?: number
          margen_r4?: number
          margen_uf1?: number
          margen_uf2?: number
          margen_uf3?: number
          margen_uf4?: number
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
          pallet_chevron: number | null
          pallet_phillips: number | null
          unidades_equivalentes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          pallet_chevron?: number | null
          pallet_phillips?: number | null
          unidades_equivalentes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          pallet_chevron?: number | null
          pallet_phillips?: number | null
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
      producto_linea_margenes: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          linea_id: string | null
          margen_r1: number
          margen_r2: number
          margen_r3: number
          margen_r4: number
          margen_uf1: number
          margen_uf2: number
          margen_uf3: number
          margen_uf4: number
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          linea_id?: string | null
          margen_r1?: number
          margen_r2?: number
          margen_r3?: number
          margen_r4?: number
          margen_uf1?: number
          margen_uf2?: number
          margen_uf3?: number
          margen_uf4?: number
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          linea_id?: string | null
          margen_r1?: number
          margen_r2?: number
          margen_r3?: number
          margen_r4?: number
          margen_uf1?: number
          margen_uf2?: number
          margen_uf3?: number
          margen_uf4?: number
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_linea_margenes_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: true
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
          costo_confirmado_en_ultima_lista: boolean
          costo_confirmado_fecha: string | null
          costo_mercado_fecha: string | null
          costo_mercado_pendiente_baja: boolean
          costo_mercado_pendiente_desde: string | null
          costo_mercado_vigente: number | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          es_para_cotizar: boolean
          formula_id: string | null
          id: string
          is_active: boolean
          linea_id: string | null
          marca_id: string | null
          nombre_producto: string
          precio_base_uf1: number
          precio_clasificacion_id: string | null
          precio_lista_galper: number
          precio_r1: number
          precio_r2: number
          precio_r3: number
          precio_r4: number
          precio_uf2: number
          precio_uf3: number
          precio_uf4: number
          presentacion_id: string | null
          producto_base_id: string | null
          updated_at: string
          uso_id: string | null
          viscosidad_id: string | null
        }
        Insert: {
          aplicacion_id?: string | null
          categoria_id?: string | null
          codigo: string
          costo_actual?: number
          costo_confirmado_en_ultima_lista?: boolean
          costo_confirmado_fecha?: string | null
          costo_mercado_fecha?: string | null
          costo_mercado_pendiente_baja?: boolean
          costo_mercado_pendiente_desde?: string | null
          costo_mercado_vigente?: number | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          es_para_cotizar?: boolean
          formula_id?: string | null
          id?: string
          is_active?: boolean
          linea_id?: string | null
          marca_id?: string | null
          nombre_producto: string
          precio_base_uf1?: number
          precio_clasificacion_id?: string | null
          precio_lista_galper?: number
          precio_r1?: number
          precio_r2?: number
          precio_r3?: number
          precio_r4?: number
          precio_uf2?: number
          precio_uf3?: number
          precio_uf4?: number
          presentacion_id?: string | null
          producto_base_id?: string | null
          updated_at?: string
          uso_id?: string | null
          viscosidad_id?: string | null
        }
        Update: {
          aplicacion_id?: string | null
          categoria_id?: string | null
          codigo?: string
          costo_actual?: number
          costo_confirmado_en_ultima_lista?: boolean
          costo_confirmado_fecha?: string | null
          costo_mercado_fecha?: string | null
          costo_mercado_pendiente_baja?: boolean
          costo_mercado_pendiente_desde?: string | null
          costo_mercado_vigente?: number | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          es_para_cotizar?: boolean
          formula_id?: string | null
          id?: string
          is_active?: boolean
          linea_id?: string | null
          marca_id?: string | null
          nombre_producto?: string
          precio_base_uf1?: number
          precio_clasificacion_id?: string | null
          precio_lista_galper?: number
          precio_r1?: number
          precio_r2?: number
          precio_r3?: number
          precio_r4?: number
          precio_uf2?: number
          precio_uf3?: number
          precio_uf4?: number
          presentacion_id?: string | null
          producto_base_id?: string | null
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
            foreignKeyName: "productos_precio_clasificacion_id_fkey"
            columns: ["precio_clasificacion_id"]
            isOneToOne: false
            referencedRelation: "precio_clasificaciones"
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
            foreignKeyName: "productos_producto_base_id_fkey"
            columns: ["producto_base_id"]
            isOneToOne: false
            referencedRelation: "productos_base"
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
      productos_base: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          is_active: boolean
          marca_id: string | null
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          is_active?: boolean
          marca_id?: string | null
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          is_active?: boolean
          marca_id?: string | null
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_base_marca_id_fkey"
            columns: ["marca_id"]
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
          ruta_finished_at_editada_at: string | null
          ruta_finished_at_editada_por: string | null
          ruta_finished_by: string | null
          ruta_started_at: string | null
          ruta_started_at_editada_at: string | null
          ruta_started_at_editada_por: string | null
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
          ruta_finished_at_editada_at?: string | null
          ruta_finished_at_editada_por?: string | null
          ruta_finished_by?: string | null
          ruta_started_at?: string | null
          ruta_started_at_editada_at?: string | null
          ruta_started_at_editada_por?: string | null
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
          ruta_finished_at_editada_at?: string | null
          ruta_finished_at_editada_por?: string | null
          ruta_finished_by?: string | null
          ruta_started_at?: string | null
          ruta_started_at_editada_at?: string | null
          ruta_started_at_editada_por?: string | null
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
      seguimiento_estatus_catalogo: {
        Row: {
          activo: boolean
          ambito: string
          color: string
          created_at: string
          es_urgente: boolean
          familia: string
          id: string
          nombre: string
          orden: number
          umbral_max: number | null
          umbral_min: number | null
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ambito: string
          color?: string
          created_at?: string
          es_urgente?: boolean
          familia: string
          id?: string
          nombre: string
          orden?: number
          umbral_max?: number | null
          umbral_min?: number | null
          unidad: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ambito?: string
          color?: string
          created_at?: string
          es_urgente?: boolean
          familia?: string
          id?: string
          nombre?: string
          orden?: number
          umbral_max?: number | null
          umbral_min?: number | null
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      seguimiento_perdidas: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          motivo_id: string | null
          nota: string | null
          seguimiento_venta_id: string
          tipo: string
          unidades_estimadas: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          motivo_id?: string | null
          nota?: string | null
          seguimiento_venta_id: string
          tipo: string
          unidades_estimadas?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          motivo_id?: string | null
          nota?: string | null
          seguimiento_venta_id?: string
          tipo?: string
          unidades_estimadas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seguimiento_perdidas_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "motivos_perdida"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_perdidas_seguimiento_venta_id_fkey"
            columns: ["seguimiento_venta_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      seguimiento_recuperacion_ignorados: {
        Row: {
          company_id: string
          created_at: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id: string
          ignorado_at: string
          ignorado_por: string | null
          is_active: boolean
          producto_id: string
          razon: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          ignorado_at?: string
          ignorado_por?: string | null
          is_active?: boolean
          producto_id: string
          razon?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          ignorado_at?: string
          ignorado_por?: string | null
          is_active?: boolean
          producto_id?: string
          razon?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguimiento_recuperacion_ignorados_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_recuperacion_ignorados_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      seguimiento_ventas: {
        Row: {
          actividades_activas: number
          actividades_total: number
          acum_anio: number
          acum_mes: number
          acum_mes_anterior: number
          ciclo_dias: number | null
          company_id: string
          cotizaciones_total: number
          created_at: string
          dias_ultima_actividad: number | null
          dias_ultima_compra: number | null
          dias_ultima_cotizacion: number | null
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estatus_gestion_id: string | null
          estatus_manual: boolean
          estatus_manual_id: string | null
          estatus_riesgo_id: string | null
          estatus_ritmo_id: string | null
          fecha_perdida: string | null
          fecha_ultima_compra: string | null
          id: string
          motivo_perdida_id: string | null
          nota_perdida: string | null
          owner_id: string | null
          perdido: boolean
          potencial: number
          promedio_historico_mensual: number
          proxima_tarea_fecha: string | null
          ritmo_pct: number | null
          tiene_venta: boolean
          ultima_actividad_fecha: string | null
          ultima_actualizacion: string
          ultima_cotizacion_fecha: string | null
          updated_at: string
        }
        Insert: {
          actividades_activas?: number
          actividades_total?: number
          acum_anio?: number
          acum_mes?: number
          acum_mes_anterior?: number
          ciclo_dias?: number | null
          company_id: string
          cotizaciones_total?: number
          created_at?: string
          dias_ultima_actividad?: number | null
          dias_ultima_compra?: number | null
          dias_ultima_cotizacion?: number | null
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          estatus_gestion_id?: string | null
          estatus_manual?: boolean
          estatus_manual_id?: string | null
          estatus_riesgo_id?: string | null
          estatus_ritmo_id?: string | null
          fecha_perdida?: string | null
          fecha_ultima_compra?: string | null
          id?: string
          motivo_perdida_id?: string | null
          nota_perdida?: string | null
          owner_id?: string | null
          perdido?: boolean
          potencial?: number
          promedio_historico_mensual?: number
          proxima_tarea_fecha?: string | null
          ritmo_pct?: number | null
          tiene_venta?: boolean
          ultima_actividad_fecha?: string | null
          ultima_actualizacion?: string
          ultima_cotizacion_fecha?: string | null
          updated_at?: string
        }
        Update: {
          actividades_activas?: number
          actividades_total?: number
          acum_anio?: number
          acum_mes?: number
          acum_mes_anterior?: number
          ciclo_dias?: number | null
          company_id?: string
          cotizaciones_total?: number
          created_at?: string
          dias_ultima_actividad?: number | null
          dias_ultima_compra?: number | null
          dias_ultima_cotizacion?: number | null
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          estatus_gestion_id?: string | null
          estatus_manual?: boolean
          estatus_manual_id?: string | null
          estatus_riesgo_id?: string | null
          estatus_ritmo_id?: string | null
          fecha_perdida?: string | null
          fecha_ultima_compra?: string | null
          id?: string
          motivo_perdida_id?: string | null
          nota_perdida?: string | null
          owner_id?: string | null
          perdido?: boolean
          potencial?: number
          promedio_historico_mensual?: number
          proxima_tarea_fecha?: string | null
          ritmo_pct?: number | null
          tiene_venta?: boolean
          ultima_actividad_fecha?: string | null
          ultima_actualizacion?: string
          ultima_cotizacion_fecha?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguimiento_ventas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_ventas_estatus_gestion_id_fkey"
            columns: ["estatus_gestion_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_estatus_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_ventas_estatus_manual_id_fkey"
            columns: ["estatus_manual_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_estatus_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_ventas_estatus_riesgo_id_fkey"
            columns: ["estatus_riesgo_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_estatus_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_ventas_estatus_ritmo_id_fkey"
            columns: ["estatus_ritmo_id"]
            isOneToOne: false
            referencedRelation: "seguimiento_estatus_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimiento_ventas_motivo_perdida_id_fkey"
            columns: ["motivo_perdida_id"]
            isOneToOne: false
            referencedRelation: "motivos_perdida"
            referencedColumns: ["id"]
          },
        ]
      }
      seguimiento_ventas_ignorados: {
        Row: {
          company_id: string
          created_at: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id: string
          ignorado_at: string
          ignorado_por: string | null
          is_active: boolean
          razon: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          ignorado_at?: string
          ignorado_por?: string | null
          is_active?: boolean
          razon?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          empresa_vendedora?: Database["public"]["Enums"]["empresa_vendedora"]
          id?: string
          ignorado_at?: string
          ignorado_por?: string | null
          is_active?: boolean
          razon?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      short_links: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          target_url: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          target_url: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          target_url?: string
        }
        Relationships: []
      }
      solicitudes_producto: {
        Row: {
          aprobado_por: string | null
          cantidad_solicitada: number
          catalogo_producto_id: string | null
          created_at: string
          descripcion_adicional: string | null
          empresa_vendedora: string
          estatus: string
          fecha_aprobacion: string | null
          fecha_pedido: string | null
          fecha_recepcion: string | null
          fotos_urls: string[]
          id: string
          justificacion: string
          marca_externa: string | null
          motivo_rechazo: string | null
          nombre_producto: string
          notas_internas: string | null
          solicitado_por: string | null
          unidad: string
          updated_at: string
        }
        Insert: {
          aprobado_por?: string | null
          cantidad_solicitada: number
          catalogo_producto_id?: string | null
          created_at?: string
          descripcion_adicional?: string | null
          empresa_vendedora: string
          estatus?: string
          fecha_aprobacion?: string | null
          fecha_pedido?: string | null
          fecha_recepcion?: string | null
          fotos_urls?: string[]
          id?: string
          justificacion: string
          marca_externa?: string | null
          motivo_rechazo?: string | null
          nombre_producto: string
          notas_internas?: string | null
          solicitado_por?: string | null
          unidad?: string
          updated_at?: string
        }
        Update: {
          aprobado_por?: string | null
          cantidad_solicitada?: number
          catalogo_producto_id?: string | null
          created_at?: string
          descripcion_adicional?: string | null
          empresa_vendedora?: string
          estatus?: string
          fecha_aprobacion?: string | null
          fecha_pedido?: string | null
          fecha_recepcion?: string | null
          fotos_urls?: string[]
          id?: string
          justificacion?: string
          marca_externa?: string | null
          motivo_rechazo?: string | null
          nombre_producto?: string
          notas_internas?: string | null
          solicitado_por?: string | null
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_producto_catalogo_producto_id_fkey"
            columns: ["catalogo_producto_id"]
            isOneToOne: false
            referencedRelation: "catalogo_externo_productos"
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
      template_document_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_active: boolean
          mime_type: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          is_active?: boolean
          mime_type: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_active?: boolean
          mime_type?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          source_modules: string[]
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
          source_modules?: string[]
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
          source_modules?: string[]
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
          source_module: string
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
          source_module?: string
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
          source_module?: string
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
      training_courses: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          excluded_user_ids: string[]
          icon: string | null
          id: string
          is_active: boolean
          nombre: string
          obligatorio: boolean
          plaza_id: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
          url_externa: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          excluded_user_ids?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          obligatorio?: boolean
          plaza_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          url_externa?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          excluded_user_ids?: string[]
          icon?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          obligatorio?: boolean
          plaza_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          url_externa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_courses_plaza_id_fkey"
            columns: ["plaza_id"]
            isOneToOne: false
            referencedRelation: "plazas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          feedback_type: string
          id: string
          page_url: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          feedback_type: string
          id?: string
          page_url?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          feedback_type?: string
          id?: string
          page_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
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
      user_trainings: {
        Row: {
          admin_comentarios: string | null
          course_id: string
          created_at: string
          evidencia_mime: string | null
          evidencia_path: string | null
          fecha_realizacion: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["training_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comentarios?: string | null
          course_id: string
          created_at?: string
          evidencia_mime?: string | null
          evidencia_path?: string | null
          fecha_realizacion?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["training_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comentarios?: string | null
          course_id?: string
          created_at?: string
          evidencia_mime?: string | null
          evidencia_path?: string | null
          fecha_realizacion?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["training_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trainings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_upload_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          revoked: boolean
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          revoked?: boolean
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          revoked?: boolean
          token?: string
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
          ai_advisor_enabled: boolean
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
          ai_advisor_enabled?: boolean
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
          ai_advisor_enabled?: boolean
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
          unread_alert_sent_at: string | null
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
          unread_alert_sent_at?: string | null
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
          unread_alert_sent_at?: string | null
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
      whatsapp_routing_sessions: {
        Row: {
          business_phone_number_id: string
          created_at: string
          estado: string
          id: string
          mensaje_original: string | null
          telefono_destino: string | null
          updated_at: string
          wa_phone: string
          zona_seleccionada: string | null
        }
        Insert: {
          business_phone_number_id: string
          created_at?: string
          estado?: string
          id?: string
          mensaje_original?: string | null
          telefono_destino?: string | null
          updated_at?: string
          wa_phone: string
          zona_seleccionada?: string | null
        }
        Update: {
          business_phone_number_id?: string
          created_at?: string
          estado?: string
          id?: string
          mensaje_original?: string | null
          telefono_destino?: string | null
          updated_at?: string
          wa_phone?: string
          zona_seleccionada?: string | null
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
      [_ in never]: never
    }
    Functions: {
      backfill_documentos_negocio_id: { Args: never; Returns: Json }
      brand_from_empresa_vendedora: {
        Args: { _ev: Database["public"]["Enums"]["empresa_vendedora"] }
        Returns: string
      }
      calcular_precios_catalogo_externo: {
        Args: { p_clasificacion_id?: string; p_costo: number }
        Returns: Json
      }
      can_manage_automatizacion: {
        Args: { _automatizacion_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_automatizacion: {
        Args: { _automatizacion_id: string; _user_id: string }
        Returns: boolean
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
      create_short_link: {
        Args: { _expires_at?: string; _target_url: string }
        Returns: string
      }
      credit_request_completeness: { Args: { req_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_user_safe: { Args: { _user_id: string }; Returns: undefined }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_credit_short_code: { Args: never; Returns: string }
      get_admin_emails: {
        Args: never
        Returns: {
          email: string
          full_name: string
        }[]
      }
      get_company_contacts_for_cobranza: {
        Args: { p_company_id: string }
        Returns: {
          email: string
          email2: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          mobile: string
          phone: string
          whatsapp_phone: string
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
      get_or_create_upload_token: {
        Args: { _regenerate?: boolean }
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
      is_automatizacion_constructor: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_credit_request_responsable: {
        Args: { _req_id: string; _user_id: string }
        Returns: boolean
      }
      list_lead_integration_pages: {
        Args: never
        Returns: {
          created_at: string
          id: string
          integration_id: string
          is_active: boolean
          page_id: string
          page_name: string
          subscribed_at: string
          tiene_token: boolean
          token_expira_at: string
        }[]
      }
      match_bot_knowledge: {
        Args: {
          filter_source?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          page: number
          similarity: number
          source_type: string
          title: string
        }[]
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
      recalc_estatus_factura_batch: { Args: never; Returns: number }
      recalc_estatus_factura_value: {
        Args: {
          p_estatus_actual: string
          p_fecha_vencimiento: string
          p_saldo: number
          p_total: number
        }
        Returns: string
      }
      recalc_repurchase_for_company: {
        Args: {
          _empresa_id: string
          _empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
        }
        Returns: undefined
      }
      recalcular_estatus_facturas_batch: { Args: never; Returns: undefined }
      recompute_all_seguimiento_ventas: { Args: never; Returns: undefined }
      recompute_documento_cobranza: {
        Args: { _documento_id: string }
        Returns: undefined
      }
      recompute_lead_sla: { Args: never; Returns: Json }
      recompute_pago_balance: { Args: { _pago_id: string }; Returns: undefined }
      recompute_seguimiento_ventas: {
        Args: {
          _company_id: string
          _ev: Database["public"]["Enums"]["empresa_vendedora"]
        }
        Returns: undefined
      }
      repair_whatsapp_account_links: { Args: never; Returns: Json }
      resolve_credit_short_code: { Args: { code: string }; Returns: string }
      resolve_documento_negocio: {
        Args: {
          _contacto_id: string
          _created_by: string
          _empresa_id: string
          _empresa_vendedora: Database["public"]["Enums"]["empresa_vendedora"]
        }
        Returns: string
      }
      resolve_short_link: { Args: { _code: string }; Returns: string }
      resolve_template_placeholders: {
        Args: {
          _contacto_id?: string
          _documento_id?: string
          _pago_id?: string
        }
        Returns: Json
      }
      user_can_access_crm_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      user_related_counts: { Args: { _user_id: string }; Returns: Json }
      validate_credit_token: { Args: { _token: string }; Returns: string }
    }
    Enums: {
      access_level: "todos" | "equipo" | "propio" | "ninguno" | "lectura"
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
        | "whatsapp"
        | "biblioteca"
        | "credito"
        | "seguimiento_ventas"
        | "catalogo_extendido"
        | "inventario.kardex"
        | "inventario.niveles"
        | "inventario.pedidos"
        | "inventario.pedidos.sugeridos"
        | "inventario.pedidos.elaborados"
        | "inventario.pedidos.recibidos"
        | "inventario.pedidos.reclamos"
        | "inventario.mapeo"
        | "inventario.demanda"
        | "inventario.minmax"
        | "inventario.restricciones"
        | "inventario.traspasos"
        | "inventario.dashboard_red"
        | "inventario.costos"
      app_role:
        | "admin"
        | "manager"
        | "sales"
        | "delivery"
        | "warehouse"
        | "customer_service"
        | "accounting"
      approval_status: "pendiente" | "aprobado" | "rechazado"
      comprobante_intake_canal:
        | "android_share"
        | "ios_shortcut"
        | "app_manual"
        | "email"
      comprobante_intake_estatus: "pendiente" | "clasificado" | "descartado"
      cotizacion_followup_status:
        | "enviada"
        | "seguimiento_1"
        | "seguimiento_2"
        | "seguimiento_3"
        | "vencida"
        | "sin_actividad"
      credito_doc_estado: "pendiente" | "recibido" | "rechazado" | "vencido"
      credito_estado:
        | "borrador"
        | "portal_enviado"
        | "llenando_formulario"
        | "en_revision_cs"
        | "en_credito_cobranza"
        | "revision_lista_69"
        | "en_cescemex"
        | "en_direccion"
        | "en_juridico"
        | "contrato_enviado"
        | "contrato_firmado"
        | "activo"
        | "rechazado"
        | "cancelado"
      credito_tipo: "cescemex" | "directo"
      credito_visibilidad: "publica" | "interna"
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
      training_status: "pendiente" | "enviado" | "aprobado" | "rechazado"
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
      access_level: ["todos", "equipo", "propio", "ninguno", "lectura"],
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
        "whatsapp",
        "biblioteca",
        "credito",
        "seguimiento_ventas",
        "catalogo_extendido",
        "inventario.kardex",
        "inventario.niveles",
        "inventario.pedidos",
        "inventario.pedidos.sugeridos",
        "inventario.pedidos.elaborados",
        "inventario.pedidos.recibidos",
        "inventario.pedidos.reclamos",
        "inventario.mapeo",
        "inventario.demanda",
        "inventario.minmax",
        "inventario.restricciones",
        "inventario.traspasos",
        "inventario.dashboard_red",
        "inventario.costos",
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
      comprobante_intake_canal: [
        "android_share",
        "ios_shortcut",
        "app_manual",
        "email",
      ],
      comprobante_intake_estatus: ["pendiente", "clasificado", "descartado"],
      cotizacion_followup_status: [
        "enviada",
        "seguimiento_1",
        "seguimiento_2",
        "seguimiento_3",
        "vencida",
        "sin_actividad",
      ],
      credito_doc_estado: ["pendiente", "recibido", "rechazado", "vencido"],
      credito_estado: [
        "borrador",
        "portal_enviado",
        "llenando_formulario",
        "en_revision_cs",
        "en_credito_cobranza",
        "revision_lista_69",
        "en_cescemex",
        "en_direccion",
        "en_juridico",
        "contrato_enviado",
        "contrato_firmado",
        "activo",
        "rechazado",
        "cancelado",
      ],
      credito_tipo: ["cescemex", "directo"],
      credito_visibilidad: ["publica", "interna"],
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
      training_status: ["pendiente", "enviado", "aprobado", "rechazado"],
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

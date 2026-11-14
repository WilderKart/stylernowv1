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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      aceptacion_legal: {
        Row: {
          aceptado_at: string
          texto_legal_id: string
          usuario_id: string
        }
        Insert: {
          aceptado_at?: string
          texto_legal_id: string
          usuario_id: string
        }
        Update: {
          aceptado_at?: string
          texto_legal_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aceptacion_legal_texto_legal_id_fkey"
            columns: ["texto_legal_id"]
            isOneToOne: false
            referencedRelation: "texto_legal"
            referencedColumns: ["id"]
          },
        ]
      }
      aceptacion_politica_reserva: {
        Row: {
          aceptado_at: string
          cliente_id: string
          hora_inicio_reserva: string
          id: string
          monto_sena: number
          negocio_id: string
          politica: Json
          reserva_id: string
          terminos_id: string | null
          texto_aceptado: string
          version_politica: string
          zona_horaria: string
        }
        Insert: {
          aceptado_at?: string
          cliente_id: string
          hora_inicio_reserva: string
          id?: string
          monto_sena: number
          negocio_id: string
          politica: Json
          reserva_id: string
          terminos_id?: string | null
          texto_aceptado: string
          version_politica: string
          zona_horaria: string
        }
        Update: {
          aceptado_at?: string
          cliente_id?: string
          hora_inicio_reserva?: string
          id?: string
          monto_sena?: number
          negocio_id?: string
          politica?: Json
          reserva_id?: string
          terminos_id?: string | null
          texto_aceptado?: string
          version_politica?: string
          zona_horaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "aceptacion_politica_reserva_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aceptacion_politica_reserva_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aceptacion_politica_reserva_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: true
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aceptacion_politica_reserva_terminos_id_fkey"
            columns: ["terminos_id"]
            isOneToOne: false
            referencedRelation: "texto_legal"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_precio: {
        Row: {
          addon_codigo: string
          pais_codigo: string
          precio_mensual: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          addon_codigo: string
          pais_codigo: string
          precio_mensual?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          addon_codigo?: string
          pais_codigo?: string
          precio_mensual?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_precio_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
        ]
      }
      ai_accion_costo: {
        Row: {
          accion: string
          activo: boolean
          categoria: string
          costo_creditos: number
          costo_proveedor_estimado: number
          created_at: string
          id: string
          margen_pct: number
          modelo_fallback: string | null
          modelo_preferido: string | null
          nivel_ia: number
          updated_at: string
        }
        Insert: {
          accion: string
          activo?: boolean
          categoria: string
          costo_creditos: number
          costo_proveedor_estimado?: number
          created_at?: string
          id?: string
          margen_pct?: number
          modelo_fallback?: string | null
          modelo_preferido?: string | null
          nivel_ia: number
          updated_at?: string
        }
        Update: {
          accion?: string
          activo?: boolean
          categoria?: string
          costo_creditos?: number
          costo_proveedor_estimado?: number
          created_at?: string
          id?: string
          margen_pct?: number
          modelo_fallback?: string | null
          modelo_preferido?: string | null
          nivel_ia?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_conversion: {
        Row: {
          cliente_id: string
          created_at: string
          dias_desde_sugerencia: number
          id: string
          monto_atribuido: number
          negocio_id: string
          recompensa_sugerencia_id: string
          reserva_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          dias_desde_sugerencia: number
          id?: string
          monto_atribuido: number
          negocio_id: string
          recompensa_sugerencia_id: string
          reserva_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          dias_desde_sugerencia?: number
          id?: string
          monto_atribuido?: number
          negocio_id?: string
          recompensa_sugerencia_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversion_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversion_recompensa_sugerencia_id_fkey"
            columns: ["recompensa_sugerencia_id"]
            isOneToOne: false
            referencedRelation: "recompensa_sugerencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversion_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memoria_negocio: {
        Row: {
          aprobado: boolean
          categoria: string
          contenido: Json
          creado_por: string | null
          created_at: string
          id: string
          negocio_id: string
          sede_id: string | null
          version: number
          vigente: boolean
        }
        Insert: {
          aprobado?: boolean
          categoria: string
          contenido?: Json
          creado_por?: string | null
          created_at?: string
          id?: string
          negocio_id: string
          sede_id?: string | null
          version?: number
          vigente?: boolean
        }
        Update: {
          aprobado?: boolean
          categoria?: string
          contenido?: Json
          creado_por?: string | null
          created_at?: string
          id?: string
          negocio_id?: string
          sede_id?: string | null
          version?: number
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_memoria_negocio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memoria_negocio_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_modelo_config: {
        Row: {
          activo: boolean
          costo_por_millon_tokens_usd: number
          created_at: string
          id: string
          modelo_id: string
          nombre: string
          orden_preferencia: number
          proveedor: string
          requiere_credencial: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          costo_por_millon_tokens_usd?: number
          created_at?: string
          id?: string
          modelo_id: string
          nombre: string
          orden_preferencia: number
          proveedor: string
          requiere_credencial?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          costo_por_millon_tokens_usd?: number
          created_at?: string
          id?: string
          modelo_id?: string
          nombre?: string
          orden_preferencia?: number
          proveedor?: string
          requiere_credencial?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_paquete_creditos: {
        Row: {
          activo: boolean
          created_at: string
          creditos: number | null
          id: string
          nombre: string
          precio_cop: number | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          creditos?: number | null
          id?: string
          nombre: string
          precio_cop?: number | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          creditos?: number | null
          id?: string
          nombre?: string
          precio_cop?: number | null
        }
        Relationships: []
      }
      ai_prompt: {
        Row: {
          activo: boolean
          autor_id: string | null
          categoria: string
          contenido: string
          created_at: string
          id: string
          negocio_id: string | null
          nombre: string
          tipo: string
          updated_at: string
          variables: Json
          version: number
        }
        Insert: {
          activo?: boolean
          autor_id?: string | null
          categoria: string
          contenido: string
          created_at?: string
          id?: string
          negocio_id?: string | null
          nombre: string
          tipo: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Update: {
          activo?: boolean
          autor_id?: string | null
          categoria?: string
          contenido?: string
          created_at?: string
          id?: string
          negocio_id?: string | null
          nombre?: string
          tipo?: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_roi_snapshot: {
        Row: {
          conversiones_total: number
          costo_proveedor_usd: number
          created_at: string
          creditos_consumidos: number
          id: string
          interacciones_total: number
          monto_atribuido_total: number
          negocio_id: string
          periodo_fin: string
          periodo_inicio: string
          tiempo_ahorrado_minutos_estimado: number | null
        }
        Insert: {
          conversiones_total?: number
          costo_proveedor_usd?: number
          created_at?: string
          creditos_consumidos?: number
          id?: string
          interacciones_total?: number
          monto_atribuido_total?: number
          negocio_id: string
          periodo_fin: string
          periodo_inicio: string
          tiempo_ahorrado_minutos_estimado?: number | null
        }
        Update: {
          conversiones_total?: number
          costo_proveedor_usd?: number
          created_at?: string
          creditos_consumidos?: number
          id?: string
          interacciones_total?: number
          monto_atribuido_total?: number
          negocio_id?: string
          periodo_fin?: string
          periodo_inicio?: string
          tiempo_ahorrado_minutos_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_roi_snapshot_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      anuncio_evento_dedupe: {
        Row: {
          campana_id: string
          created_at: string
          dia: string
          huella: string
          tipo: string
        }
        Insert: {
          campana_id: string
          created_at?: string
          dia?: string
          huella: string
          tipo: string
        }
        Update: {
          campana_id?: string
          created_at?: string
          dia?: string
          huella?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncio_evento_dedupe_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campana_publicitaria"
            referencedColumns: ["id"]
          },
        ]
      }
      banner_home: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          imagen_url: string
          orden: number
          texto: string | null
          updated_at: string
          updated_by: string | null
          url_destino: string | null
          vigencia_desde: string | null
          vigencia_hasta: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          imagen_url: string
          orden?: number
          texto?: string | null
          updated_at?: string
          updated_by?: string | null
          url_destino?: string | null
          vigencia_desde?: string | null
          vigencia_hasta?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          imagen_url?: string
          orden?: number
          texto?: string | null
          updated_at?: string
          updated_by?: string | null
          url_destino?: string | null
          vigencia_desde?: string | null
          vigencia_hasta?: string | null
        }
        Relationships: []
      }
      beneficio_marca: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          marca_id: string
          pais: string | null
          titulo: string
          vigente_hasta: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          marca_id: string
          pais?: string | null
          titulo: string
          vigente_hasta?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          marca_id?: string
          pais?: string | null
          titulo?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficio_marca_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marca_aliada"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueo_ausencia: {
        Row: {
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo: string | null
          vinculo_id: string
        }
        Insert: {
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo?: string | null
          vinculo_id: string
        }
        Update: {
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo?: string | null
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueo_ausencia_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculo_staff_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueo_ausencia_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vista_staff_negocio"
            referencedColumns: ["vinculo_id"]
          },
        ]
      }
      campana_publicitaria: {
        Row: {
          clics: number
          created_at: string
          estado: Database["public"]["Enums"]["campana_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string
          gasto_hoy: number
          gasto_hoy_fecha: string
          gasto_total: number
          id: string
          impresiones: number
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total: number | null
          segmentacion: Json
          unidad_cobro: string
          updated_at: string
        }
        Insert: {
          clics?: number
          created_at?: string
          estado?: Database["public"]["Enums"]["campana_estado"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          formato: string
          gasto_hoy?: number
          gasto_hoy_fecha?: string
          gasto_total?: number
          id?: string
          impresiones?: number
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total?: number | null
          segmentacion?: Json
          unidad_cobro?: string
          updated_at?: string
        }
        Update: {
          clics?: number
          created_at?: string
          estado?: Database["public"]["Enums"]["campana_estado"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          formato?: string
          gasto_hoy?: number
          gasto_hoy_fecha?: string
          gasto_total?: number
          id?: string
          impresiones?: number
          negocio_id?: string
          presupuesto_diario?: number
          presupuesto_total?: number | null
          segmentacion?: Json
          unidad_cobro?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campana_publicitaria_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_movimiento: {
        Row: {
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["cashback_estado"]
          fecha_expiracion: string | null
          id: string
          monto: number
          regla_id: string
          reserva_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["cashback_estado"]
          fecha_expiracion?: string | null
          id?: string
          monto: number
          regla_id: string
          reserva_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["cashback_estado"]
          fecha_expiracion?: string | null
          id?: string
          monto?: number
          regla_id?: string
          reserva_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashback_movimiento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_movimiento_regla_id_fkey"
            columns: ["regla_id"]
            isOneToOne: false
            referencedRelation: "cashback_regla"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_movimiento_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_regla: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          limite_mensual: number | null
          negocio_id: string
          porcentaje: number
          producto_ids: string[]
          servicio_ids: string[]
          vigencia_dias: number | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          limite_mensual?: number | null
          negocio_id: string
          porcentaje: number
          producto_ids?: string[]
          servicio_ids?: string[]
          vigencia_dias?: number | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          limite_mensual?: number | null
          negocio_id?: string
          porcentaje?: number
          producto_ids?: string[]
          servicio_ids?: string[]
          vigencia_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cashback_regla_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversacion: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          negocio_id: string
          reserva_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          negocio_id: string
          reserva_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          negocio_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversacion_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversacion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversacion_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: true
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_lectura: {
        Row: {
          conversacion_id: string
          leido_hasta: string
          usuario_id: string
        }
        Insert: {
          conversacion_id: string
          leido_hasta: string
          usuario_id: string
        }
        Update: {
          conversacion_id?: string
          leido_hasta?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_lectura_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "chat_conversacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_lectura_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensaje: {
        Row: {
          autor_id: string
          autor_rol: string
          conversacion_id: string
          created_at: string
          cuerpo: string
          id: string
        }
        Insert: {
          autor_id: string
          autor_rol: string
          conversacion_id: string
          created_at?: string
          cuerpo: string
          id?: string
        }
        Update: {
          autor_id?: string
          autor_rol?: string
          conversacion_id?: string
          created_at?: string
          cuerpo?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensaje_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mensaje_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "chat_conversacion"
            referencedColumns: ["id"]
          },
        ]
      }
      ciudad_habilitada: {
        Row: {
          ciudad: string
          habilitada: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ciudad: string
          habilitada?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ciudad?: string
          habilitada?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cliente_etiqueta: {
        Row: {
          cliente_id: string
          creado_por: string
          created_at: string
          etiqueta: string
          id: string
          negocio_id: string
        }
        Insert: {
          cliente_id: string
          creado_por: string
          created_at?: string
          etiqueta: string
          id?: string
          negocio_id: string
        }
        Update: {
          cliente_id?: string
          creado_por?: string
          created_at?: string
          etiqueta?: string
          id?: string
          negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_etiqueta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_etiqueta_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_membresia: {
        Row: {
          cliente_id: string
          congelada_hasta: string | null
          created_at: string
          estado: Database["public"]["Enums"]["membresia_estado"]
          fecha_inicio: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_id: string
          updated_at: string
          usos_mes_actual: number
          usos_mes_fecha: string
        }
        Insert: {
          cliente_id: string
          congelada_hasta?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["membresia_estado"]
          fecha_inicio?: string
          fecha_proximo_cobro: string
          id?: string
          negocio_id: string
          plan_id: string
          updated_at?: string
          usos_mes_actual?: number
          usos_mes_fecha?: string
        }
        Update: {
          cliente_id?: string
          congelada_hasta?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["membresia_estado"]
          fecha_inicio?: string
          fecha_proximo_cobro?: string
          id?: string
          negocio_id?: string
          plan_id?: string
          updated_at?: string
          usos_mes_actual?: number
          usos_mes_fecha?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_membresia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_membresia_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_membresia_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membresia_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_nota: {
        Row: {
          autor_id: string
          cliente_id: string
          created_at: string
          id: string
          negocio_id: string
          texto: string
        }
        Insert: {
          autor_id: string
          cliente_id: string
          created_at?: string
          id?: string
          negocio_id: string
          texto: string
        }
        Update: {
          autor_id?: string
          cliente_id?: string
          created_at?: string
          id?: string
          negocio_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_nota_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_nota_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_preferencia: {
        Row: {
          onboarding_completo: boolean
          permiso_notificaciones: string | null
          permiso_ubicacion: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          onboarding_completo?: boolean
          permiso_notificaciones?: string | null
          permiso_ubicacion?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          onboarding_completo?: boolean
          permiso_notificaciones?: string | null
          permiso_ubicacion?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_preferencia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      comision_cambio_programado: {
        Row: {
          anulado_at: string | null
          aplicado_at: string | null
          creado_por: string
          created_at: string
          efectivo_desde: string
          id: string
          motivo: string
          negocio_id: string | null
          negocios_afectados: number | null
          pct_nuevo: number
        }
        Insert: {
          anulado_at?: string | null
          aplicado_at?: string | null
          creado_por: string
          created_at?: string
          efectivo_desde: string
          id?: string
          motivo: string
          negocio_id?: string | null
          negocios_afectados?: number | null
          pct_nuevo: number
        }
        Update: {
          anulado_at?: string | null
          aplicado_at?: string | null
          creado_por?: string
          created_at?: string
          efectivo_desde?: string
          id?: string
          motivo?: string
          negocio_id?: string | null
          negocios_afectados?: number | null
          pct_nuevo?: number
        }
        Relationships: [
          {
            foreignKeyName: "comision_cambio_programado_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      conexion_pago_evento: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          conexion_id: string
          created_at: string
          detalle: Json | null
          estado_destino: string
          estado_origen: string | null
          id: number
          negocio_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          conexion_id: string
          created_at?: string
          detalle?: Json | null
          estado_destino: string
          estado_origen?: string | null
          id?: number
          negocio_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          conexion_id?: string
          created_at?: string
          detalle?: Json | null
          estado_destino?: string
          estado_origen?: string | null
          id?: number
          negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conexion_pago_evento_conexion_id_fkey"
            columns: ["conexion_id"]
            isOneToOne: false
            referencedRelation: "conexion_pago_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      conexion_pago_negocio: {
        Row: {
          access_token_cifrado: string | null
          conectada_at: string | null
          created_at: string
          cuenta_externa_id: string | null
          entorno: string | null
          estado: string
          id: string
          negocio_id: string
          proveedor: string
          refresh_token_cifrado: string | null
          revocada_at: string | null
          scopes: string | null
          token_expira_at: string | null
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          access_token_cifrado?: string | null
          conectada_at?: string | null
          created_at?: string
          cuenta_externa_id?: string | null
          entorno?: string | null
          estado?: string
          id?: string
          negocio_id: string
          proveedor?: string
          refresh_token_cifrado?: string | null
          revocada_at?: string | null
          scopes?: string | null
          token_expira_at?: string | null
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          access_token_cifrado?: string | null
          conectada_at?: string | null
          created_at?: string
          cuenta_externa_id?: string | null
          entorno?: string | null
          estado?: string
          id?: string
          negocio_id?: string
          proveedor?: string
          refresh_token_cifrado?: string | null
          revocada_at?: string | null
          scopes?: string | null
          token_expira_at?: string | null
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conexion_pago_negocio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_plataforma: {
        Row: {
          app_version_actual: string | null
          app_version_minima: string | null
          comision_plataforma_pct_default: number
          cpc_destacado_cop: number
          cpc_pin_cop: number
          cpm_pin_cop: number
          id: boolean
          mantenimiento_activo: boolean
          mantenimiento_fin_estimado: string | null
          mantenimiento_inicio: string | null
          mantenimiento_mensaje: string | null
          politica_parcial_min_horas: number
          politica_pct_parcial_max: number
          politica_pct_parcial_min: number
          politica_total_max_horas: number
          politica_total_min_horas: number
          prueba_aviso_dias_1: number
          prueba_aviso_dias_2: number
          prueba_dias: number
          prueba_modalidad: string
          reembolso_max_intentos: number
          suscripcion_gracia_dias: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_version_actual?: string | null
          app_version_minima?: string | null
          comision_plataforma_pct_default?: number
          cpc_destacado_cop?: number
          cpc_pin_cop?: number
          cpm_pin_cop?: number
          id?: boolean
          mantenimiento_activo?: boolean
          mantenimiento_fin_estimado?: string | null
          mantenimiento_inicio?: string | null
          mantenimiento_mensaje?: string | null
          politica_parcial_min_horas?: number
          politica_pct_parcial_max?: number
          politica_pct_parcial_min?: number
          politica_total_max_horas?: number
          politica_total_min_horas?: number
          prueba_aviso_dias_1?: number
          prueba_aviso_dias_2?: number
          prueba_dias?: number
          prueba_modalidad?: string
          reembolso_max_intentos?: number
          suscripcion_gracia_dias?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_version_actual?: string | null
          app_version_minima?: string | null
          comision_plataforma_pct_default?: number
          cpc_destacado_cop?: number
          cpc_pin_cop?: number
          cpm_pin_cop?: number
          id?: boolean
          mantenimiento_activo?: boolean
          mantenimiento_fin_estimado?: string | null
          mantenimiento_inicio?: string | null
          mantenimiento_mensaje?: string | null
          politica_parcial_min_horas?: number
          politica_pct_parcial_max?: number
          politica_pct_parcial_min?: number
          politica_total_max_horas?: number
          politica_total_min_horas?: number
          prueba_aviso_dias_1?: number
          prueba_aviso_dias_2?: number
          prueba_dias?: number
          prueba_modalidad?: string
          reembolso_max_intentos?: number
          suscripcion_gracia_dias?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      consentimiento_evento: {
        Row: {
          created_at: string
          id: string
          origen: string
          otorgado: boolean
          proposito: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          origen: string
          otorgado: boolean
          proposito: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          origen?: string
          otorgado?: boolean
          proposito?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimiento_evento_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      corporativo_consumo: {
        Row: {
          created_at: string
          id: string
          miembro_id: string
          monto: number
          reserva_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          miembro_id: string
          monto?: number
          reserva_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          miembro_id?: string
          monto?: number
          reserva_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corporativo_consumo_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "corporativo_miembro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporativo_consumo_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      corporativo_cuenta: {
        Row: {
          activo: boolean
          admin_user_id: string | null
          contacto_email: string
          created_at: string
          cupos_totales: number
          id: string
          negocio_id: string | null
          nit: string | null
          nombre_empresa: string
          sedes_permitidas: string[]
          vigencia_fin: string
          vigencia_inicio: string
        }
        Insert: {
          activo?: boolean
          admin_user_id?: string | null
          contacto_email: string
          created_at?: string
          cupos_totales: number
          id?: string
          negocio_id?: string | null
          nit?: string | null
          nombre_empresa: string
          sedes_permitidas?: string[]
          vigencia_fin: string
          vigencia_inicio?: string
        }
        Update: {
          activo?: boolean
          admin_user_id?: string | null
          contacto_email?: string
          created_at?: string
          cupos_totales?: number
          id?: string
          negocio_id?: string | null
          nit?: string | null
          nombre_empresa?: string
          sedes_permitidas?: string[]
          vigencia_fin?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporativo_cuenta_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      corporativo_miembro: {
        Row: {
          activo: boolean
          cliente_id: string
          created_at: string
          cuenta_id: string
          id: string
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          created_at?: string
          cuenta_id: string
          id?: string
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          created_at?: string
          cuenta_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporativo_miembro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corporativo_miembro_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "corporativo_cuenta"
            referencedColumns: ["id"]
          },
        ]
      }
      credito_ia_consumo: {
        Row: {
          created_at: string
          creditos_consumidos: number
          funcion: string
          id: string
          negocio_id: string
          nivel: number
          saldo_restante: number
        }
        Insert: {
          created_at?: string
          creditos_consumidos: number
          funcion: string
          id?: string
          negocio_id: string
          nivel: number
          saldo_restante: number
        }
        Update: {
          created_at?: string
          creditos_consumidos?: number
          funcion?: string
          id?: string
          negocio_id?: string
          nivel?: number
          saldo_restante?: number
        }
        Relationships: [
          {
            foreignKeyName: "credito_ia_consumo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      credito_ia_lote: {
        Row: {
          cantidad: number
          cantidad_disponible: number
          created_at: string
          fecha_expiracion: string
          fecha_otorgamiento: string
          id: string
          negocio_id: string
          origen: string
        }
        Insert: {
          cantidad: number
          cantidad_disponible: number
          created_at?: string
          fecha_expiracion: string
          fecha_otorgamiento?: string
          id?: string
          negocio_id: string
          origen: string
        }
        Update: {
          cantidad?: number
          cantidad_disponible?: number
          created_at?: string
          fecha_expiracion?: string
          fecha_otorgamiento?: string
          id?: string
          negocio_id?: string
          origen?: string
        }
        Relationships: [
          {
            foreignKeyName: "credito_ia_lote_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidad: {
        Row: {
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          id: string
          sede_id: string
          vinculo_id: string
        }
        Insert: {
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          id?: string
          sede_id: string
          vinculo_id: string
        }
        Update: {
          dia_semana?: number
          hora_fin?: string
          hora_inicio?: string
          id?: string
          sede_id?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidad_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disponibilidad_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculo_staff_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disponibilidad_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vista_staff_negocio"
            referencedColumns: ["vinculo_id"]
          },
        ]
      }
      egreso_caja: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          categoria: string
          concepto: string
          created_at: string
          fecha: string
          id: string
          monto: number
          negocio_id: string
          registrado_por: string
          sede_id: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          categoria?: string
          concepto: string
          created_at?: string
          fecha?: string
          id?: string
          monto: number
          negocio_id: string
          registrado_por: string
          sede_id: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          categoria?: string
          concepto?: string
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          negocio_id?: string
          registrado_por?: string
          sede_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "egreso_caja_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egreso_caja_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          actor_tipo: string
          created_at: string
          entidad_id: string | null
          entidad_tipo: string
          id: string
          impersonated_by: string | null
          motivo: string | null
          negocio_id: string | null
          origen: string | null
          payload_antes: Json | null
          payload_despues: Json | null
          request_id: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_tipo: string
          created_at?: string
          entidad_id?: string | null
          entidad_tipo: string
          id?: string
          impersonated_by?: string | null
          motivo?: string | null
          negocio_id?: string | null
          origen?: string | null
          payload_antes?: Json | null
          payload_despues?: Json | null
          request_id?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_tipo?: string
          created_at?: string
          entidad_id?: string | null
          entidad_tipo?: string
          id?: string
          impersonated_by?: string | null
          motivo?: string | null
          negocio_id?: string | null
          origen?: string | null
          payload_antes?: Json | null
          payload_despues?: Json | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_auditoria_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_pipeline_handler: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string
          evento: string
          funcion_sql: string
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion: string
          evento: string
          funcion_sql: string
          id?: string
          nombre: string
          orden: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string
          evento?: string
          funcion_sql?: string
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      familia_grupo: {
        Row: {
          created_at: string
          descuento_familiar_pct: number
          id: string
          limite_miembros: number
          negocio_id: string | null
          nombre: string
          saldo_compartido: number
          titular_cliente_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descuento_familiar_pct?: number
          id?: string
          limite_miembros?: number
          negocio_id?: string | null
          nombre?: string
          saldo_compartido?: number
          titular_cliente_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descuento_familiar_pct?: number
          id?: string
          limite_miembros?: number
          negocio_id?: string | null
          nombre?: string
          saldo_compartido?: number
          titular_cliente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_grupo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familia_grupo_titular_cliente_id_fkey"
            columns: ["titular_cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_miembro: {
        Row: {
          cliente_id: string
          created_at: string
          familia_id: string
          id: string
          parentesco: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          familia_id: string
          id?: string
          parentesco?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          familia_id?: string
          id?: string
          parentesco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "familia_miembro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familia_miembro_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familia_grupo"
            referencedColumns: ["id"]
          },
        ]
      }
      favorito_negocio: {
        Row: {
          cliente_id: string
          created_at: string
          negocio_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          negocio_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorito_negocio_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorito_negocio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag: {
        Row: {
          activo: boolean
          alcance: string
          alcance_valor: string | null
          clave: string
          created_at: string
          fecha_revision: string | null
          id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alcance: string
          alcance_valor?: string | null
          clave: string
          created_at?: string
          fecha_revision?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alcance?: string
          alcance_valor?: string | null
          clave?: string
          created_at?: string
          fecha_revision?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      gift_card: {
        Row: {
          bloqueada_hasta: string | null
          codigo: string
          comprador_id: string | null
          corporativo_cuenta_id: string | null
          created_at: string
          destinatario_email: string | null
          destinatario_nombre: string | null
          destinatario_telefono: string | null
          estado: Database["public"]["Enums"]["gift_card_estado"]
          fecha_expiracion: string | null
          id: string
          intentos_pin: number
          lote_id: string | null
          mensaje: string | null
          monto_original: number
          negocio_id: string
          pin_hash: string
          saldo_actual: number
          updated_at: string
        }
        Insert: {
          bloqueada_hasta?: string | null
          codigo: string
          comprador_id?: string | null
          corporativo_cuenta_id?: string | null
          created_at?: string
          destinatario_email?: string | null
          destinatario_nombre?: string | null
          destinatario_telefono?: string | null
          estado?: Database["public"]["Enums"]["gift_card_estado"]
          fecha_expiracion?: string | null
          id?: string
          intentos_pin?: number
          lote_id?: string | null
          mensaje?: string | null
          monto_original: number
          negocio_id: string
          pin_hash: string
          saldo_actual: number
          updated_at?: string
        }
        Update: {
          bloqueada_hasta?: string | null
          codigo?: string
          comprador_id?: string | null
          corporativo_cuenta_id?: string | null
          created_at?: string
          destinatario_email?: string | null
          destinatario_nombre?: string | null
          destinatario_telefono?: string | null
          estado?: Database["public"]["Enums"]["gift_card_estado"]
          fecha_expiracion?: string | null
          id?: string
          intentos_pin?: number
          lote_id?: string | null
          mensaje?: string | null
          monto_original?: number
          negocio_id?: string
          pin_hash?: string
          saldo_actual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_corporativo_fk"
            columns: ["corporativo_cuenta_id"]
            isOneToOne: false
            referencedRelation: "corporativo_cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_redencion: {
        Row: {
          cliente_id: string
          created_at: string
          gift_card_id: string
          id: string
          monto: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          gift_card_id: string
          id?: string
          monto: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          gift_card_id?: string
          id?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_redencion_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_redencion_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_card"
            referencedColumns: ["id"]
          },
        ]
      }
      intento_auth: {
        Row: {
          created_at: string
          email: string
          exitoso: boolean
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          email: string
          exitoso?: boolean
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          email?: string
          exitoso?: boolean
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      invitacion_staff: {
        Row: {
          comision_pct: number | null
          created_at: string
          email: string
          estado: Database["public"]["Enums"]["invitacion_staff_estado"]
          expira_at: string
          id: string
          invitado_por: string
          negocio_id: string
          reenviada_at: string | null
          reenvios_count: number
          respondida_at: string | null
          sede_id: string | null
        }
        Insert: {
          comision_pct?: number | null
          created_at?: string
          email: string
          estado?: Database["public"]["Enums"]["invitacion_staff_estado"]
          expira_at?: string
          id?: string
          invitado_por: string
          negocio_id: string
          reenviada_at?: string | null
          reenvios_count?: number
          respondida_at?: string | null
          sede_id?: string | null
        }
        Update: {
          comision_pct?: number | null
          created_at?: string
          email?: string
          estado?: Database["public"]["Enums"]["invitacion_staff_estado"]
          expira_at?: string
          id?: string
          invitado_por?: string
          negocio_id?: string
          reenviada_at?: string | null
          reenvios_count?: number
          respondida_at?: string | null
          sede_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitacion_staff_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitacion_staff_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      lealtad_fraude_evento: {
        Row: {
          cliente_id: string | null
          created_at: string
          id: string
          negocio_id: string | null
          payload: Json
          revisado: boolean
          severidad: string
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          negocio_id?: string | null
          payload?: Json
          revisado?: boolean
          severidad?: string
          tipo: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          negocio_id?: string | null
          payload?: Json
          revisado?: boolean
          severidad?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lealtad_fraude_evento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lealtad_fraude_evento_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      lealtad_movimiento: {
        Row: {
          created_at: string
          id: string
          monto: number
          motivo: string | null
          negocio_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          sede_id: string | null
          tipo: Database["public"]["Enums"]["lealtad_origen"]
          wallet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monto: number
          motivo?: string | null
          negocio_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          sede_id?: string | null
          tipo: Database["public"]["Enums"]["lealtad_origen"]
          wallet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monto?: number
          motivo?: string | null
          negocio_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          sede_id?: string | null
          tipo?: Database["public"]["Enums"]["lealtad_origen"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lealtad_movimiento_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lealtad_movimiento_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lealtad_movimiento_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "lealtad_wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      lealtad_wallet: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          saldo_disponible: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          saldo_disponible?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          saldo_disponible?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lealtad_wallet_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_movimiento: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          ajusta_movimiento_id: string | null
          categoria: string
          cuenta_recaudo: string | null
          detalle: Json
          entidad: string
          estado: string
          evento: string
          id: string
          id_externo: string | null
          idempotency_key: string
          moneda: string
          monto: number
          motivo: string | null
          negocio_id: string | null
          ocurrido_at: string
          pago_id: string | null
          proveedor: string | null
          reembolso_id: string | null
          referencia_id: string
          referencia_tipo: string
          registrado_at: string
          reserva_id: string | null
          sentido: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo?: string
          ajusta_movimiento_id?: string | null
          categoria: string
          cuenta_recaudo?: string | null
          detalle?: Json
          entidad: string
          estado: string
          evento: string
          id?: string
          id_externo?: string | null
          idempotency_key: string
          moneda?: string
          monto: number
          motivo?: string | null
          negocio_id?: string | null
          ocurrido_at: string
          pago_id?: string | null
          proveedor?: string | null
          reembolso_id?: string | null
          referencia_id: string
          referencia_tipo: string
          registrado_at?: string
          reserva_id?: string | null
          sentido: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          ajusta_movimiento_id?: string | null
          categoria?: string
          cuenta_recaudo?: string | null
          detalle?: Json
          entidad?: string
          estado?: string
          evento?: string
          id?: string
          id_externo?: string | null
          idempotency_key?: string
          moneda?: string
          monto?: number
          motivo?: string | null
          negocio_id?: string | null
          ocurrido_at?: string
          pago_id?: string | null
          proveedor?: string | null
          reembolso_id?: string | null
          referencia_id?: string
          referencia_tipo?: string
          registrado_at?: string
          reserva_id?: string | null
          sentido?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_movimiento_ajusta_movimiento_id_fkey"
            columns: ["ajusta_movimiento_id"]
            isOneToOne: false
            referencedRelation: "libro_movimiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_movimiento_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      limite_tasa_evento: {
        Row: {
          clave: string
          creado_at: string
        }
        Insert: {
          clave: string
          creado_at?: string
        }
        Update: {
          clave?: string
          creado_at?: string
        }
        Relationships: []
      }
      lista_espera: {
        Row: {
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["lista_espera_estado"]
          fecha_deseada_fin: string
          fecha_deseada_inicio: string
          id: string
          negocio_id: string
          notificado_at: string | null
          orden_fifo: string
          sede_id: string
          servicio_ids: string[]
          staff_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["lista_espera_estado"]
          fecha_deseada_fin: string
          fecha_deseada_inicio: string
          id?: string
          negocio_id: string
          notificado_at?: string | null
          orden_fifo?: string
          sede_id: string
          servicio_ids: string[]
          staff_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["lista_espera_estado"]
          fecha_deseada_fin?: string
          fecha_deseada_inicio?: string
          id?: string
          negocio_id?: string
          notificado_at?: string | null
          orden_fifo?: string
          sede_id?: string
          servicio_ids?: string[]
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lista_espera_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      marca_aliada: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      membresia_plan: {
        Row: {
          activo: boolean
          congelacion_max_dias: number
          created_at: string
          descuento_pct: number
          dias_gracia: number
          duracion_meses: number
          id: string
          limite_usos_mes: number | null
          negocio_id: string
          nombre: string
          precio: number
          prioridad_reserva: boolean
          regalo_cumpleanos: string | null
          renovacion_automatica: boolean
          servicio_ids: string[]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          congelacion_max_dias?: number
          created_at?: string
          descuento_pct?: number
          dias_gracia?: number
          duracion_meses: number
          id?: string
          limite_usos_mes?: number | null
          negocio_id: string
          nombre: string
          precio: number
          prioridad_reserva?: boolean
          regalo_cumpleanos?: string | null
          renovacion_automatica?: boolean
          servicio_ids?: string[]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          congelacion_max_dias?: number
          created_at?: string
          descuento_pct?: number
          dias_gracia?: number
          duracion_meses?: number
          id?: string
          limite_usos_mes?: number | null
          negocio_id?: string
          nombre?: string
          precio?: number
          prioridad_reserva?: boolean
          regalo_cumpleanos?: string | null
          renovacion_automatica?: boolean
          servicio_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresia_plan_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      membresia_uso: {
        Row: {
          cliente_membresia_id: string
          created_at: string
          id: string
          monto_beneficio: number
          reserva_id: string | null
          tipo: string
        }
        Insert: {
          cliente_membresia_id: string
          created_at?: string
          id?: string
          monto_beneficio?: number
          reserva_id?: string | null
          tipo: string
        }
        Update: {
          cliente_membresia_id?: string
          created_at?: string
          id?: string
          monto_beneficio?: number
          reserva_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresia_uso_cliente_membresia_id_fkey"
            columns: ["cliente_membresia_id"]
            isOneToOne: false
            referencedRelation: "cliente_membresia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresia_uso_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_inventario: {
        Row: {
          actor_id: string
          cantidad: number
          created_at: string
          id: string
          motivo: string | null
          negocio_id: string
          producto_id: string
          referencia_reserva_id: string | null
          sede_id: string
          tipo: Database["public"]["Enums"]["movimiento_inventario_tipo"]
        }
        Insert: {
          actor_id: string
          cantidad: number
          created_at?: string
          id?: string
          motivo?: string | null
          negocio_id: string
          producto_id: string
          referencia_reserva_id?: string | null
          sede_id: string
          tipo: Database["public"]["Enums"]["movimiento_inventario_tipo"]
        }
        Update: {
          actor_id?: string
          cantidad?: number
          created_at?: string
          id?: string
          motivo?: string | null
          negocio_id?: string
          producto_id?: string
          referencia_reserva_id?: string | null
          sede_id?: string
          tipo?: Database["public"]["Enums"]["movimiento_inventario_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_inventario_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_referencia_reserva_id_fkey"
            columns: ["referencia_reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_inventario_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio: {
        Row: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        Insert: {
          anticipo_modo?: string
          categoria?: string[]
          ciudad: string
          comision_plataforma_pct?: number
          created_at?: string
          descripcion?: string | null
          elegibilidad_marketplace?: boolean
          email_contacto?: string | null
          estado?: Database["public"]["Enums"]["negocio_estado"]
          id?: string
          identificacion_fiscal?: string | null
          logo_url?: string | null
          max_anticipacion_dias?: number
          min_anticipacion_minutos?: number
          nombre: string
          onboarding_completo?: boolean
          owner_user_id: string
          pago_completo_en_app?: boolean
          pais_codigo?: string
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses?: number
          puntos_valor_100_cop?: number
          reembolso_parcial_pct?: number
          sena_maximo?: number
          sena_minimo?: number
          sena_monto_fijo?: number | null
          sena_pct?: number | null
          slug: string
          telefono_contacto?: string | null
          updated_at?: string
          ventana_reembolso_parcial_horas?: number
          ventana_reembolso_total_horas?: number
        }
        Update: {
          anticipo_modo?: string
          categoria?: string[]
          ciudad?: string
          comision_plataforma_pct?: number
          created_at?: string
          descripcion?: string | null
          elegibilidad_marketplace?: boolean
          email_contacto?: string | null
          estado?: Database["public"]["Enums"]["negocio_estado"]
          id?: string
          identificacion_fiscal?: string | null
          logo_url?: string | null
          max_anticipacion_dias?: number
          min_anticipacion_minutos?: number
          nombre?: string
          onboarding_completo?: boolean
          owner_user_id?: string
          pago_completo_en_app?: boolean
          pais_codigo?: string
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses?: number
          puntos_valor_100_cop?: number
          reembolso_parcial_pct?: number
          sena_maximo?: number
          sena_minimo?: number
          sena_monto_fijo?: number | null
          sena_pct?: number | null
          slug?: string
          telefono_contacto?: string | null
          updated_at?: string
          ventana_reembolso_parcial_horas?: number
          ventana_reembolso_total_horas?: number
        }
        Relationships: [
          {
            foreignKeyName: "negocio_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
        ]
      }
      negocio_addon: {
        Row: {
          activo: boolean
          addon_codigo: string
          cantidad: number
          desde: string
          hasta: string | null
          id: string
          negocio_id: string
        }
        Insert: {
          activo?: boolean
          addon_codigo: string
          cantidad?: number
          desde?: string
          hasta?: string | null
          id?: string
          negocio_id: string
        }
        Update: {
          activo?: boolean
          addon_codigo?: string
          cantidad?: number
          desde?: string
          hasta?: string | null
          id?: string
          negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negocio_addon_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_marca: {
        Row: {
          color_primario: string
          color_secundario: string
          estado: string
          logo_url: string | null
          negocio_id: string
          nombre_marca: string
          slogan: string | null
          updated_at: string
        }
        Insert: {
          color_primario?: string
          color_secundario?: string
          estado?: string
          logo_url?: string | null
          negocio_id: string
          nombre_marca: string
          slogan?: string | null
          updated_at?: string
        }
        Update: {
          color_primario?: string
          color_secundario?: string
          estado?: string
          logo_url?: string | null
          negocio_id?: string
          nombre_marca?: string
          slogan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "negocio_marca_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_visita_perfil: {
        Row: {
          campana_id: string | null
          cliente_id: string | null
          created_at: string
          id: string
          negocio_id: string
        }
        Insert: {
          campana_id?: string | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          negocio_id: string
        }
        Update: {
          campana_id?: string | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negocio_visita_perfil_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campana_publicitaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_visita_perfil_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      nivel_staff_consolidado: {
        Row: {
          nivel: Database["public"]["Enums"]["nivel_staff"]
          puntaje_final: number
          temporada_id: string
          vinculo_id: string
        }
        Insert: {
          nivel: Database["public"]["Enums"]["nivel_staff"]
          puntaje_final: number
          temporada_id: string
          vinculo_id: string
        }
        Update: {
          nivel?: Database["public"]["Enums"]["nivel_staff"]
          puntaje_final?: number
          temporada_id?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nivel_staff_consolidado_temporada_id_fkey"
            columns: ["temporada_id"]
            isOneToOne: false
            referencedRelation: "temporada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nivel_staff_consolidado_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculo_staff_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nivel_staff_consolidado_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vista_staff_negocio"
            referencedColumns: ["vinculo_id"]
          },
        ]
      }
      notificacion_envio: {
        Row: {
          canal: string
          categoria: string
          destinatario_id: string
          enviado_at: string
          evento: string
          id: string
          leido_at: string | null
          negocio_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
        }
        Insert: {
          canal: string
          categoria: string
          destinatario_id: string
          enviado_at?: string
          evento: string
          id?: string
          leido_at?: string | null
          negocio_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
        }
        Update: {
          canal?: string
          categoria?: string
          destinatario_id?: string
          enviado_at?: string
          evento?: string
          id?: string
          leido_at?: string | null
          negocio_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_envio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion_evento: {
        Row: {
          audiencia: string
          categoria: string
          codigo: string
          descripcion_en: string
          descripcion_es: string
          esencial: boolean
        }
        Insert: {
          audiencia: string
          categoria: string
          codigo: string
          descripcion_en: string
          descripcion_es: string
          esencial?: boolean
        }
        Update: {
          audiencia?: string
          categoria?: string
          codigo?: string
          descripcion_en?: string
          descripcion_es?: string
          esencial?: boolean
        }
        Relationships: []
      }
      notificacion_outbox: {
        Row: {
          canal: string
          categoria: string
          created_at: string
          datos: Json
          enviado_at: string | null
          estado: string
          evento: string
          id: string
          id_externo: string | null
          idempotency_key: string
          idioma: string
          intentos: number
          max_intentos: number
          negocio_id: string | null
          plantilla: string
          proximo_intento_at: string | null
          ultimo_error: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          canal: string
          categoria: string
          created_at?: string
          datos?: Json
          enviado_at?: string | null
          estado?: string
          evento: string
          id?: string
          id_externo?: string | null
          idempotency_key: string
          idioma?: string
          intentos?: number
          max_intentos?: number
          negocio_id?: string | null
          plantilla: string
          proximo_intento_at?: string | null
          ultimo_error?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          canal?: string
          categoria?: string
          created_at?: string
          datos?: Json
          enviado_at?: string | null
          estado?: string
          evento?: string
          id?: string
          id_externo?: string | null
          idempotency_key?: string
          idioma?: string
          intentos?: number
          max_intentos?: number
          negocio_id?: string | null
          plantilla?: string
          proximo_intento_at?: string | null
          ultimo_error?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_outbox_evento_fkey"
            columns: ["evento"]
            isOneToOne: false
            referencedRelation: "notificacion_evento"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "notificacion_outbox_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacion_outbox_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion_outbox_evento: {
        Row: {
          created_at: string
          detalle: string | null
          estado_destino: string
          estado_origen: string | null
          id: number
          intento: number
          outbox_id: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          estado_destino: string
          estado_origen?: string | null
          id?: never
          intento?: number
          outbox_id: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          estado_destino?: string
          estado_origen?: string | null
          id?: never
          intento?: number
          outbox_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_outbox_evento_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notificacion_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion_plantilla: {
        Row: {
          activa: boolean
          asunto: string
          canal: string
          codigo: string
          created_at: string
          cuerpo: string
          id: string
          idioma: string
          negocio_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          activa?: boolean
          asunto: string
          canal: string
          codigo: string
          created_at?: string
          cuerpo: string
          id?: string
          idioma: string
          negocio_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          activa?: boolean
          asunto?: string
          canal?: string
          codigo?: string
          created_at?: string
          cuerpo?: string
          id?: string
          idioma?: string
          negocio_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_plantilla_codigo_fkey"
            columns: ["codigo"]
            isOneToOne: false
            referencedRelation: "notificacion_evento"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "notificacion_plantilla_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion_preferencia: {
        Row: {
          activo: boolean
          canal: string
          evento: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          activo: boolean
          canal: string
          evento: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          activo?: boolean
          canal?: string
          evento?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_preferencia_evento_fkey"
            columns: ["evento"]
            isOneToOne: false
            referencedRelation: "notificacion_evento"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "notificacion_preferencia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion_push_suscripcion: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_push_suscripcion_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion_usuario: {
        Row: {
          created_at: string
          cuerpo: string
          dedupe_key: string | null
          id: string
          leida_at: string | null
          negocio_id: string | null
          reserva_id: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          cuerpo: string
          dedupe_key?: string | null
          id?: string
          leida_at?: string | null
          negocio_id?: string | null
          reserva_id?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          cuerpo?: string
          dedupe_key?: string | null
          id?: string
          leida_at?: string | null
          negocio_id?: string | null
          reserva_id?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_usuario_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacion_usuario_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacion_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_estado: {
        Row: {
          actor_id: string
          created_at: string
          expira_at: string
          negocio_id: string
          proveedor: string
          state_hash: string
          usado_at: string | null
          verifier_cifrado: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          expira_at: string
          negocio_id: string
          proveedor?: string
          state_hash: string
          usado_at?: string | null
          verifier_cifrado: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          expira_at?: string
          negocio_id?: string
          proveedor?: string
          state_hash?: string
          usado_at?: string | null
          verifier_cifrado?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_estado_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      oferta_negocio: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          dias_semana: number[] | null
          id: string
          negocio_id: string
          tipo_descuento: string
          titulo: string
          updated_at: string
          valor: number | null
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          dias_semana?: number[] | null
          id?: string
          negocio_id: string
          tipo_descuento: string
          titulo: string
          updated_at?: string
          valor?: number | null
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          dias_semana?: number[] | null
          id?: string
          negocio_id?: string
          tipo_descuento?: string
          titulo?: string
          updated_at?: string
          valor?: number | null
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oferta_negocio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      pago: {
        Row: {
          comision_plataforma_monto: number | null
          comision_plataforma_pct: number | null
          conexion_pago_id: string | null
          created_at: string
          cuenta_cobro: string | null
          entorno: string | null
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
          marketplace_fee: number
          metadata: Json
          monto: number
          monto_reembolsado: number
          motivo_reembolso: string | null
          negocio_id: string | null
          pasarela: string
          payload_pasarela: Json | null
          procesado_at: string | null
          reserva_id: string | null
          staff_destino_id: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at: string
        }
        Insert: {
          comision_plataforma_monto?: number | null
          comision_plataforma_pct?: number | null
          conexion_pago_id?: string | null
          created_at?: string
          cuenta_cobro?: string | null
          entorno?: string | null
          es_huerfano?: boolean
          estado?: Database["public"]["Enums"]["pago_estado"]
          id?: string
          id_preferencia_pasarela?: string | null
          id_transaccion_pasarela?: string | null
          marketplace_fee?: number
          metadata?: Json
          monto: number
          monto_reembolsado?: number
          motivo_reembolso?: string | null
          negocio_id?: string | null
          pasarela?: string
          payload_pasarela?: Json | null
          procesado_at?: string | null
          reserva_id?: string | null
          staff_destino_id?: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at?: string
        }
        Update: {
          comision_plataforma_monto?: number | null
          comision_plataforma_pct?: number | null
          conexion_pago_id?: string | null
          created_at?: string
          cuenta_cobro?: string | null
          entorno?: string | null
          es_huerfano?: boolean
          estado?: Database["public"]["Enums"]["pago_estado"]
          id?: string
          id_preferencia_pasarela?: string | null
          id_transaccion_pasarela?: string | null
          marketplace_fee?: number
          metadata?: Json
          monto?: number
          monto_reembolsado?: number
          motivo_reembolso?: string | null
          negocio_id?: string | null
          pasarela?: string
          payload_pasarela?: Json | null
          procesado_at?: string | null
          reserva_id?: string | null
          staff_destino_id?: string | null
          tipo?: Database["public"]["Enums"]["pago_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_conexion_pago_id_fkey"
            columns: ["conexion_pago_id"]
            isOneToOne: false
            referencedRelation: "conexion_pago_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_staff_destino_id_fkey"
            columns: ["staff_destino_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      pais: {
        Row: {
          activo: boolean
          anual_meses_pagados: number
          cobro_recurrente_habilitado: boolean
          codigo: string
          fundador_cupos: number
          fundador_descuento_pct: number
          fundador_meses: number
          impuesto_pct: number | null
          locale: string
          moneda: string
          nombre: string
          pasarela: string
          precio_mas_impuesto: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          anual_meses_pagados?: number
          cobro_recurrente_habilitado?: boolean
          codigo: string
          fundador_cupos?: number
          fundador_descuento_pct?: number
          fundador_meses?: number
          impuesto_pct?: number | null
          locale: string
          moneda: string
          nombre: string
          pasarela?: string
          precio_mas_impuesto?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          anual_meses_pagados?: number
          cobro_recurrente_habilitado?: boolean
          codigo?: string
          fundador_cupos?: number
          fundador_descuento_pct?: number
          fundador_meses?: number
          impuesto_pct?: number | null
          locale?: string
          moneda?: string
          nombre?: string
          pasarela?: string
          precio_mas_impuesto?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          hash: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      perfil: {
        Row: {
          avatar_url: string | null
          categorias_interes: string[]
          consentimiento_datos_at: string | null
          consentimiento_marketing: boolean
          created_at: string
          email: string | null
          es_supersu: boolean
          fecha_nacimiento: string | null
          id: string
          locale: string
          nombre: string
          pais: string | null
          password_establecida: boolean
          registro_pendiente: boolean
          session_version: number
          telefono: string | null
          telefono_verificado: boolean
          telefono_verificado_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          categorias_interes?: string[]
          consentimiento_datos_at?: string | null
          consentimiento_marketing?: boolean
          created_at?: string
          email?: string | null
          es_supersu?: boolean
          fecha_nacimiento?: string | null
          id: string
          locale?: string
          nombre: string
          pais?: string | null
          password_establecida?: boolean
          registro_pendiente?: boolean
          session_version?: number
          telefono?: string | null
          telefono_verificado?: boolean
          telefono_verificado_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          categorias_interes?: string[]
          consentimiento_datos_at?: string | null
          consentimiento_marketing?: boolean
          created_at?: string
          email?: string | null
          es_supersu?: boolean
          fecha_nacimiento?: string | null
          id?: string
          locale?: string
          nombre?: string
          pais?: string | null
          password_establecida?: boolean
          registro_pendiente?: boolean
          session_version?: number
          telefono?: string | null
          telefono_verificado?: boolean
          telefono_verificado_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan: {
        Row: {
          codigo: Database["public"]["Enums"]["plan_codigo"]
          conversaciones_whatsapp_mes: number | null
          creditos_ia_mes: number | null
          guardian_disponible: boolean
          limite_sedes: number | null
          marketplace_ads_disponible: boolean
          nombre: string
          precio_mensual: number | null
          sede_addon_precio: number | null
          staff_addon_precio: number | null
          staff_incluido: number | null
          staff_tope_absoluto: number | null
          updated_at: string
        }
        Insert: {
          codigo: Database["public"]["Enums"]["plan_codigo"]
          conversaciones_whatsapp_mes?: number | null
          creditos_ia_mes?: number | null
          guardian_disponible?: boolean
          limite_sedes?: number | null
          marketplace_ads_disponible?: boolean
          nombre: string
          precio_mensual?: number | null
          sede_addon_precio?: number | null
          staff_addon_precio?: number | null
          staff_incluido?: number | null
          staff_tope_absoluto?: number | null
          updated_at?: string
        }
        Update: {
          codigo?: Database["public"]["Enums"]["plan_codigo"]
          conversaciones_whatsapp_mes?: number | null
          creditos_ia_mes?: number | null
          guardian_disponible?: boolean
          limite_sedes?: number | null
          marketplace_ads_disponible?: boolean
          nombre?: string
          precio_mensual?: number | null
          sede_addon_precio?: number | null
          staff_addon_precio?: number | null
          staff_incluido?: number | null
          staff_tope_absoluto?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_caracteristica: {
        Row: {
          clave: string
          habilitado: boolean
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          updated_at: string
          valor: string | null
        }
        Insert: {
          clave: string
          habilitado?: boolean
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          updated_at?: string
          valor?: string | null
        }
        Update: {
          clave?: string
          habilitado?: boolean
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          updated_at?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_caracteristica_plan_codigo_fkey"
            columns: ["plan_codigo"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["codigo"]
          },
        ]
      }
      plan_funcion_ia: {
        Row: {
          funcion: string
          habilitado: boolean
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Insert: {
          funcion: string
          habilitado?: boolean
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Update: {
          funcion?: string
          habilitado?: boolean
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
        }
        Relationships: [
          {
            foreignKeyName: "plan_funcion_ia_plan_codigo_fkey"
            columns: ["plan_codigo"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["codigo"]
          },
        ]
      }
      plan_precio: {
        Row: {
          activo: boolean
          es_desde: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual: number | null
          precio_sede_extra: number | null
          precio_staff_extra: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          es_desde?: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual?: number | null
          precio_sede_extra?: number | null
          precio_staff_extra?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          es_desde?: boolean
          pais_codigo?: string
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual?: number | null
          precio_sede_extra?: number | null
          precio_staff_extra?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_precio_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "plan_precio_plan_codigo_fkey"
            columns: ["plan_codigo"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["codigo"]
          },
        ]
      }
      producto: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["servicio_estado"]
          id: string
          negocio_id: string
          nombre: string
          precio: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          negocio_id: string
          nombre: string
          precio: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          negocio_id?: string
          nombre?: string
          precio?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_stock: {
        Row: {
          id: string
          negocio_id: string
          producto_id: string
          sede_id: string
          stock_actual: number
          stock_minimo: number
          updated_at: string
        }
        Insert: {
          id?: string
          negocio_id: string
          producto_id: string
          sede_id: string
          stock_actual?: number
          stock_minimo?: number
          updated_at?: string
        }
        Update: {
          id?: string
          negocio_id?: string
          producto_id?: string
          sede_id?: string
          stock_actual?: number
          stock_minimo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_stock_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_stock_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      prueba_uso: {
        Row: {
          created_at: string
          dispositivo_hash: string
          documento_hash: string
          email_hash: string
          negocio_id: string
          owner_user_id: string
          telefono_hash: string
        }
        Insert: {
          created_at?: string
          dispositivo_hash: string
          documento_hash: string
          email_hash: string
          negocio_id: string
          owner_user_id: string
          telefono_hash: string
        }
        Update: {
          created_at?: string
          dispositivo_hash?: string
          documento_hash?: string
          email_hash?: string
          negocio_id?: string
          owner_user_id?: string
          telefono_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "prueba_uso_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      puntaje_staff_evento: {
        Row: {
          actor_tipo: string
          created_at: string
          evento: string
          id: string
          motivo: string | null
          puntos_delta: number
          referencia_id: string | null
          referencia_tipo: string | null
          temporada_id: string
          vinculo_id: string
        }
        Insert: {
          actor_tipo?: string
          created_at?: string
          evento: string
          id?: string
          motivo?: string | null
          puntos_delta: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          temporada_id: string
          vinculo_id: string
        }
        Update: {
          actor_tipo?: string
          created_at?: string
          evento?: string
          id?: string
          motivo?: string | null
          puntos_delta?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          temporada_id?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puntaje_staff_evento_temporada_id_fkey"
            columns: ["temporada_id"]
            isOneToOne: false
            referencedRelation: "temporada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntaje_staff_evento_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculo_staff_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntaje_staff_evento_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vista_staff_negocio"
            referencedColumns: ["vinculo_id"]
          },
        ]
      }
      punto_fidelizacion: {
        Row: {
          cantidad: number
          cantidad_disponible: number
          cliente_id: string
          created_at: string
          fecha_expiracion: string
          fecha_otorgamiento: string
          id: string
          negocio_id: string
          origen: string
        }
        Insert: {
          cantidad: number
          cantidad_disponible: number
          cliente_id: string
          created_at?: string
          fecha_expiracion: string
          fecha_otorgamiento?: string
          id?: string
          negocio_id: string
          origen: string
        }
        Update: {
          cantidad?: number
          cantidad_disponible?: number
          cliente_id?: string
          created_at?: string
          fecha_expiracion?: string
          fecha_otorgamiento?: string
          id?: string
          negocio_id?: string
          origen?: string
        }
        Relationships: [
          {
            foreignKeyName: "punto_fidelizacion_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punto_fidelizacion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      purga_storage_pendiente: {
        Row: {
          bucket: string
          created_at: string
          id: string
          ruta: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          ruta: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          ruta?: string
        }
        Relationships: []
      }
      recompensa_regla: {
        Row: {
          accion: Json
          activo: boolean
          condicion: Json
          created_at: string
          disparador: string
          id: string
          negocio_id: string
          nivel_ia: number
          requiere_confirmacion: boolean
        }
        Insert: {
          accion?: Json
          activo?: boolean
          condicion?: Json
          created_at?: string
          disparador: string
          id?: string
          negocio_id: string
          nivel_ia?: number
          requiere_confirmacion?: boolean
        }
        Update: {
          accion?: Json
          activo?: boolean
          condicion?: Json
          created_at?: string
          disparador?: string
          id?: string
          negocio_id?: string
          nivel_ia?: number
          requiere_confirmacion?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "recompensa_regla_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      recompensa_sugerencia: {
        Row: {
          cliente_id: string | null
          costo_credito_ia: number
          created_at: string
          descripcion: string
          estado: string
          id: string
          justificacion: string | null
          negocio_id: string
          regla_id: string
          resuelta_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          costo_credito_ia?: number
          created_at?: string
          descripcion: string
          estado?: string
          id?: string
          justificacion?: string | null
          negocio_id: string
          regla_id: string
          resuelta_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          costo_credito_ia?: number
          created_at?: string
          descripcion?: string
          estado?: string
          id?: string
          justificacion?: string | null
          negocio_id?: string
          regla_id?: string
          resuelta_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recompensa_sugerencia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recompensa_sugerencia_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recompensa_sugerencia_regla_id_fkey"
            columns: ["regla_id"]
            isOneToOne: false
            referencedRelation: "recompensa_regla"
            referencedColumns: ["id"]
          },
        ]
      }
      recurso: {
        Row: {
          estado: Database["public"]["Enums"]["recurso_estado"]
          id: string
          nombre: string
          recurso_tipo_id: string
          sede_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["recurso_estado"]
          id?: string
          nombre: string
          recurso_tipo_id: string
          sede_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["recurso_estado"]
          id?: string
          nombre?: string
          recurso_tipo_id?: string
          sede_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurso_recurso_tipo_id_fkey"
            columns: ["recurso_tipo_id"]
            isOneToOne: false
            referencedRelation: "recurso_tipo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurso_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      recurso_tipo: {
        Row: {
          id: string
          negocio_id: string
          nombre: string
        }
        Insert: {
          id?: string
          negocio_id: string
          nombre: string
        }
        Update: {
          id?: string
          negocio_id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurso_tipo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      reembolso: {
        Row: {
          cliente_id: string | null
          confirmado_at: string | null
          created_at: string
          estado: string
          id: string
          id_reembolso_pasarela: string | null
          idempotency_key: string
          intentos: number
          monto: number
          motivo: string
          negocio_id: string | null
          origen: string
          pago_id: string
          pct: number
          reserva_id: string | null
          solicitado_at: string | null
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          confirmado_at?: string | null
          created_at?: string
          estado?: string
          id?: string
          id_reembolso_pasarela?: string | null
          idempotency_key: string
          intentos?: number
          monto: number
          motivo: string
          negocio_id?: string | null
          origen: string
          pago_id: string
          pct: number
          reserva_id?: string | null
          solicitado_at?: string | null
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          confirmado_at?: string | null
          created_at?: string
          estado?: string
          id?: string
          id_reembolso_pasarela?: string | null
          idempotency_key?: string
          intentos?: number
          monto?: number
          motivo?: string
          negocio_id?: string | null
          origen?: string
          pago_id?: string
          pct?: number
          reserva_id?: string | null
          solicitado_at?: string | null
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reembolso_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reembolso_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reembolso_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reembolso_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      reembolso_evento: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          created_at: string
          detalle: Json | null
          estado_destino: string
          estado_origen: string | null
          id: number
          reembolso_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          created_at?: string
          detalle?: Json | null
          estado_destino: string
          estado_origen?: string | null
          id?: number
          reembolso_id: string
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          created_at?: string
          detalle?: Json | null
          estado_destino?: string
          estado_origen?: string | null
          id?: number
          reembolso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reembolso_evento_reembolso_id_fkey"
            columns: ["reembolso_id"]
            isOneToOne: false
            referencedRelation: "reembolso"
            referencedColumns: ["id"]
          },
        ]
      }
      referido: {
        Row: {
          completado_at: string | null
          created_at: string
          estado: Database["public"]["Enums"]["referido_estado"]
          id: string
          monto_recompensa: number | null
          negocio_id: string | null
          referente_cliente_id: string
          referido_cliente_id: string
          referido_codigo_id: string
          reserva_completada_id: string | null
        }
        Insert: {
          completado_at?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["referido_estado"]
          id?: string
          monto_recompensa?: number | null
          negocio_id?: string | null
          referente_cliente_id: string
          referido_cliente_id: string
          referido_codigo_id: string
          reserva_completada_id?: string | null
        }
        Update: {
          completado_at?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["referido_estado"]
          id?: string
          monto_recompensa?: number | null
          negocio_id?: string | null
          referente_cliente_id?: string
          referido_cliente_id?: string
          referido_codigo_id?: string
          reserva_completada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referido_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referido_referente_cliente_id_fkey"
            columns: ["referente_cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referido_referido_cliente_id_fkey"
            columns: ["referido_cliente_id"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referido_referido_codigo_id_fkey"
            columns: ["referido_codigo_id"]
            isOneToOne: false
            referencedRelation: "referido_codigo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referido_reserva_completada_id_fkey"
            columns: ["reserva_completada_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      referido_codigo: {
        Row: {
          cliente_id: string
          codigo: string
          created_at: string
          id: string
        }
        Insert: {
          cliente_id: string
          codigo: string
          created_at?: string
          id?: string
        }
        Update: {
          cliente_id?: string
          codigo?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referido_codigo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      referido_config: {
        Row: {
          activo: boolean
          limite_mensual: number | null
          monto: number | null
          negocio_id: string
          porcentaje: number | null
          vigencia_dias: number
        }
        Insert: {
          activo?: boolean
          limite_mensual?: number | null
          monto?: number | null
          negocio_id: string
          porcentaje?: number | null
          vigencia_dias?: number
        }
        Update: {
          activo?: boolean
          limite_mensual?: number | null
          monto?: number | null
          negocio_id?: string
          porcentaje?: number | null
          vigencia_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "referido_config_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      resena: {
        Row: {
          calificacion: number
          cliente_id: string
          comentario: string | null
          created_at: string
          estado: Database["public"]["Enums"]["resena_estado"]
          id: string
          moderado_motivo: string | null
          moderado_por: string | null
          negocio_id: string
          reserva_id: string
          respuesta_negocio: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          calificacion: number
          cliente_id: string
          comentario?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["resena_estado"]
          id?: string
          moderado_motivo?: string | null
          moderado_por?: string | null
          negocio_id: string
          reserva_id: string
          respuesta_negocio?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          calificacion?: number
          cliente_id?: string
          comentario?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["resena_estado"]
          id?: string
          moderado_motivo?: string | null
          moderado_por?: string | null
          negocio_id?: string
          reserva_id?: string
          respuesta_negocio?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resena_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resena_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resena_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: true
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resena_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      reserva: {
        Row: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          bloqueo_fin?: string | null
          bloqueo_inicio?: string | null
          buffer_posterior_minutos?: number
          buffer_previo_minutos?: number
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          cliente_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["reserva_estado"]
          expira_at?: string | null
          hora_fin: string
          hora_inicio: string
          id?: string
          idempotency_key?: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango?: unknown
          recurso_id?: string | null
          sede_id: string
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          bloqueo_fin?: string | null
          bloqueo_inicio?: string | null
          buffer_posterior_minutos?: number
          buffer_previo_minutos?: number
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          cliente_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["reserva_estado"]
          expira_at?: string | null
          hora_fin?: string
          hora_inicio?: string
          id?: string
          idempotency_key?: string | null
          monto_sena?: number
          monto_total?: number
          negocio_id?: string
          rango?: unknown
          recurso_id?: string | null
          sede_id?: string
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recurso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      reserva_foto: {
        Row: {
          cliente_id: string
          compartida: boolean
          compartida_at: string | null
          consentimiento: boolean
          created_at: string
          id: string
          momento: string | null
          negocio_id: string
          reserva_id: string
          subido_por: string
          url: string
        }
        Insert: {
          cliente_id: string
          compartida?: boolean
          compartida_at?: string | null
          consentimiento: boolean
          created_at?: string
          id?: string
          momento?: string | null
          negocio_id: string
          reserva_id: string
          subido_por: string
          url: string
        }
        Update: {
          cliente_id?: string
          compartida?: boolean
          compartida_at?: string | null
          consentimiento?: boolean
          created_at?: string
          id?: string
          momento?: string | null
          negocio_id?: string
          reserva_id?: string
          subido_por?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_foto_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_foto_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_foto_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      reserva_servicio: {
        Row: {
          precio_congelado_unitario: number
          reserva_id: string
          servicio_id: string
        }
        Insert: {
          precio_congelado_unitario: number
          reserva_id: string
          servicio_id: string
        }
        Update: {
          precio_congelado_unitario?: number
          reserva_id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_servicio_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      sede: {
        Row: {
          cerrada_permanente: boolean
          cerrada_temporalmente: boolean
          ciudad: string
          created_at: string
          direccion: string
          es_principal: boolean
          horario_base: Json
          id: string
          latitud: number | null
          longitud: number | null
          negocio_id: string
          nombre: string
          updated_at: string
          zona_horaria: string
        }
        Insert: {
          cerrada_permanente?: boolean
          cerrada_temporalmente?: boolean
          ciudad: string
          created_at?: string
          direccion: string
          es_principal?: boolean
          horario_base?: Json
          id?: string
          latitud?: number | null
          longitud?: number | null
          negocio_id: string
          nombre: string
          updated_at?: string
          zona_horaria?: string
        }
        Update: {
          cerrada_permanente?: boolean
          cerrada_temporalmente?: boolean
          ciudad?: string
          created_at?: string
          direccion?: string
          es_principal?: boolean
          horario_base?: Json
          id?: string
          latitud?: number | null
          longitud?: number | null
          negocio_id?: string
          nombre?: string
          updated_at?: string
          zona_horaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "sede_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      sede_horario_excepcion: {
        Row: {
          cerrado: boolean
          created_at: string
          fecha: string
          hora_fin_especial: string | null
          hora_inicio_especial: string | null
          id: string
          motivo: string | null
          sede_id: string
        }
        Insert: {
          cerrado?: boolean
          created_at?: string
          fecha: string
          hora_fin_especial?: string | null
          hora_inicio_especial?: string | null
          id?: string
          motivo?: string | null
          sede_id: string
        }
        Update: {
          cerrado?: boolean
          created_at?: string
          fecha?: string
          hora_fin_especial?: string | null
          hora_inicio_especial?: string | null
          id?: string
          motivo?: string | null
          sede_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sede_horario_excepcion_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      sello_campana: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["campana_sellos_estado"]
          id: string
          negocio_id: string
          nombre: string
          recompensa_descripcion: string
          sellos_requeridos: number
          servicio_ids: string[]
          updated_at: string
          vencimiento_dias: number | null
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["campana_sellos_estado"]
          id?: string
          negocio_id: string
          nombre: string
          recompensa_descripcion: string
          sellos_requeridos: number
          servicio_ids?: string[]
          updated_at?: string
          vencimiento_dias?: number | null
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["campana_sellos_estado"]
          id?: string
          negocio_id?: string
          nombre?: string
          recompensa_descripcion?: string
          sellos_requeridos?: number
          servicio_ids?: string[]
          updated_at?: string
          vencimiento_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sello_campana_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      sello_cliente: {
        Row: {
          campana_id: string
          cliente_id: string
          created_at: string
          id: string
          sellos_actuales: number
          updated_at: string
        }
        Insert: {
          campana_id: string
          cliente_id: string
          created_at?: string
          id?: string
          sellos_actuales?: number
          updated_at?: string
        }
        Update: {
          campana_id?: string
          cliente_id?: string
          created_at?: string
          id?: string
          sellos_actuales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sello_cliente_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "sello_campana"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sello_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      sello_evento: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          reserva_id: string | null
          sello_cliente_id: string
          tipo: string
        }
        Insert: {
          cantidad?: number
          created_at?: string
          id?: string
          reserva_id?: string | null
          sello_cliente_id: string
          tipo: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          reserva_id?: string | null
          sello_cliente_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sello_evento_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sello_evento_sello_cliente_id_fkey"
            columns: ["sello_cliente_id"]
            isOneToOne: false
            referencedRelation: "sello_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio: {
        Row: {
          anticipo_monto_fijo: number | null
          anticipo_pct: number | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          categoria_puntaje: Database["public"]["Enums"]["categoria_puntaje"]
          created_at: string
          descripcion: string | null
          duracion_minutos: number
          estado: Database["public"]["Enums"]["servicio_estado"]
          id: string
          imagen_url: string | null
          negocio_id: string
          nombre: string
          precio_base: number
          requiere_recurso_tipo_id: string | null
          updated_at: string
        }
        Insert: {
          anticipo_monto_fijo?: number | null
          anticipo_pct?: number | null
          buffer_posterior_minutos?: number
          buffer_previo_minutos?: number
          categoria_puntaje?: Database["public"]["Enums"]["categoria_puntaje"]
          created_at?: string
          descripcion?: string | null
          duracion_minutos: number
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          imagen_url?: string | null
          negocio_id: string
          nombre: string
          precio_base: number
          requiere_recurso_tipo_id?: string | null
          updated_at?: string
        }
        Update: {
          anticipo_monto_fijo?: number | null
          anticipo_pct?: number | null
          buffer_posterior_minutos?: number
          buffer_previo_minutos?: number
          categoria_puntaje?: Database["public"]["Enums"]["categoria_puntaje"]
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          imagen_url?: string | null
          negocio_id?: string
          nombre?: string
          precio_base?: number
          requiere_recurso_tipo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_requiere_recurso_tipo_id_fkey"
            columns: ["requiere_recurso_tipo_id"]
            isOneToOne: false
            referencedRelation: "recurso_tipo"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio_combo: {
        Row: {
          created_at: string
          descripcion: string | null
          duracion_minutos_override: number | null
          estado: Database["public"]["Enums"]["servicio_estado"]
          id: string
          negocio_id: string
          nombre: string
          precio_total_override: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          duracion_minutos_override?: number | null
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          negocio_id: string
          nombre: string
          precio_total_override?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          duracion_minutos_override?: number | null
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          negocio_id?: string
          nombre?: string
          precio_total_override?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicio_combo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio_combo_item: {
        Row: {
          combo_id: string
          servicio_id: string
        }
        Insert: {
          combo_id: string
          servicio_id: string
        }
        Update: {
          combo_id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicio_combo_item_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "servicio_combo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_combo_item_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio_producto_consumo: {
        Row: {
          cantidad: number
          producto_id: string
          servicio_id: string
        }
        Insert: {
          cantidad: number
          producto_id: string
          servicio_id: string
        }
        Update: {
          cantidad?: number
          producto_id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicio_producto_consumo_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_producto_consumo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud_cuenta: {
        Row: {
          auth_cerrada: boolean
          cancelada_at: string | null
          created_at: string
          ejecutada_at: string | null
          error: string | null
          estado: string
          id: string
          intentos: number
          programada_para: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          auth_cerrada?: boolean
          cancelada_at?: string | null
          created_at?: string
          ejecutada_at?: string | null
          error?: string | null
          estado: string
          id?: string
          intentos?: number
          programada_para?: string | null
          tipo: string
          usuario_id: string
        }
        Update: {
          auth_cerrada?: boolean
          cancelada_at?: string | null
          created_at?: string
          ejecutada_at?: string | null
          error?: string | null
          estado?: string
          id?: string
          intentos?: number
          programada_para?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_cuenta_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud_devolucion_saldo: {
        Row: {
          cliente_id: string
          created_at: string
          estado: string
          id: string
          monto: number
          origen: string
          resuelta_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          estado?: string
          id?: string
          monto: number
          origen?: string
          resuelta_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          estado?: string
          id?: string
          monto?: number
          origen?: string
          resuelta_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_devolucion_saldo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud_reposicion: {
        Row: {
          atendida_at: string | null
          cantidad_solicitada: number
          created_at: string
          estado: Database["public"]["Enums"]["solicitud_reposicion_estado"]
          id: string
          motivo: string | null
          negocio_id: string
          producto_id: string
          sede_id: string
          solicitado_por: string
        }
        Insert: {
          atendida_at?: string | null
          cantidad_solicitada: number
          created_at?: string
          estado?: Database["public"]["Enums"]["solicitud_reposicion_estado"]
          id?: string
          motivo?: string | null
          negocio_id: string
          producto_id: string
          sede_id: string
          solicitado_por: string
        }
        Update: {
          atendida_at?: string | null
          cantidad_solicitada?: number
          created_at?: string
          estado?: Database["public"]["Enums"]["solicitud_reposicion_estado"]
          id?: string
          motivo?: string | null
          negocio_id?: string
          producto_id?: string
          sede_id?: string
          solicitado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_reposicion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_reposicion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_reposicion_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          bio: string | null
          created_at: string
          especialidad: string | null
          foto_url: string | null
          nombre: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          especialidad?: string | null
          foto_url?: string | null
          nombre: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          especialidad?: string | null
          foto_url?: string | null
          nombre?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      staff_referido: {
        Row: {
          cliente_referido_id: string
          completado_at: string | null
          created_at: string
          estado: Database["public"]["Enums"]["referido_estado"]
          id: string
          negocio_id: string
          recompensa_monto: number | null
          recompensa_tipo: string | null
          reserva_completada_id: string | null
          staff_id: string
        }
        Insert: {
          cliente_referido_id: string
          completado_at?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["referido_estado"]
          id?: string
          negocio_id: string
          recompensa_monto?: number | null
          recompensa_tipo?: string | null
          reserva_completada_id?: string | null
          staff_id: string
        }
        Update: {
          cliente_referido_id?: string
          completado_at?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["referido_estado"]
          id?: string
          negocio_id?: string
          recompensa_monto?: number | null
          recompensa_tipo?: string | null
          reserva_completada_id?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_referido_cliente_referido_id_fkey"
            columns: ["cliente_referido_id"]
            isOneToOne: true
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_referido_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_referido_reserva_completada_id_fkey"
            columns: ["reserva_completada_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_referido_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      staff_servicio: {
        Row: {
          servicio_id: string
          staff_id: string
        }
        Insert: {
          servicio_id: string
          staff_id: string
        }
        Update: {
          servicio_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_servicio_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      suscripcion: {
        Row: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        Insert: {
          activacion_manual?: boolean
          aviso_1d_at?: string | null
          aviso_3d_at?: string | null
          ciclo?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo?: string
          fecha_proximo_cobro: string
          gracia_fin?: string | null
          id?: string
          manual_hasta?: string | null
          manual_referencia?: string | null
          manual_tipo?: string | null
          metodo_pago_proveedor?: string | null
          metodo_pago_ref?: string | null
          negocio_id: string
          pais_codigo?: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino?:
            | Database["public"]["Enums"]["plan_codigo"]
            | null
          prueba_fin?: string | null
          prueba_inicio?: string | null
          reintentos_fallo_count?: number
          suspendido_causa?: string | null
          updated_at?: string
        }
        Update: {
          activacion_manual?: boolean
          aviso_1d_at?: string | null
          aviso_3d_at?: string | null
          ciclo?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo?: string
          fecha_proximo_cobro?: string
          gracia_fin?: string | null
          id?: string
          manual_hasta?: string | null
          manual_referencia?: string | null
          manual_tipo?: string | null
          metodo_pago_proveedor?: string | null
          metodo_pago_ref?: string | null
          negocio_id?: string
          pais_codigo?: string
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino?:
            | Database["public"]["Enums"]["plan_codigo"]
            | null
          prueba_fin?: string | null
          prueba_inicio?: string | null
          reintentos_fallo_count?: number
          suspendido_causa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripcion_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suscripcion_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "suscripcion_plan_codigo_destino_fkey"
            columns: ["plan_codigo_destino"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "suscripcion_plan_codigo_fkey"
            columns: ["plan_codigo"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["codigo"]
          },
        ]
      }
      suscripcion_fundador: {
        Row: {
          created_at: string
          descuento_pct: number
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          negocio_id: string
          pais_codigo: string
          perdido_en: string | null
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Insert: {
          created_at?: string
          descuento_pct: number
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          negocio_id: string
          pais_codigo: string
          perdido_en?: string | null
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Update: {
          created_at?: string
          descuento_pct?: number
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          negocio_id?: string
          pais_codigo?: string
          perdido_en?: string | null
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
        }
        Relationships: [
          {
            foreignKeyName: "suscripcion_fundador_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suscripcion_fundador_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "suscripcion_fundador_plan_codigo_fkey"
            columns: ["plan_codigo"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["codigo"]
          },
        ]
      }
      temporada: {
        Row: {
          estado: Database["public"]["Enums"]["temporada_estado"]
          fecha_fin: string
          fecha_inicio: string
          id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["temporada_estado"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["temporada_estado"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
        }
        Relationships: []
      }
      texto_legal: {
        Row: {
          cambio_material: boolean
          contenido: string
          id: string
          publicado_at: string
          tipo: string
          version: number
        }
        Insert: {
          cambio_material?: boolean
          contenido: string
          id?: string
          publicado_at?: string
          tipo: string
          version: number
        }
        Update: {
          cambio_material?: boolean
          contenido?: string
          id?: string
          publicado_at?: string
          tipo?: string
          version?: number
        }
        Relationships: []
      }
      ticket_mensaje: {
        Row: {
          actor_tipo: string
          autor_id: string
          created_at: string
          id: string
          mensaje: string
          ticket_id: string
        }
        Insert: {
          actor_tipo: string
          autor_id: string
          created_at?: string
          id?: string
          mensaje: string
          ticket_id: string
        }
        Update: {
          actor_tipo?: string
          autor_id?: string
          created_at?: string
          id?: string
          mensaje?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_mensaje_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_soporte: {
        Row: {
          asunto: string
          creado_por: string
          created_at: string
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          id: string
          negocio_id: string | null
          updated_at: string
        }
        Insert: {
          asunto: string
          creado_por: string
          created_at?: string
          estado?: Database["public"]["Enums"]["ticket_soporte_estado"]
          id?: string
          negocio_id?: string | null
          updated_at?: string
        }
        Update: {
          asunto?: string
          creado_por?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["ticket_soporte_estado"]
          id?: string
          negocio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_soporte_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_producto: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          negocio_id: string
          precio_unitario: number
          producto_id: string
          reserva_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          negocio_id: string
          precio_unitario: number
          producto_id: string
          reserva_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          negocio_id?: string
          precio_unitario?: number
          producto_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_producto_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_producto_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_producto_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
          },
        ]
      }
      vinculo_staff_negocio: {
        Row: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          comision_pct?: number | null
          created_at?: string
          es_guardian?: boolean
          estado?: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso?: string | null
          id?: string
          negocio_id: string
          sede_activa_id?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          comision_pct?: number | null
          created_at?: string
          es_guardian?: boolean
          estado?: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso?: string | null
          id?: string
          negocio_id?: string
          sede_activa_id?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculo_staff_negocio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculo_staff_negocio_sede_activa_id_fkey"
            columns: ["sede_activa_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculo_staff_negocio_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      vip_historial: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          nivel_anterior_id: string | null
          nivel_nuevo_id: string
          vip_miembro_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          nivel_anterior_id?: string | null
          nivel_nuevo_id: string
          vip_miembro_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          nivel_anterior_id?: string | null
          nivel_nuevo_id?: string
          vip_miembro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_historial_nivel_anterior_id_fkey"
            columns: ["nivel_anterior_id"]
            isOneToOne: false
            referencedRelation: "vip_nivel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_historial_nivel_nuevo_id_fkey"
            columns: ["nivel_nuevo_id"]
            isOneToOne: false
            referencedRelation: "vip_nivel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_historial_vip_miembro_id_fkey"
            columns: ["vip_miembro_id"]
            isOneToOne: false
            referencedRelation: "vip_miembro"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_miembro: {
        Row: {
          asignado_por: string | null
          cliente_id: string
          created_at: string
          id: string
          negocio_id: string
          nivel_id: string
          origen: string
          updated_at: string
        }
        Insert: {
          asignado_por?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          negocio_id: string
          nivel_id: string
          origen: string
          updated_at?: string
        }
        Update: {
          asignado_por?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          negocio_id?: string
          nivel_id?: string
          origen?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_miembro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_miembro_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_miembro_nivel_id_fkey"
            columns: ["nivel_id"]
            isOneToOne: false
            referencedRelation: "vip_nivel"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_nivel: {
        Row: {
          beneficios: string | null
          created_at: string
          id: string
          negocio_id: string
          nombre: string
          orden: number
          umbral_automatico_gasto: number | null
        }
        Insert: {
          beneficios?: string | null
          created_at?: string
          id?: string
          negocio_id: string
          nombre: string
          orden: number
          umbral_automatico_gasto?: number | null
        }
        Update: {
          beneficios?: string | null
          created_at?: string
          id?: string
          negocio_id?: string
          nombre?: string
          orden?: number
          umbral_automatico_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_nivel_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet: {
        Row: {
          id: string
          negocio_id: string | null
          saldo_disponible: number
          saldo_retenido: number
          updated_at: string
        }
        Insert: {
          id?: string
          negocio_id?: string | null
          saldo_disponible?: number
          saldo_retenido?: number
          updated_at?: string
        }
        Update: {
          id?: string
          negocio_id?: string | null
          saldo_disponible?: number
          saldo_retenido?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_movimiento: {
        Row: {
          created_at: string
          id: string
          monto: number
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monto: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monto?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movimiento_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_evento: {
        Row: {
          conexion_id: string | null
          data_id: string | null
          id: number
          procesado_at: string | null
          proveedor: string
          recibido_at: string
          request_id: string
          resultado: string | null
          topico: string | null
        }
        Insert: {
          conexion_id?: string | null
          data_id?: string | null
          id?: number
          procesado_at?: string | null
          proveedor: string
          recibido_at?: string
          request_id: string
          resultado?: string | null
          topico?: string | null
        }
        Update: {
          conexion_id?: string | null
          data_id?: string | null
          id?: number
          procesado_at?: string | null
          proveedor?: string
          recibido_at?: string
          request_id?: string
          resultado?: string | null
          topico?: string | null
        }
        Relationships: []
      }
      whatsapp_alerta: {
        Row: {
          created_at: string
          id: string
          negocio_id: string
          pct_al_disparar: number
          periodo: string
          umbral: number
        }
        Insert: {
          created_at?: string
          id?: string
          negocio_id: string
          pct_al_disparar: number
          periodo: string
          umbral: number
        }
        Update: {
          created_at?: string
          id?: string
          negocio_id?: string
          pct_al_disparar?: number
          periodo?: string
          umbral?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_alerta_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campana: {
        Row: {
          cancelada_at: string | null
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          creado_por: string
          created_at: string
          destinatarios_estimados: number
          estado: Database["public"]["Enums"]["whatsapp_campana_estado"]
          id: string
          motivo_estado: string | null
          negocio_id: string
          nombre: string
          plantilla_id: string
          programada_at: string | null
          segmento: Json
          updated_at: string
        }
        Insert: {
          cancelada_at?: string | null
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          creado_por: string
          created_at?: string
          destinatarios_estimados?: number
          estado?: Database["public"]["Enums"]["whatsapp_campana_estado"]
          id?: string
          motivo_estado?: string | null
          negocio_id: string
          nombre: string
          plantilla_id: string
          programada_at?: string | null
          segmento?: Json
          updated_at?: string
        }
        Update: {
          cancelada_at?: string | null
          categoria?: Database["public"]["Enums"]["whatsapp_categoria"]
          creado_por?: string
          created_at?: string
          destinatarios_estimados?: number
          estado?: Database["public"]["Enums"]["whatsapp_campana_estado"]
          id?: string
          motivo_estado?: string | null
          negocio_id?: string
          nombre?: string
          plantilla_id?: string
          programada_at?: string | null
          segmento?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campana_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campana_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_plantilla"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_compra_recarga: {
        Row: {
          acreditada_at: string | null
          cancelada_at: string | null
          conversaciones: number
          created_at: string
          estado: Database["public"]["Enums"]["whatsapp_compra_estado"]
          id: string
          lote_id: string | null
          meses_vencimiento: number
          moneda: string
          negocio_id: string
          pago_id: string | null
          paquete_id: string
          pct_marketing: number
          precio: number
          solicitado_por: string
        }
        Insert: {
          acreditada_at?: string | null
          cancelada_at?: string | null
          conversaciones: number
          created_at?: string
          estado?: Database["public"]["Enums"]["whatsapp_compra_estado"]
          id?: string
          lote_id?: string | null
          meses_vencimiento: number
          moneda: string
          negocio_id: string
          pago_id?: string | null
          paquete_id: string
          pct_marketing: number
          precio: number
          solicitado_por: string
        }
        Update: {
          acreditada_at?: string | null
          cancelada_at?: string | null
          conversaciones?: number
          created_at?: string
          estado?: Database["public"]["Enums"]["whatsapp_compra_estado"]
          id?: string
          lote_id?: string | null
          meses_vencimiento?: number
          moneda?: string
          negocio_id?: string
          pago_id?: string | null
          paquete_id?: string
          pct_marketing?: number
          precio?: number
          solicitado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_compra_recarga_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_conversacion_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_compra_recarga_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_compra_recarga_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: true
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_compra_recarga_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_paquete"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          estado_conexion: Database["public"]["Enums"]["whatsapp_estado_conexion"]
          estado_conexion_at: string | null
          estado_conexion_detalle: string | null
          id: boolean
          meses_vencimiento_recarga: number
          pct_marketing_plan: number
          pct_marketing_recarga: number
          proveedor: string | null
          umbrales_alerta: number[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          estado_conexion?: Database["public"]["Enums"]["whatsapp_estado_conexion"]
          estado_conexion_at?: string | null
          estado_conexion_detalle?: string | null
          id?: boolean
          meses_vencimiento_recarga?: number
          pct_marketing_plan?: number
          pct_marketing_recarga?: number
          proveedor?: string | null
          umbrales_alerta?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          estado_conexion?: Database["public"]["Enums"]["whatsapp_estado_conexion"]
          estado_conexion_at?: string | null
          estado_conexion_detalle?: string | null
          id?: boolean
          meses_vencimiento_recarga?: number
          pct_marketing_plan?: number
          pct_marketing_recarga?: number
          proveedor?: string | null
          umbrales_alerta?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      whatsapp_consumo: {
        Row: {
          cantidad: number
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          created_at: string
          id: string
          lote_id: string
          mensaje_id: string
          negocio_id: string
          tipo: string
        }
        Insert: {
          cantidad?: number
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          created_at?: string
          id?: string
          lote_id: string
          mensaje_id: string
          negocio_id: string
          tipo: string
        }
        Update: {
          cantidad?: number
          categoria?: Database["public"]["Enums"]["whatsapp_categoria"]
          created_at?: string
          id?: string
          lote_id?: string
          mensaje_id?: string
          negocio_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_consumo_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversacion_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_consumo_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mensaje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_consumo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversacion_lote: {
        Row: {
          cantidad: number
          cantidad_disponible: number
          compra_id: string | null
          created_at: string
          cupo_marketing: number
          fecha_expiracion: string
          fecha_otorgamiento: string
          id: string
          marketing_consumido: number
          negocio_id: string
          origen: string
          periodo: string | null
        }
        Insert: {
          cantidad: number
          cantidad_disponible: number
          compra_id?: string | null
          created_at?: string
          cupo_marketing?: number
          fecha_expiracion: string
          fecha_otorgamiento?: string
          id?: string
          marketing_consumido?: number
          negocio_id: string
          origen: string
          periodo?: string | null
        }
        Update: {
          cantidad?: number
          cantidad_disponible?: number
          compra_id?: string | null
          created_at?: string
          cupo_marketing?: number
          fecha_expiracion?: string
          fecha_otorgamiento?: string
          id?: string
          marketing_consumido?: number
          negocio_id?: string
          origen?: string
          periodo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversacion_lote_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_compra_recarga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversacion_lote_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensaje: {
        Row: {
          campana_id: string | null
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          cliente_id: string
          created_at: string
          entregado_at: string | null
          enviado_at: string | null
          error_codigo: string | null
          error_detalle: string | null
          estado: Database["public"]["Enums"]["whatsapp_mensaje_estado"]
          fallido_at: string | null
          id: string
          leido_at: string | null
          negocio_id: string
          plantilla_id: string
          proveedor_mensaje_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          telefono: string
          updated_at: string
          variables: Json
        }
        Insert: {
          campana_id?: string | null
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          cliente_id: string
          created_at?: string
          entregado_at?: string | null
          enviado_at?: string | null
          error_codigo?: string | null
          error_detalle?: string | null
          estado?: Database["public"]["Enums"]["whatsapp_mensaje_estado"]
          fallido_at?: string | null
          id?: string
          leido_at?: string | null
          negocio_id: string
          plantilla_id: string
          proveedor_mensaje_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          telefono: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          campana_id?: string | null
          categoria?: Database["public"]["Enums"]["whatsapp_categoria"]
          cliente_id?: string
          created_at?: string
          entregado_at?: string | null
          enviado_at?: string | null
          error_codigo?: string | null
          error_detalle?: string | null
          estado?: Database["public"]["Enums"]["whatsapp_mensaje_estado"]
          fallido_at?: string | null
          id?: string
          leido_at?: string | null
          negocio_id?: string
          plantilla_id?: string
          proveedor_mensaje_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          telefono?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensaje_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campana"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensaje_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensaje_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensaje_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_plantilla"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensaje_evento: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["whatsapp_mensaje_estado"]
          id: string
          mensaje_id: string
          proveedor_payload: Json | null
        }
        Insert: {
          created_at?: string
          estado: Database["public"]["Enums"]["whatsapp_mensaje_estado"]
          id?: string
          mensaje_id: string
          proveedor_payload?: Json | null
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["whatsapp_mensaje_estado"]
          id?: string
          mensaje_id?: string
          proveedor_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensaje_evento_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mensaje"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_paquete: {
        Row: {
          activo: boolean
          codigo: string
          conversaciones: number
          created_at: string
          created_by: string | null
          id: string
          moneda: string
          nombre: string
          precio: number
          reemplaza_a: string | null
          version: number
        }
        Insert: {
          activo?: boolean
          codigo: string
          conversaciones: number
          created_at?: string
          created_by?: string | null
          id?: string
          moneda?: string
          nombre: string
          precio: number
          reemplaza_a?: string | null
          version?: number
        }
        Update: {
          activo?: boolean
          codigo?: string
          conversaciones?: number
          created_at?: string
          created_by?: string | null
          id?: string
          moneda?: string
          nombre?: string
          precio?: number
          reemplaza_a?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_paquete_reemplaza_a_fkey"
            columns: ["reemplaza_a"]
            isOneToOne: false
            referencedRelation: "whatsapp_paquete"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_plantilla: {
        Row: {
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          creado_por: string | null
          created_at: string
          cuerpo: string
          estado: Database["public"]["Enums"]["whatsapp_plantilla_estado"]
          id: string
          idioma: string
          motivo_rechazo: string | null
          negocio_id: string | null
          nombre: string
          proveedor_plantilla_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          creado_por?: string | null
          created_at?: string
          cuerpo: string
          estado?: Database["public"]["Enums"]["whatsapp_plantilla_estado"]
          id?: string
          idioma?: string
          motivo_rechazo?: string | null
          negocio_id?: string | null
          nombre: string
          proveedor_plantilla_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          categoria?: Database["public"]["Enums"]["whatsapp_categoria"]
          creado_por?: string | null
          created_at?: string
          cuerpo?: string
          estado?: Database["public"]["Enums"]["whatsapp_plantilla_estado"]
          id?: string
          idioma?: string
          motivo_rechazo?: string | null
          negocio_id?: string | null
          nombre?: string
          proveedor_plantilla_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_plantilla_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_interaction: {
        Row: {
          accion: string | null
          categoria: string | null
          created_at: string | null
          creditos_consumidos: number | null
          id: string | null
          negocio_id: string | null
          nivel: number | null
          saldo_restante: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credito_ia_consumo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_crm_cliente: {
        Row: {
          cliente_foto_url: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          ltv: number | null
          negocio_id: string | null
          primera_visita: string | null
          ticket_promedio: number | null
          ultima_visita: string | null
          visitas: number | null
          visitas_ultimo_anio: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reserva_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_staff_negocio: {
        Row: {
          comision_pct: number | null
          created_at: string | null
          email: string | null
          es_guardian: boolean | null
          especialidad: string | null
          estado: Database["public"]["Enums"]["vinculo_estado"] | null
          fecha_ingreso: string | null
          foto_url: string | null
          negocio_id: string | null
          nivel: Database["public"]["Enums"]["nivel_staff"] | null
          nombre: string | null
          sede_id: string | null
          sede_nombre: string | null
          staff_id: string | null
          telefono: string | null
          vinculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vinculo_staff_negocio_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculo_staff_negocio_sede_activa_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculo_staff_negocio_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
    }
    Functions: {
      _anonimizar_cliente: { Args: { p_usuario: string }; Returns: undefined }
      _auditar: {
        Args: {
          p_accion: string
          p_antes: Json
          p_despues: Json
          p_entidad_id: string
          p_entidad_tipo: string
          p_motivo: string
          p_negocio_id: string
        }
        Returns: string
      }
      _auditoria_cabeceras: { Args: never; Returns: Json }
      _auditoria_es_clave_secreta: {
        Args: { p_clave: string }
        Returns: boolean
      }
      _auditoria_filtrar: {
        Args: { p: Json; p_cols: string[]; p_excl: string[] }
        Returns: Json
      }
      _auditoria_limpiar: { Args: { p: Json }; Returns: Json }
      _auditoria_motivo_cabecera: { Args: never; Returns: string }
      _auditoria_origen: { Args: never; Returns: string }
      _auditoria_request_id: { Args: never; Returns: string }
      _chat_rol: { Args: { p_reserva_id: string }; Returns: string }
      _conexion_evento: {
        Args: {
          p_actor: string
          p_actor_tipo: string
          p_conexion: string
          p_destino: string
          p_detalle: Json
          p_negocio: string
          p_origen: string
        }
        Returns: undefined
      }
      _consentimiento_registrar: {
        Args: {
          p_origen: string
          p_otorgado: boolean
          p_proposito: string
          p_usuario: string
        }
        Returns: boolean
      }
      _consentimiento_vigente: {
        Args: { p_proposito: string; p_usuario: string }
        Returns: boolean
      }
      _encolar_notificacion: {
        Args: {
          p_canal: string
          p_clave: string
          p_datos: Json
          p_evento: string
          p_negocio: string
          p_plantilla?: string
          p_usuario: string
        }
        Returns: string
      }
      _familia_miembro: { Args: { p_familia_id: string }; Returns: boolean }
      _familia_titular: { Args: { p_familia_id: string }; Returns: boolean }
      _gift_card_pin_ok: {
        Args: { p_id: string; p_pin: string }
        Returns: boolean
      }
      _lealtad_acreditar: {
        Args: {
          p_cliente_id: string
          p_monto: number
          p_motivo: string
          p_negocio_id: string
          p_referencia_id: string
          p_referencia_tipo: string
          p_sede_id: string
          p_tipo: Database["public"]["Enums"]["lealtad_origen"]
        }
        Returns: undefined
      }
      _lealtad_wallet_id: { Args: { p_cliente_id: string }; Returns: string }
      _libro_categoria_pago: {
        Args: { p_tipo: Database["public"]["Enums"]["pago_tipo"] }
        Returns: string
      }
      _libro_desde_pago: {
        Args: {
          p: Database["public"]["Tables"]["pago"]["Row"]
          p_actor: string
          p_actor_tipo: string
          p_backfill: boolean
        }
        Returns: undefined
      }
      _libro_desde_reembolso: {
        Args: {
          p_backfill: boolean
          r: Database["public"]["Tables"]["reembolso"]["Row"]
        }
        Returns: undefined
      }
      _libro_evidencia_pago: {
        Args: { p: Database["public"]["Tables"]["pago"]["Row"] }
        Returns: Json
      }
      _libro_moneda: { Args: { p_negocio_id: string }; Returns: string }
      _libro_proveedor: { Args: { p_pasarela: string }; Returns: string }
      _libro_registrar: {
        Args: {
          p_actor: string
          p_actor_tipo: string
          p_categoria: string
          p_cuenta: string
          p_detalle: Json
          p_entidad: string
          p_estado: string
          p_evento: string
          p_id_externo: string
          p_key: string
          p_monto: number
          p_negocio: string
          p_ocurrido: string
          p_pago: string
          p_proveedor: string
          p_reembolso: string
          p_ref_id: string
          p_ref_tipo: string
          p_reserva: string
          p_sentido: string
        }
        Returns: undefined
      }
      _notif_datos_reserva: {
        Args: {
          p_para_negocio: boolean
          p_reserva: Database["public"]["Tables"]["reserva"]["Row"]
        }
        Returns: Json
      }
      _notif_destinatarios_negocio: {
        Args: { p_negocio: string; p_staff: string }
        Returns: string[]
      }
      _notif_encolar_canales: {
        Args: {
          p_canales: string[]
          p_clave: string
          p_datos: Json
          p_evento: string
          p_negocio: string
          p_usuario: string
        }
        Returns: number
      }
      _notif_endpoint_valido: { Args: { p_endpoint: string }; Returns: boolean }
      _notif_monto: {
        Args: { p_monto: number; p_negocio: string }
        Returns: string
      }
      _notif_plantilla: {
        Args: {
          p_canal: string
          p_codigo: string
          p_idioma: string
          p_negocio: string
        }
        Returns: {
          asunto: string
          cuerpo: string
          version: number
        }[]
      }
      _notif_render_texto: {
        Args: { p_datos: Json; p_texto: string }
        Returns: string
      }
      _notificar: {
        Args: {
          p_cuerpo_en: string
          p_cuerpo_es: string
          p_dedupe?: string
          p_negocio?: string
          p_reserva?: string
          p_tipo: string
          p_titulo_en: string
          p_titulo_es: string
          p_usuario: string
        }
        Returns: undefined
      }
      _pipeline_ai_atribuir_conversion: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_auditoria_venta: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_cashback_otorgar: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_puntaje_staff_otorgar: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_puntos_fidelizacion_otorgar: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_referidos_cliente_completar: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_referidos_staff_completar: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _pipeline_sellos_otorgar: { Args: { p_evento: Json }; Returns: undefined }
      _pipeline_vip_evaluar_ascenso: {
        Args: { p_evento: Json }
        Returns: undefined
      }
      _reclamar_fundador: {
        Args: {
          p_inicio: string
          p_negocio: string
          p_pais: string
          p_plan: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: boolean
      }
      _reembolso_crear: {
        Args: {
          p_actor_tipo: string
          p_monto: number
          p_motivo: string
          p_origen: string
          p_pago_id: string
          p_pct: number
        }
        Returns: string
      }
      _sincronizar_registro_pendiente: {
        Args: { p_pendiente: boolean; p_usuario: string }
        Returns: undefined
      }
      _validar_gift_card_para_canje: {
        Args: { p_codigo: string; p_pin: string }
        Returns: {
          bloqueada_hasta: string | null
          codigo: string
          comprador_id: string | null
          corporativo_cuenta_id: string | null
          created_at: string
          destinatario_email: string | null
          destinatario_nombre: string | null
          destinatario_telefono: string | null
          estado: Database["public"]["Enums"]["gift_card_estado"]
          fecha_expiracion: string | null
          id: string
          intentos_pin: number
          lote_id: string | null
          mensaje: string | null
          monto_original: number
          negocio_id: string
          pin_hash: string
          saldo_actual: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gift_card"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _whatsapp_consumir: { Args: { p_mensaje_id: string }; Returns: string }
      _whatsapp_consumo_periodo: {
        Args: { p_negocio_id: string; p_periodo: string }
        Returns: Json
      }
      _whatsapp_destinatarios: {
        Args: {
          p_categoria: Database["public"]["Enums"]["whatsapp_categoria"]
          p_negocio_id: string
          p_segmento: Json
        }
        Returns: {
          dest_cliente_id: string
          dest_nombre: string
          dest_telefono: string
        }[]
      }
      _whatsapp_envio_habilitado: { Args: never; Returns: boolean }
      _whatsapp_evaluar_alertas: {
        Args: { p_negocio_id: string }
        Returns: undefined
      }
      _whatsapp_otorgar_lote_plan: {
        Args: { p_negocio_id: string; p_periodo?: string }
        Returns: string
      }
      _whatsapp_periodo_actual: { Args: never; Returns: string }
      _whatsapp_plan_codigo: {
        Args: { p_negocio_id: string }
        Returns: Database["public"]["Enums"]["plan_codigo"]
      }
      _whatsapp_plan_incluye: {
        Args: { p_clave: string; p_negocio_id: string }
        Returns: boolean
      }
      _whatsapp_revertir_consumo: {
        Args: { p_mensaje_id: string }
        Returns: boolean
      }
      _whatsapp_saldo: { Args: { p_negocio_id: string }; Returns: Json }
      _whatsapp_transicion_valida: {
        Args: { p_desde: string; p_hacia: string; p_maquina: string }
        Returns: boolean
      }
      _whatsapp_validar_plantilla: {
        Args: { p_cuerpo: string; p_variables: Json }
        Returns: undefined
      }
      _whatsapp_validar_segmento: { Args: { p: Json }; Returns: undefined }
      aceptar_politica_reserva: {
        Args: { p_reserva_id: string }
        Returns: string
      }
      activar_addon_negocio: {
        Args: {
          p_activo: boolean
          p_addon: string
          p_cantidad?: number
          p_negocio_id: string
        }
        Returns: undefined
      }
      activar_campana: {
        Args: { p_campana_id: string }
        Returns: {
          clics: number
          created_at: string
          estado: Database["public"]["Enums"]["campana_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string
          gasto_hoy: number
          gasto_hoy_fecha: string
          gasto_total: number
          id: string
          impresiones: number
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total: number | null
          segmentacion: Json
          unidad_cobro: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campana_publicitaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actor_tipo_soporte: { Args: { p_negocio_id: string }; Returns: string }
      actualizar_accion_costo_ia: {
        Args: {
          p_accion: string
          p_activo?: boolean
          p_costo_creditos: number
          p_costo_proveedor_estimado?: number
          p_margen_pct?: number
        }
        Returns: {
          accion: string
          activo: boolean
          categoria: string
          costo_creditos: number
          costo_proveedor_estimado: number
          created_at: string
          id: string
          margen_pct: number
          modelo_fallback: string | null
          modelo_preferido: string | null
          nivel_ia: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_accion_costo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_banner_home: {
        Args: {
          p_activo?: boolean
          p_id: string
          p_imagen_url?: string
          p_orden?: number
          p_texto?: string
          p_url_destino?: string
          p_vigencia_desde?: string
          p_vigencia_hasta?: string
        }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          imagen_url: string
          orden: number
          texto: string | null
          updated_at: string
          updated_by: string | null
          url_destino: string | null
          vigencia_desde: string | null
          vigencia_hasta: string | null
        }
        SetofOptions: {
          from: "*"
          to: "banner_home"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_ciudad_habilitada: {
        Args: { p_ciudad: string; p_habilitada: boolean }
        Returns: {
          ciudad: string
          habilitada: boolean
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ciudad_habilitada"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_comision_plataforma_global: {
        Args: { p_pct: number }
        Returns: {
          app_version_actual: string | null
          app_version_minima: string | null
          comision_plataforma_pct_default: number
          cpc_destacado_cop: number
          cpc_pin_cop: number
          cpm_pin_cop: number
          id: boolean
          mantenimiento_activo: boolean
          mantenimiento_fin_estimado: string | null
          mantenimiento_inicio: string | null
          mantenimiento_mensaje: string | null
          politica_parcial_min_horas: number
          politica_pct_parcial_max: number
          politica_pct_parcial_min: number
          politica_total_max_horas: number
          politica_total_min_horas: number
          prueba_aviso_dias_1: number
          prueba_aviso_dias_2: number
          prueba_dias: number
          prueba_modalidad: string
          reembolso_max_intentos: number
          suscripcion_gracia_dias: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "configuracion_plataforma"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_estado_ticket: {
        Args: {
          p_estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          p_ticket_id: string
        }
        Returns: {
          asunto: string
          creado_por: string
          created_at: string
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          id: string
          negocio_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_idioma_region: {
        Args: { p_locale: string; p_pais: string }
        Returns: {
          locale: string
          pais: string
        }[]
      }
      actualizar_modelo_config_ia: {
        Args: {
          p_activo: boolean
          p_costo_por_millon_tokens_usd?: number
          p_nombre: string
          p_orden_preferencia: number
        }
        Returns: {
          activo: boolean
          costo_por_millon_tokens_usd: number
          created_at: string
          id: string
          modelo_id: string
          nombre: string
          orden_preferencia: number
          proveedor: string
          requiere_credencial: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_modelo_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_paquete_creditos_ia: {
        Args: { p_activo: boolean; p_paquete_id: string; p_precio_cop: number }
        Returns: {
          activo: boolean
          created_at: string
          creditos: number | null
          id: string
          nombre: string
          precio_cop: number | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_paquete_creditos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_plan: {
        Args: {
          p_codigo: Database["public"]["Enums"]["plan_codigo"]
          p_conversaciones_whatsapp_mes?: number
          p_creditos_ia_mes?: number
          p_guardian_disponible?: boolean
          p_limite_sedes?: number
          p_marketplace_ads_disponible?: boolean
          p_precio_mensual?: number
          p_sede_addon_precio?: number
          p_staff_addon_precio?: number
          p_staff_incluido?: number
        }
        Returns: {
          codigo: Database["public"]["Enums"]["plan_codigo"]
          conversaciones_whatsapp_mes: number | null
          creditos_ia_mes: number | null
          guardian_disponible: boolean
          limite_sedes: number | null
          marketplace_ads_disponible: boolean
          nombre: string
          precio_mensual: number | null
          sede_addon_precio: number | null
          staff_addon_precio: number | null
          staff_incluido: number | null
          staff_tope_absoluto: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_plan_membresia: {
        Args: {
          p_congelacion_max_dias: number
          p_descuento_pct: number
          p_dias_gracia: number
          p_limite_usos_mes: number
          p_nombre: string
          p_plan_id: string
          p_precio: number
          p_prioridad_reserva: boolean
          p_regalo_cumpleanos: string
          p_servicio_ids: string[]
        }
        Returns: {
          activo: boolean
          congelacion_max_dias: number
          created_at: string
          descuento_pct: number
          dias_gracia: number
          duracion_meses: number
          id: string
          limite_usos_mes: number | null
          negocio_id: string
          nombre: string
          precio: number
          prioridad_reserva: boolean
          regalo_cumpleanos: string | null
          renovacion_automatica: boolean
          servicio_ids: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "membresia_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_tarifas_ads: {
        Args: { p_cpc_destacado: number; p_cpc_pin: number; p_cpm_pin: number }
        Returns: {
          app_version_actual: string | null
          app_version_minima: string | null
          comision_plataforma_pct_default: number
          cpc_destacado_cop: number
          cpc_pin_cop: number
          cpm_pin_cop: number
          id: boolean
          mantenimiento_activo: boolean
          mantenimiento_fin_estimado: string | null
          mantenimiento_inicio: string | null
          mantenimiento_mensaje: string | null
          politica_parcial_min_horas: number
          politica_pct_parcial_max: number
          politica_pct_parcial_min: number
          politica_total_max_horas: number
          politica_total_min_horas: number
          prueba_aviso_dias_1: number
          prueba_aviso_dias_2: number
          prueba_dias: number
          prueba_modalidad: string
          reembolso_max_intentos: number
          suscripcion_gracia_dias: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "configuracion_plataforma"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_activar_negocio_manual: {
        Args: {
          p_dias?: number
          p_estado: string
          p_motivo: string
          p_negocio_id: string
          p_plan: Database["public"]["Enums"]["plan_codigo"]
          p_referencia?: string
          p_tipo: string
        }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_anular_comision_programada: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      admin_dashboard_resumen: { Args: never; Returns: Json }
      admin_programar_comision: {
        Args: {
          p_efectivo_desde: string
          p_motivo: string
          p_negocio_id: string
          p_pct: number
        }
        Returns: string
      }
      admin_reintentar_reembolso: {
        Args: { p_motivo: string; p_reembolso_id: string }
        Returns: undefined
      }
      admin_set_addon_precio: {
        Args: { p_addon: string; p_pais: string; p_precio: number }
        Returns: {
          addon_codigo: string
          pais_codigo: string
          precio_mensual: number | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "addon_precio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_config_prueba: {
        Args: {
          p_aviso_1: number
          p_aviso_2: number
          p_dias: number
          p_gracia_dias: number
          p_modalidad: string
          p_motivo: string
        }
        Returns: undefined
      }
      admin_set_limites_politica: {
        Args: {
          p_max_intentos: number
          p_motivo: string
          p_parcial_min: number
          p_pct_max: number
          p_pct_min: number
          p_total_max: number
          p_total_min: number
        }
        Returns: undefined
      }
      admin_set_pais: {
        Args: {
          p_activo: boolean
          p_cobro_recurrente: boolean
          p_codigo: string
          p_fundador_cupos: number
          p_fundador_descuento_pct: number
          p_fundador_meses: number
          p_impuesto_pct: number
          p_pasarela: string
          p_precio_mas_impuesto: boolean
        }
        Returns: {
          activo: boolean
          anual_meses_pagados: number
          cobro_recurrente_habilitado: boolean
          codigo: string
          fundador_cupos: number
          fundador_descuento_pct: number
          fundador_meses: number
          impuesto_pct: number | null
          locale: string
          moneda: string
          nombre: string
          pasarela: string
          precio_mas_impuesto: boolean
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pais"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_plan_caracteristica: {
        Args: {
          p_clave: string
          p_habilitado: boolean
          p_plan: Database["public"]["Enums"]["plan_codigo"]
          p_valor: string
        }
        Returns: {
          clave: string
          habilitado: boolean
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          updated_at: string
          valor: string | null
        }
        SetofOptions: {
          from: "*"
          to: "plan_caracteristica"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_plan_precio: {
        Args: {
          p_activo: boolean
          p_es_desde: boolean
          p_pais: string
          p_plan: Database["public"]["Enums"]["plan_codigo"]
          p_precio_mensual: number
          p_precio_sede_extra: number
          p_precio_staff_extra: number
        }
        Returns: {
          activo: boolean
          es_desde: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual: number | null
          precio_sede_extra: number | null
          precio_staff_extra: number | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "plan_precio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agregar_empleado_corporativo: {
        Args: { p_cliente_id: string; p_cuenta_id: string }
        Returns: {
          activo: boolean
          cliente_id: string
          created_at: string
          cuenta_id: string
          id: string
        }
        SetofOptions: {
          from: "*"
          to: "corporativo_miembro"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agregar_miembro_familiar: {
        Args: {
          p_cliente_id: string
          p_familia_id: string
          p_parentesco?: string
        }
        Returns: {
          cliente_id: string
          created_at: string
          familia_id: string
          id: string
          parentesco: string | null
        }
        SetofOptions: {
          from: "*"
          to: "familia_miembro"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ajustar_stock: {
        Args: {
          p_motivo?: string
          p_nuevo_stock_actual: number
          p_producto_id: string
          p_sede_id: string
        }
        Returns: {
          id: string
          negocio_id: string
          producto_id: string
          sede_id: string
          stock_actual: number
          stock_minimo: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "producto_stock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      alternar_campana_sellos: {
        Args: {
          p_campana_id: string
          p_estado: Database["public"]["Enums"]["campana_sellos_estado"]
        }
        Returns: {
          created_at: string
          estado: Database["public"]["Enums"]["campana_sellos_estado"]
          id: string
          negocio_id: string
          nombre: string
          recompensa_descripcion: string
          sellos_requeridos: number
          servicio_ids: string[]
          updated_at: string
          vencimiento_dias: number | null
        }
        SetofOptions: {
          from: "*"
          to: "sello_campana"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      alternar_plan_membresia: {
        Args: { p_activo: boolean; p_plan_id: string }
        Returns: {
          activo: boolean
          congelacion_max_dias: number
          created_at: string
          descuento_pct: number
          dias_gracia: number
          duracion_meses: number
          id: string
          limite_usos_mes: number | null
          negocio_id: string
          nombre: string
          precio: number
          prioridad_reserva: boolean
          regalo_cumpleanos: string | null
          renovacion_automatica: boolean
          servicio_ids: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "membresia_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      alternar_regla_cashback: {
        Args: { p_activo: boolean; p_regla_id: string }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          limite_mensual: number | null
          negocio_id: string
          porcentaje: number
          producto_ids: string[]
          servicio_ids: string[]
          vigencia_dias: number | null
        }
        SetofOptions: {
          from: "*"
          to: "cashback_regla"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      alternar_regla_recompensa: {
        Args: { p_activo: boolean; p_regla_id: string }
        Returns: {
          accion: Json
          activo: boolean
          condicion: Json
          created_at: string
          disparador: string
          id: string
          negocio_id: string
          nivel_ia: number
          requiere_confirmacion: boolean
        }
        SetofOptions: {
          from: "*"
          to: "recompensa_regla"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      anular_egreso_caja: {
        Args: { p_egreso_id: string; p_motivo: string }
        Returns: undefined
      }
      aplicar_comisiones_programadas: { Args: never; Returns: number }
      aplicar_evento_pago: {
        Args: {
          p_estado: Database["public"]["Enums"]["pago_estado"]
          p_id_transaccion: string
          p_pago_id: string
          p_payload?: Json
        }
        Returns: Json
      }
      aprobar_memoria_ia: {
        Args: { p_memoria_id: string }
        Returns: {
          aprobado: boolean
          categoria: string
          contenido: Json
          creado_por: string | null
          created_at: string
          id: string
          negocio_id: string
          sede_id: string | null
          version: number
          vigente: boolean
        }
        SetofOptions: {
          from: "*"
          to: "ai_memoria_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aprobar_negocio: {
        Args: { p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      asignar_admin_corporativo: {
        Args: { p_admin_user_id: string; p_cuenta_id: string }
        Returns: {
          activo: boolean
          admin_user_id: string | null
          contacto_email: string
          created_at: string
          cupos_totales: number
          id: string
          negocio_id: string | null
          nit: string | null
          nombre_empresa: string
          sedes_permitidas: string[]
          vigencia_fin: string
          vigencia_inicio: string
        }
        SetofOptions: {
          from: "*"
          to: "corporativo_cuenta"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      asignar_vip: {
        Args: { p_cliente_id: string; p_negocio_id: string; p_nivel_id: string }
        Returns: {
          asignado_por: string | null
          cliente_id: string
          created_at: string
          id: string
          negocio_id: string
          nivel_id: string
          origen: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vip_miembro"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atender_solicitud_reposicion: {
        Args: { p_cantidad_recibida?: number; p_solicitud_id: string }
        Returns: {
          atendida_at: string | null
          cantidad_solicitada: number
          created_at: string
          estado: Database["public"]["Enums"]["solicitud_reposicion_estado"]
          id: string
          motivo: string | null
          negocio_id: string
          producto_id: string
          sede_id: string
          solicitado_por: string
        }
        SetofOptions: {
          from: "*"
          to: "solicitud_reposicion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auditoria_entidades: {
        Args: { p_negocio_id?: string }
        Returns: string[]
      }
      auditoria_listar: {
        Args: {
          p_accion?: string
          p_desde?: string
          p_entidad_tipo?: string
          p_hasta?: string
          p_limite?: number
          p_negocio_id?: string
          p_offset?: number
        }
        Returns: {
          accion: string
          actor_nombre: string
          actor_tipo: string
          created_at: string
          entidad_id: string
          entidad_tipo: string
          id: string
          motivo: string
          negocio_id: string
          negocio_nombre: string
          origen: string
          payload_antes: Json
          payload_despues: Json
          request_id: string
        }[]
      }
      avisos_prueba_pendientes: {
        Args: never
        Returns: {
          con_tarjeta: boolean
          fecha_cobro: string
          negocio_id: string
          owner_user_id: string
          tipo: string
        }[]
      }
      beneficiario_pago: {
        Args: { p_tipo: Database["public"]["Enums"]["pago_tipo"] }
        Returns: string
      }
      beneficios_marcas: { Args: never; Returns: Json }
      beneficios_marcas_consentir: {
        Args: { p_otorgado: boolean }
        Returns: Json
      }
      bloquear_gift_card: {
        Args: { p_gift_card_id: string; p_motivo: string }
        Returns: {
          bloqueada_hasta: string | null
          codigo: string
          comprador_id: string | null
          corporativo_cuenta_id: string | null
          created_at: string
          destinatario_email: string | null
          destinatario_nombre: string | null
          destinatario_telefono: string | null
          estado: Database["public"]["Enums"]["gift_card_estado"]
          fecha_expiracion: string | null
          id: string
          intentos_pin: number
          lote_id: string | null
          mensaje: string | null
          monto_original: number
          negocio_id: string
          pin_hash: string
          saldo_actual: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gift_card"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calcular_sena: {
        Args: { p_monto_total: number; p_negocio_id: string }
        Returns: number
      }
      calcular_sena_servicios: {
        Args: {
          p_monto_total: number
          p_negocio_id: string
          p_servicio_ids: string[]
        }
        Returns: number
      }
      calificar_visita: {
        Args: {
          p_calificacion: number
          p_comentario?: string
          p_reserva_id: string
        }
        Returns: {
          calificacion: number
          cliente_id: string
          comentario: string | null
          created_at: string
          estado: Database["public"]["Enums"]["resena_estado"]
          id: string
          moderado_motivo: string | null
          moderado_por: string | null
          negocio_id: string
          reserva_id: string
          respuesta_negocio: string | null
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "resena"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_downgrade_programado: {
        Args: { p_negocio_id: string }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_eliminacion_cuenta: { Args: never; Returns: boolean }
      cancelar_invitacion: {
        Args: { p_invitacion_id: string }
        Returns: undefined
      }
      cancelar_membresia: {
        Args: { p_cliente_membresia_id: string }
        Returns: {
          cliente_id: string
          congelada_hasta: string | null
          created_at: string
          estado: Database["public"]["Enums"]["membresia_estado"]
          fecha_inicio: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_id: string
          updated_at: string
          usos_mes_actual: number
          usos_mes_fecha: string
        }
        SetofOptions: {
          from: "*"
          to: "cliente_membresia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_negocio_propio: {
        Args: { p_motivo: string; p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_negocio_supersu: {
        Args: { p_motivo: string; p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_reserva: {
        Args: { p_motivo?: string; p_reserva_id: string }
        Returns: Json
      }
      canjear_lealtad_wallet: {
        Args: {
          p_monto: number
          p_referencia_id?: string
          p_referencia_tipo?: string
        }
        Returns: number
      }
      canjear_sellos: {
        Args: { p_sello_cliente_id: string }
        Returns: {
          campana_id: string
          cliente_id: string
          created_at: string
          id: string
          sellos_actuales: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sello_cliente"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cerrar_sede: {
        Args: { p_motivo?: string; p_permanente: boolean; p_sede_id: string }
        Returns: {
          cerrada_permanente: boolean
          cerrada_temporalmente: boolean
          ciudad: string
          created_at: string
          direccion: string
          es_principal: boolean
          horario_base: Json
          id: string
          latitud: number | null
          longitud: number | null
          negocio_id: string
          nombre: string
          updated_at: string
          zona_horaria: string
        }
        SetofOptions: {
          from: "*"
          to: "sede"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      chat_enviar: {
        Args: { p_cuerpo: string; p_reserva_id: string }
        Returns: {
          autor_rol: string
          created_at: string
          cuerpo: string
          es_mio: boolean
          id: string
        }[]
      }
      chat_listar: {
        Args: { p_antes?: string; p_limite?: number; p_reserva_id: string }
        Returns: {
          autor_rol: string
          created_at: string
          cuerpo: string
          es_mio: boolean
          id: string
          leido_por_otro: boolean
        }[]
      }
      chat_marcar_leido: { Args: { p_reserva_id: string }; Returns: boolean }
      cierre_caja_dia: {
        Args: { p_fecha?: string; p_negocio_id: string; p_sede_id?: string }
        Returns: Json
      }
      cliente_crear_ticket: {
        Args: { p_categoria: string; p_mensaje: string; p_reserva_id?: string }
        Returns: {
          asunto: string
          creado_por: string
          created_at: string
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          id: string
          negocio_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cliente_listar_tickets: {
        Args: { p_limite?: number }
        Returns: {
          asunto: string
          categoria: string
          codigo: string
          created_at: string
          estado: string
          ticket_id: string
          updated_at: string
        }[]
      }
      cliente_ticket_mensajes: {
        Args: { p_ticket_id: string }
        Returns: {
          actor_tipo: string
          created_at: string
          es_mio: boolean
          id: string
          mensaje: string
        }[]
      }
      completar_registro: {
        Args: {
          p_locale?: string
          p_marketing?: boolean
          p_nombre: string
          p_pais: string
        }
        Returns: Json
      }
      completar_registro_con_telefono: {
        Args: {
          p_locale?: string
          p_marketing?: boolean
          p_nombre: string
          p_pais: string
          p_telefono: string
        }
        Returns: Json
      }
      completar_venta_pos: {
        Args: {
          p_metodo_pago_propina?: string
          p_metodo_pago_saldo?: string
          p_productos?: Json
          p_propina?: number
          p_puntos_a_canjear?: number
          p_reserva_id: string
        }
        Returns: Json
      }
      comprar_paquete_creditos_ia: {
        Args: { p_negocio_id: string; p_paquete_id: string }
        Returns: {
          comision_plataforma_monto: number | null
          comision_plataforma_pct: number | null
          conexion_pago_id: string | null
          created_at: string
          cuenta_cobro: string | null
          entorno: string | null
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
          marketplace_fee: number
          metadata: Json
          monto: number
          monto_reembolsado: number
          motivo_reembolso: string | null
          negocio_id: string | null
          pasarela: string
          payload_pasarela: Json | null
          procesado_at: string | null
          reserva_id: string | null
          staff_destino_id: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pago"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conexion_desconectar: {
        Args: { p_motivo?: string; p_negocio_id: string }
        Returns: undefined
      }
      conexion_guardar: {
        Args: {
          p_access_cifrado: string
          p_actor: string
          p_cuenta_externa: string
          p_entorno: string
          p_expira_at: string
          p_negocio_id: string
          p_refresh_cifrado: string
          p_scopes: string
        }
        Returns: string
      }
      conexion_marcar_estado: {
        Args: { p_conexion_id: string; p_error: string; p_estado: string }
        Returns: undefined
      }
      conexion_pago_estado: { Args: { p_negocio_id: string }; Returns: Json }
      conexion_renovar_tokens: {
        Args: {
          p_access_cifrado: string
          p_conexion_id: string
          p_expira_at: string
          p_refresh_cifrado: string
        }
        Returns: undefined
      }
      config_prueba: { Args: never; Returns: Json }
      configurar_anticipo: {
        Args: {
          p_maximo: number
          p_minimo: number
          p_modo: string
          p_monto_fijo: number
          p_motivo?: string
          p_negocio_id: string
          p_pago_completo: boolean
          p_pct: number
        }
        Returns: undefined
      }
      configurar_funcion_plan_ia: {
        Args: {
          p_funcion: string
          p_habilitado: boolean
          p_plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: undefined
      }
      configurar_politica_cancelacion: {
        Args: {
          p_motivo?: string
          p_negocio_id: string
          p_parcial_horas: number
          p_parcial_pct: number
          p_total_horas: number
        }
        Returns: undefined
      }
      configurar_referidos: {
        Args: {
          p_activo: boolean
          p_limite_mensual: number
          p_monto: number
          p_negocio_id: string
          p_porcentaje: number
          p_vigencia_dias: number
        }
        Returns: {
          activo: boolean
          limite_mensual: number | null
          monto: number | null
          negocio_id: string
          porcentaje: number | null
          vigencia_dias: number
        }
        SetofOptions: {
          from: "*"
          to: "referido_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      configurar_stock_minimo: {
        Args: {
          p_producto_id: string
          p_sede_id: string
          p_stock_minimo: number
        }
        Returns: {
          id: string
          negocio_id: string
          producto_id: string
          sede_id: string
          stock_actual: number
          stock_minimo: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "producto_stock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirmar_reserva_sin_anticipo: {
        Args: { p_reserva_id: string }
        Returns: undefined
      }
      confirmar_sugerencia_recompensa: {
        Args: { p_sugerencia_id: string }
        Returns: {
          cliente_id: string | null
          costo_credito_ia: number
          created_at: string
          descripcion: string
          estado: string
          id: string
          justificacion: string | null
          negocio_id: string
          regla_id: string
          resuelta_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recompensa_sugerencia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      congelar_membresia: {
        Args: { p_cliente_membresia_id: string; p_dias: number }
        Returns: {
          cliente_id: string
          congelada_hasta: string | null
          created_at: string
          estado: Database["public"]["Enums"]["membresia_estado"]
          fecha_inicio: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_id: string
          updated_at: string
          usos_mes_actual: number
          usos_mes_fecha: string
        }
        SetofOptions: {
          from: "*"
          to: "cliente_membresia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consultar_gift_card: {
        Args: { p_codigo: string; p_pin: string }
        Returns: {
          estado: Database["public"]["Enums"]["gift_card_estado"]
          fecha_expiracion: string
          monto_original: number
          negocio_nombre: string
          saldo_actual: number
        }[]
      }
      consumir_creditos_ia: {
        Args: {
          p_accion: string
          p_negocio_id: string
          p_referencia_id?: string
          p_referencia_tipo?: string
        }
        Returns: Json
      }
      consumir_cupo: {
        Args: { p_clave: string; p_limite: number; p_ventana_seg: number }
        Returns: number
      }
      crear_banner_home: {
        Args: {
          p_imagen_url: string
          p_orden?: number
          p_texto?: string
          p_url_destino?: string
          p_vigencia_desde?: string
          p_vigencia_hasta?: string
        }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          imagen_url: string
          orden: number
          texto: string | null
          updated_at: string
          updated_by: string | null
          url_destino: string | null
          vigencia_desde: string | null
          vigencia_hasta: string | null
        }
        SetofOptions: {
          from: "*"
          to: "banner_home"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_campana_publicitaria: {
        Args: {
          p_fecha_fin?: string
          p_formato: string
          p_negocio_id: string
          p_presupuesto_diario: number
          p_presupuesto_total: number
          p_segmentacion?: Json
          p_unidad_cobro: string
        }
        Returns: {
          clics: number
          created_at: string
          estado: Database["public"]["Enums"]["campana_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string
          gasto_hoy: number
          gasto_hoy_fecha: string
          gasto_total: number
          id: string
          impresiones: number
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total: number | null
          segmentacion: Json
          unidad_cobro: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campana_publicitaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_campana_sellos: {
        Args: {
          p_negocio_id: string
          p_nombre: string
          p_recompensa_descripcion: string
          p_sellos_requeridos: number
          p_servicio_ids?: string[]
          p_vencimiento_dias?: number
        }
        Returns: {
          created_at: string
          estado: Database["public"]["Enums"]["campana_sellos_estado"]
          id: string
          negocio_id: string
          nombre: string
          recompensa_descripcion: string
          sellos_requeridos: number
          servicio_ids: string[]
          updated_at: string
          vencimiento_dias: number | null
        }
        SetofOptions: {
          from: "*"
          to: "sello_campana"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_cuenta_corporativa: {
        Args: {
          p_contacto_email: string
          p_cupos_totales: number
          p_negocio_id?: string
          p_nit?: string
          p_nombre_empresa: string
          p_vigencia_fin: string
        }
        Returns: {
          activo: boolean
          admin_user_id: string | null
          contacto_email: string
          created_at: string
          cupos_totales: number
          id: string
          negocio_id: string | null
          nit: string | null
          nombre_empresa: string
          sedes_permitidas: string[]
          vigencia_fin: string
          vigencia_inicio: string
        }
        SetofOptions: {
          from: "*"
          to: "corporativo_cuenta"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_gift_card: {
        Args: {
          p_destinatario_email?: string
          p_destinatario_nombre?: string
          p_destinatario_telefono?: string
          p_dias_vigencia?: number
          p_mensaje?: string
          p_monto: number
          p_negocio_id: string
          p_pin: string
        }
        Returns: {
          comision_plataforma_monto: number | null
          comision_plataforma_pct: number | null
          conexion_pago_id: string | null
          created_at: string
          cuenta_cobro: string | null
          entorno: string | null
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
          marketplace_fee: number
          metadata: Json
          monto: number
          monto_reembolsado: number
          motivo_reembolso: string | null
          negocio_id: string | null
          pasarela: string
          payload_pasarela: Json | null
          procesado_at: string | null
          reserva_id: string | null
          staff_destino_id: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pago"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_grupo_familiar: {
        Args: {
          p_descuento_familiar_pct?: number
          p_limite_miembros?: number
          p_negocio_id?: string
          p_nombre?: string
        }
        Returns: {
          created_at: string
          descuento_familiar_pct: number
          id: string
          limite_miembros: number
          negocio_id: string | null
          nombre: string
          saldo_compartido: number
          titular_cliente_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "familia_grupo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_invitacion_staff: {
        Args: {
          p_comision_pct?: number
          p_email: string
          p_negocio_id: string
          p_sede_id: string
        }
        Returns: {
          comision_pct: number | null
          created_at: string
          email: string
          estado: Database["public"]["Enums"]["invitacion_staff_estado"]
          expira_at: string
          id: string
          invitado_por: string
          negocio_id: string
          reenviada_at: string | null
          reenvios_count: number
          respondida_at: string | null
          sede_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invitacion_staff"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_lote_gift_cards_corporativo: {
        Args: {
          p_cantidad: number
          p_cuenta_id: string
          p_monto_cada_una: number
        }
        Returns: Json
      }
      crear_nivel_vip: {
        Args: {
          p_beneficios?: string
          p_negocio_id: string
          p_nombre: string
          p_orden: number
          p_umbral_automatico_gasto?: number
        }
        Returns: {
          beneficios: string | null
          created_at: string
          id: string
          negocio_id: string
          nombre: string
          orden: number
          umbral_automatico_gasto: number | null
        }
        SetofOptions: {
          from: "*"
          to: "vip_nivel"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_pago_sena: {
        Args: { p_reserva_id: string }
        Returns: {
          comision_plataforma_monto: number | null
          comision_plataforma_pct: number | null
          conexion_pago_id: string | null
          created_at: string
          cuenta_cobro: string | null
          entorno: string | null
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
          marketplace_fee: number
          metadata: Json
          monto: number
          monto_reembolsado: number
          motivo_reembolso: string | null
          negocio_id: string | null
          pasarela: string
          payload_pasarela: Json | null
          procesado_at: string | null
          reserva_id: string | null
          staff_destino_id: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pago"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_plan_membresia: {
        Args: {
          p_congelacion_max_dias?: number
          p_descuento_pct?: number
          p_dias_gracia?: number
          p_duracion_meses: number
          p_limite_usos_mes?: number
          p_negocio_id: string
          p_nombre: string
          p_precio: number
          p_prioridad_reserva?: boolean
          p_regalo_cumpleanos?: string
          p_renovacion_automatica?: boolean
          p_servicio_ids?: string[]
        }
        Returns: {
          activo: boolean
          congelacion_max_dias: number
          created_at: string
          descuento_pct: number
          dias_gracia: number
          duracion_meses: number
          id: string
          limite_usos_mes: number | null
          negocio_id: string
          nombre: string
          precio: number
          prioridad_reserva: boolean
          regalo_cumpleanos: string | null
          renovacion_automatica: boolean
          servicio_ids: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "membresia_plan"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_prompt_ia: {
        Args: {
          p_categoria: string
          p_contenido: string
          p_negocio_id: string
          p_nombre: string
          p_tipo: string
          p_variables?: Json
        }
        Returns: {
          activo: boolean
          autor_id: string | null
          categoria: string
          contenido: string
          created_at: string
          id: string
          negocio_id: string | null
          nombre: string
          tipo: string
          updated_at: string
          variables: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "ai_prompt"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_prompt_oficial_ia: {
        Args: {
          p_categoria: string
          p_contenido: string
          p_nombre: string
          p_variables?: Json
        }
        Returns: {
          activo: boolean
          autor_id: string | null
          categoria: string
          contenido: string
          created_at: string
          id: string
          negocio_id: string | null
          nombre: string
          tipo: string
          updated_at: string
          variables: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "ai_prompt"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_regla_cashback: {
        Args: {
          p_limite_mensual?: number
          p_negocio_id: string
          p_porcentaje: number
          p_producto_ids?: string[]
          p_servicio_ids?: string[]
          p_vigencia_dias?: number
        }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          limite_mensual: number | null
          negocio_id: string
          porcentaje: number
          producto_ids: string[]
          servicio_ids: string[]
          vigencia_dias: number | null
        }
        SetofOptions: {
          from: "*"
          to: "cashback_regla"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_regla_recompensa: {
        Args: {
          p_accion: Json
          p_condicion: Json
          p_disparador: string
          p_negocio_id: string
          p_nivel_ia: number
          p_requiere_confirmacion?: boolean
        }
        Returns: {
          accion: Json
          activo: boolean
          condicion: Json
          created_at: string
          disparador: string
          id: string
          negocio_id: string
          nivel_ia: number
          requiere_confirmacion: boolean
        }
        SetofOptions: {
          from: "*"
          to: "recompensa_regla"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_reserva: {
        Args: {
          p_hora_inicio: string
          p_idempotency_key?: string
          p_sede_id: string
          p_servicio_ids: string[]
          p_staff_id?: string
        }
        Returns: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reserva"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_reserva_manual: {
        Args: {
          p_cliente_id: string
          p_hora_inicio: string
          p_sede_id: string
          p_servicio_ids: string[]
          p_staff_id?: string
        }
        Returns: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reserva"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_sede: {
        Args: {
          p_ciudad: string
          p_direccion: string
          p_horario_base: Json
          p_latitud?: number
          p_longitud?: number
          p_negocio_id: string
          p_nombre: string
        }
        Returns: {
          cerrada_permanente: boolean
          cerrada_temporalmente: boolean
          ciudad: string
          created_at: string
          direccion: string
          es_principal: boolean
          horario_base: Json
          id: string
          latitud: number | null
          longitud: number | null
          negocio_id: string
          nombre: string
          updated_at: string
          zona_horaria: string
        }
        SetofOptions: {
          from: "*"
          to: "sede"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_sugerencia_recompensa: {
        Args: {
          p_cliente_id: string
          p_costo_credito_ia?: number
          p_descripcion: string
          p_justificacion?: string
          p_regla_id: string
        }
        Returns: {
          cliente_id: string | null
          costo_credito_ia: number
          created_at: string
          descripcion: string
          estado: string
          id: string
          justificacion: string | null
          negocio_id: string
          regla_id: string
          resuelta_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recompensa_sugerencia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_suscripcion_inicial: {
        Args: {
          p_negocio_id: string
          p_plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_ticket_soporte: {
        Args: { p_asunto: string; p_mensaje: string; p_negocio_id?: string }
        Returns: {
          asunto: string
          creado_por: string
          created_at: string
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          id: string
          negocio_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cuentas_registro_abandonado: {
        Args: { p_horas?: number; p_limite?: number }
        Returns: {
          usuario_id: string
        }[]
      }
      dashboard_ranking_staff_semana: {
        Args: { p_negocio_id: string; p_sede_id?: string }
        Returns: {
          comision_generada: number
          foto_url: string
          nombre: string
          reservas_completadas: number
          sede_nombre: string
          vinculo_id: string
        }[]
      }
      dashboard_resumen_dia: {
        Args: { p_negocio_id: string; p_sede_id?: string }
        Returns: Json
      }
      degradar_vip: {
        Args: {
          p_motivo: string
          p_nivel_nuevo_id: string
          p_vip_miembro_id: string
        }
        Returns: {
          asignado_por: string | null
          cliente_id: string
          created_at: string
          id: string
          negocio_id: string
          nivel_id: string
          origen: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vip_miembro"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      descartar_sugerencia_recompensa: {
        Args: { p_sugerencia_id: string }
        Returns: {
          cliente_id: string | null
          costo_credito_ia: number
          created_at: string
          descripcion: string
          estado: string
          id: string
          justificacion: string | null
          negocio_id: string
          regla_id: string
          resuelta_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recompensa_sugerencia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      detectar_horarios_muertos: {
        Args: { p_negocio_id: string }
        Returns: {
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          horas_disponibles: number
          horas_reservadas: number
          ocupacion_pct: number
          sede_id: string
          sede_nombre: string
          staff_nombre: string
          vinculo_id: string
        }[]
      }
      ejecutar_downgrades_programados: { Args: never; Returns: Json }
      ejecutar_pipeline_evento: {
        Args: { p_evento_tipo: string; p_payload: Json }
        Returns: Json
      }
      elegir_pais_negocio: {
        Args: { p_negocio_id: string; p_pais: string }
        Returns: undefined
      }
      eliminar_banner_home: { Args: { p_id: string }; Returns: undefined }
      enviar_negocio_a_aprobacion: {
        Args: { p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      establecer_sede_principal: {
        Args: { p_sede_id: string }
        Returns: undefined
      }
      estado_sistema: {
        Args: never
        Returns: {
          ahora: string
          fin_estimado: string
          inicio: string
          mantenimiento: boolean
          mensaje: string
          version_actual: string
          version_minima: string
        }[]
      }
      evaluar_ascenso_vip_automatico: {
        Args: { p_cliente_id: string; p_negocio_id: string }
        Returns: {
          asignado_por: string | null
          cliente_id: string
          created_at: string
          id: string
          negocio_id: string
          nivel_id: string
          origen: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vip_miembro"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      evaluar_candidatos_recompensa: {
        Args: { p_regla_id: string }
        Returns: {
          cliente_id: string
          contexto: Json
        }[]
      }
      expirar_reservas_vencidas: { Args: never; Returns: number }
      exportar_mis_datos: { Args: never; Returns: Json }
      finalizar_atencion_reserva: {
        Args: { p_reserva_id: string }
        Returns: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reserva"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalizar_campana: {
        Args: { p_campana_id: string }
        Returns: {
          clics: number
          created_at: string
          estado: Database["public"]["Enums"]["campana_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string
          gasto_hoy: number
          gasto_hoy_fecha: string
          gasto_total: number
          id: string
          impresiones: number
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total: number | null
          segmentacion: Json
          unidad_cobro: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campana_publicitaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      forzar_reactivacion_pago_externo: {
        Args: { p_motivo: string; p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fundador_cupos_restantes: { Args: { p_pais: string }; Returns: number }
      generar_recordatorios_cita: {
        Args: { p_ventana_horas?: number }
        Returns: number
      }
      generar_roi_snapshot_mensual: { Args: never; Returns: Json }
      guardar_marca_negocio: {
        Args: {
          p_color_primario: string
          p_color_secundario: string
          p_logo_url: string
          p_negocio_id: string
          p_nombre: string
          p_publicar: boolean
          p_slogan: string
        }
        Returns: {
          color_primario: string
          color_secundario: string
          estado: string
          logo_url: string | null
          negocio_id: string
          nombre_marca: string
          slogan: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "negocio_marca"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      guardar_memoria_ia: {
        Args: {
          p_categoria: string
          p_contenido: Json
          p_negocio_id: string
          p_sede_id?: string
        }
        Returns: {
          aprobado: boolean
          categoria: string
          contenido: Json
          creado_por: string | null
          created_at: string
          id: string
          negocio_id: string
          sede_id: string | null
          version: number
          vigente: boolean
        }
        SetofOptions: {
          from: "*"
          to: "ai_memoria_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      guardar_permisos: {
        Args: {
          p_completar?: boolean
          p_notificaciones: string
          p_ubicacion: string
        }
        Returns: {
          onboarding_completo: boolean
          permiso_notificaciones: string | null
          permiso_ubicacion: string | null
          updated_at: string
          usuario_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cliente_preferencia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      historial_memoria_ia: {
        Args: { p_categoria: string; p_negocio_id: string }
        Returns: {
          aprobado: boolean
          categoria: string
          contenido: Json
          creado_por: string | null
          created_at: string
          id: string
          negocio_id: string
          sede_id: string | null
          version: number
          vigente: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_memoria_negocio"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      incrementar_session_version: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      iniciar_atencion_reserva: {
        Args: { p_reserva_id: string }
        Returns: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reserva"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      iniciar_prueba_negocio_srv: {
        Args: {
          p_actor: string
          p_ciclo: string
          p_dispositivo_hash: string
          p_documento_hash: string
          p_email_hash: string
          p_metodo_pago_proveedor: string
          p_metodo_pago_ref: string
          p_negocio_id: string
          p_plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          p_telefono_hash: string
        }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_barberia_de: { Args: { p_negocio_id: string }; Returns: boolean }
      is_guardian_de_negocio: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      is_guardian_de_sede: { Args: { p_sede_id: string }; Returns: boolean }
      is_staff_de: { Args: { p_negocio_id: string }; Returns: boolean }
      is_supersu: { Args: never; Returns: boolean }
      libro_registrar_ajuste: {
        Args: {
          p_monto: number
          p_motivo: string
          p_movimiento_id: string
          p_sentido: string
        }
        Returns: string
      }
      libro_totales: {
        Args: {
          p_categoria?: string
          p_desde?: string
          p_entidad?: string
          p_estado?: string
          p_hasta?: string
          p_negocio_id?: string
        }
        Returns: {
          cantidad: number
          categoria: string
          entidad: string
          estado: string
          moneda: string
          periodo: string
          sentido: string
          total: number
        }[]
      }
      limites_politica_cancelacion: { Args: never; Returns: Json }
      limpiar_limite_tasa: { Args: never; Returns: number }
      listar_eventos_fraude: {
        Args: { p_revisado?: boolean }
        Returns: {
          cliente_id: string | null
          created_at: string
          id: string
          negocio_id: string | null
          payload: Json
          revisado: boolean
          severidad: string
          tipo: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lealtad_fraude_evento"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      listar_memoria_ia: {
        Args: { p_negocio_id: string }
        Returns: {
          aprobado: boolean
          categoria: string
          contenido: Json
          creado_por: string | null
          created_at: string
          id: string
          negocio_id: string
          sede_id: string | null
          version: number
          vigente: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_memoria_negocio"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      listar_prompts_ia: {
        Args: { p_negocio_id: string }
        Returns: {
          activo: boolean
          autor_id: string | null
          categoria: string
          contenido: string
          created_at: string
          id: string
          negocio_id: string | null
          nombre: string
          tipo: string
          updated_at: string
          variables: Json
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_prompt"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      listar_sugerencias_recompensa: {
        Args: { p_negocio_id: string }
        Returns: {
          cliente_id: string | null
          costo_credito_ia: number
          created_at: string
          descripcion: string
          estado: string
          id: string
          justificacion: string | null
          negocio_id: string
          regla_id: string
          resuelta_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "recompensa_sugerencia"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mantenimiento_suscripciones: { Args: never; Returns: Json }
      marcar_auth_cerrada: {
        Args: { p_solicitud_id: string }
        Returns: undefined
      }
      marcar_aviso_prueba: {
        Args: { p_negocio_id: string; p_tipo: string }
        Returns: undefined
      }
      marcar_fraude_revisado: {
        Args: { p_evento_id: string }
        Returns: {
          cliente_id: string | null
          created_at: string
          id: string
          negocio_id: string | null
          payload: Json
          revisado: boolean
          severidad: string
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "lealtad_fraude_evento"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marcar_llegada: {
        Args: { p_lat?: number; p_lng?: number; p_reserva_id: string }
        Returns: string
      }
      marcar_negocio_en_mora: {
        Args: { p_motivo: string; p_negocio_id: string }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marcar_no_show: {
        Args: { p_motivo?: string; p_reserva_id: string }
        Returns: undefined
      }
      marketplace_buscar: {
        Args: {
          p_categoria?: string
          p_ciudad?: string
          p_lat?: number
          p_limite?: number
          p_lng?: number
          p_offset?: number
          p_orden?: string
          p_texto?: string
        }
        Returns: {
          calificacion: number
          campana_id: string
          categoria: string[]
          ciudad: string
          descripcion: string
          id: string
          logo_url: string
          nombre: string
          patrocinado: boolean
          precio_desde: number
          proxima_disponibilidad: string
          sede_id: string
          sede_latitud: number
          sede_longitud: number
          slug: string
          total_resenas: number
        }[]
      }
      marketplace_buscar_filtrado: {
        Args: {
          p_abierto_hoy?: boolean
          p_calif_min?: number
          p_categoria?: string
          p_ciudad?: string
          p_lat?: number
          p_limite?: number
          p_lng?: number
          p_offset?: number
          p_orden?: string
          p_radio_km?: number
          p_texto?: string
        }
        Returns: {
          calificacion: number
          campana_id: string
          categoria: string[]
          ciudad: string
          descripcion: string
          distancia_km: number
          id: string
          logo_url: string
          nombre: string
          patrocinado: boolean
          precio_desde: number
          proxima_disponibilidad: string
          sede_id: string
          sede_latitud: number
          sede_longitud: number
          slug: string
          total_count: number
          total_resenas: number
        }[]
      }
      marketplace_ciudades_disponibles: {
        Args: never
        Returns: {
          ciudad: string
        }[]
      }
      marketplace_mi_posicion: {
        Args: { p_negocio_id: string }
        Returns: string
      }
      metricas_ads_plataforma: { Args: never; Returns: Json }
      metricas_campana: { Args: { p_campana_id: string }; Returns: Json }
      metricas_lealtad_negocio: {
        Args: { p_negocio_id: string }
        Returns: Json
      }
      metricas_lealtad_plataforma: { Args: never; Returns: Json }
      mi_cashback: {
        Args: never
        Returns: {
          created_at: string
          estado: Database["public"]["Enums"]["cashback_estado"]
          fecha_expiracion: string
          id: string
          monto: number
          negocio_id: string
          negocio_nombre: string
        }[]
      }
      mi_cita_detalle: { Args: { p_reserva_id: string }; Returns: Json }
      mi_familia: {
        Args: never
        Returns: {
          created_at: string
          descuento_familiar_pct: number
          id: string
          limite_miembros: number
          negocio_id: string | null
          nombre: string
          saldo_compartido: number
          titular_cliente_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "familia_grupo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mi_look_compartir: {
        Args: { p_compartir: boolean; p_foto_id: string }
        Returns: boolean
      }
      mi_look_listar: {
        Args: { p_limite?: number }
        Returns: {
          compartida: boolean
          foto_id: string
          hora_inicio: string
          momento: string
          negocio_nombre: string
          reserva_id: string
          servicios: string
          staff_nombre: string
          url: string
        }[]
      }
      mi_nivel_vip: {
        Args: { p_negocio_id: string }
        Returns: {
          beneficios: string
          nivel_nombre: string
          orden: number
        }[]
      }
      mi_saldo: { Args: never; Returns: Json }
      mi_vinculo: {
        Args: never
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mis_pagos: {
        Args: { p_filtro?: string; p_limite?: number }
        Returns: {
          categoria: string
          concepto: string
          estado: string
          fecha: string
          monto: number
          negocio_nombre: string
          referencia_id: string
        }[]
      }
      mis_referidos: {
        Args: never
        Returns: {
          completado_at: string
          created_at: string
          estado: Database["public"]["Enums"]["referido_estado"]
          id: string
          monto_recompensa: number
        }[]
      }
      mis_referidos_detalle: { Args: never; Returns: Json }
      mis_referidos_staff: {
        Args: { p_negocio_id: string }
        Returns: {
          completado_at: string
          created_at: string
          estado: Database["public"]["Enums"]["referido_estado"]
          id: string
          recompensa_monto: number
          recompensa_tipo: string
        }[]
      }
      mis_sellos: {
        Args: { p_negocio_id?: string }
        Returns: {
          campana_id: string
          campana_nombre: string
          negocio_id: string
          negocio_nombre: string
          recompensa_descripcion: string
          sellos_actuales: number
          sellos_requeridos: number
        }[]
      }
      moderar_resena: {
        Args: { p_accion: string; p_motivo?: string; p_resena_id: string }
        Returns: {
          calificacion: number
          cliente_id: string
          comentario: string | null
          created_at: string
          estado: Database["public"]["Enums"]["resena_estado"]
          id: string
          moderado_motivo: string | null
          moderado_por: string | null
          negocio_id: string
          reserva_id: string
          respuesta_negocio: string | null
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "resena"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      negocio_cobra_en_linea: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      negocio_funcion_valor: {
        Args: { p_clave: string; p_negocio_id: string }
        Returns: string
      }
      negocio_puede_recibir_reservas: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      negocio_resenas_publicas: {
        Args: { p_limite?: number; p_negocio_id: string }
        Returns: {
          calificacion: number
          cliente_nombre: string
          comentario: string
          created_at: string
          id: string
          respuesta_negocio: string
          staff_nombre: string
        }[]
      }
      negocio_staff_publico: {
        Args: { p_negocio_id: string }
        Returns: {
          especialidad: string
          foto_url: string
          nivel: Database["public"]["Enums"]["nivel_staff"]
          nombre: string
          servicio_ids: string[]
          staff_id: string
        }[]
      }
      negocio_tiene_funcion: {
        Args: { p_clave: string; p_negocio_id: string }
        Returns: boolean
      }
      negocio_visible_en_mapa: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      notif_entregar_panel: { Args: { p_limite?: number }; Returns: number }
      notif_generar_programadas: {
        Args: { p_ventana_horas?: number }
        Returns: Json
      }
      notif_outbox_reencolar_no_habilitados: {
        Args: { p_canal: string; p_max_horas?: number }
        Returns: number
      }
      notif_outbox_registrar: {
        Args: {
          p_codigo?: string
          p_id: string
          p_id_externo?: string
          p_ok: boolean
          p_reintentable?: boolean
        }
        Returns: string
      }
      notif_outbox_tomar: {
        Args: { p_canales?: string[]; p_limite?: number }
        Returns: {
          asunto: string
          canal: string
          categoria: string
          cuerpo: string
          datos: Json
          email: string
          evento: string
          id: string
          idioma: string
          intentos: number
          negocio_id: string
          plantilla: string
          push_suscripciones: Json
          usuario_id: string
        }[]
      }
      notif_preferencia_guardar: {
        Args: { p_activo: boolean; p_canal: string; p_evento: string }
        Returns: boolean
      }
      notif_preferencias_listar: {
        Args: never
        Returns: {
          audiencia: string
          descripcion: string
          email_activo: boolean
          esencial: boolean
          evento: string
          push_activo: boolean
        }[]
      }
      notif_push_desuscribir: { Args: { p_endpoint: string }; Returns: boolean }
      notif_push_eliminar_endpoint: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      notif_push_suscribir: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: string
      }
      notificacion_marcar_leida: { Args: { p_id: string }; Returns: boolean }
      notificaciones_listar: {
        Args: { p_limite?: number; p_solo_no_leidas?: boolean }
        Returns: {
          created_at: string
          cuerpo: string
          id: string
          leida: boolean
          negocio_id: string
          reserva_id: string
          tipo: string
          titulo: string
        }[]
      }
      notificaciones_marcar_todas_leidas: { Args: never; Returns: number }
      notificaciones_no_leidas: { Args: never; Returns: number }
      oauth_consumir: {
        Args: { p_actor: string; p_state_hash: string }
        Returns: {
          negocio_id: string
          verifier_cifrado: string
        }[]
      }
      oauth_iniciar: {
        Args: {
          p_actor: string
          p_negocio_id: string
          p_state_hash: string
          p_verifier_cifrado: string
        }
        Returns: undefined
      }
      obtener_mi_codigo_referido: {
        Args: never
        Returns: {
          cliente_id: string
          codigo: string
          created_at: string
          id: string
        }
        SetofOptions: {
          from: "*"
          to: "referido_codigo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      obtener_preferencias: { Args: never; Returns: Json }
      ofertas_cercanas: {
        Args: {
          p_lat?: number
          p_limite?: number
          p_lng?: number
          p_radio_km?: number
        }
        Returns: {
          descripcion: string
          dias_semana: number[]
          distancia_km: number
          negocio_id: string
          negocio_nombre: string
          oferta_id: string
          sede_id: string
          slug: string
          tipo_descuento: string
          titulo: string
          valor: number
          vigente_hasta: string
        }[]
      }
      olvidar_memoria_ia: { Args: { p_memoria_id: string }; Returns: undefined }
      otorgar_creditos_plan_mensual: { Args: never; Returns: Json }
      pausar_campana: {
        Args: { p_campana_id: string; p_motivo?: string }
        Returns: {
          clics: number
          created_at: string
          estado: Database["public"]["Enums"]["campana_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string
          gasto_hoy: number
          gasto_hoy_fecha: string
          gasto_total: number
          id: string
          impresiones: number
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total: number | null
          segmentacion: Json
          unidad_cobro: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campana_publicitaria"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      politica_de_reserva: { Args: { p_reserva_id: string }; Returns: Json }
      privacidad_estado: {
        Args: never
        Returns: {
          desde: string
          otorgado: boolean
          proposito: string
        }[]
      }
      privacidad_guardar: {
        Args: { p_preferencias: Json }
        Returns: {
          desde: string
          otorgado: boolean
          proposito: string
        }[]
      }
      privacidad_historial: {
        Args: { p_limite?: number }
        Returns: {
          fecha: string
          proposito: string
          tipo: string
          valor: string
        }[]
      }
      procesar_eliminaciones_cuenta: {
        Args: { p_limite?: number }
        Returns: Json
      }
      promover_guardian: {
        Args: { p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pruebas_por_cobrar: {
        Args: never
        Returns: {
          ciclo: string
          metodo_pago_proveedor: string
          metodo_pago_ref: string
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }[]
      }
      publicar_texto_legal: {
        Args: {
          p_cambio_material: boolean
          p_contenido: string
          p_tipo: string
        }
        Returns: {
          cambio_material: boolean
          contenido: string
          id: string
          publicado_at: string
          tipo: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "texto_legal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quitar_miembro_familiar: {
        Args: { p_cliente_id: string; p_familia_id: string }
        Returns: undefined
      }
      reabrir_sede: {
        Args: { p_sede_id: string }
        Returns: {
          cerrada_permanente: boolean
          cerrada_temporalmente: boolean
          ciudad: string
          created_at: string
          direccion: string
          es_principal: boolean
          horario_base: Json
          id: string
          latitud: number | null
          longitud: number | null
          negocio_id: string
          nombre: string
          updated_at: string
          zona_horaria: string
        }
        SetofOptions: {
          from: "*"
          to: "sede"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reactivar_membresia_congelada: {
        Args: { p_cliente_membresia_id: string }
        Returns: {
          cliente_id: string
          congelada_hasta: string | null
          created_at: string
          estado: Database["public"]["Enums"]["membresia_estado"]
          fecha_inicio: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_id: string
          updated_at: string
          usos_mes_actual: number
          usos_mes_fecha: string
        }
        SetofOptions: {
          from: "*"
          to: "cliente_membresia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reactivar_negocio_supersu: {
        Args: { p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reactivar_staff: {
        Args: { p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reasignar_staff_reserva: {
        Args: {
          p_motivo?: string
          p_nuevo_staff_id: string
          p_reserva_id: string
        }
        Returns: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reserva"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rechazar_negocio: {
        Args: { p_motivo: string; p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redimir_gift_card: {
        Args: { p_codigo: string; p_pin: string }
        Returns: {
          cliente_id: string
          created_at: string
          id: string
          saldo_disponible: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lealtad_wallet"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redimir_gift_card_pos: {
        Args: { p_cliente_id: string; p_codigo: string; p_pin: string }
        Returns: number
      }
      reembolso_registrar_resultado: {
        Args: {
          p_error?: string
          p_estado_pasarela: string
          p_id_pasarela: string
          p_reembolso_id: string
        }
        Returns: string
      }
      reembolso_tomar_pendientes: {
        Args: { p_limite?: number }
        Returns: {
          cliente_id: string | null
          confirmado_at: string | null
          created_at: string
          estado: string
          id: string
          id_reembolso_pasarela: string | null
          idempotency_key: string
          intentos: number
          monto: number
          motivo: string
          negocio_id: string | null
          origen: string
          pago_id: string
          pct: number
          reserva_id: string | null
          solicitado_at: string | null
          ultimo_error: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "reembolso"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reenviar_invitacion: {
        Args: { p_invitacion_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          email: string
          estado: Database["public"]["Enums"]["invitacion_staff_estado"]
          expira_at: string
          id: string
          invitado_por: string
          negocio_id: string
          reenviada_at: string | null
          reenvios_count: number
          respondida_at: string | null
          sede_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invitacion_staff"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_clic_patrocinado: {
        Args: { p_campana_id: string; p_negocio_id: string }
        Returns: undefined
      }
      registrar_consumo_corporativo: {
        Args: { p_miembro_id: string; p_monto?: number; p_reserva_id: string }
        Returns: {
          created_at: string
          id: string
          miembro_id: string
          monto: number
          reserva_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "corporativo_consumo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_egreso_caja: {
        Args: {
          p_categoria?: string
          p_concepto: string
          p_monto: number
          p_negocio_id: string
          p_sede_id: string
        }
        Returns: string
      }
      registrar_evento_fraude: {
        Args: {
          p_negocio_id?: string
          p_payload?: Json
          p_severidad?: string
          p_tipo: string
        }
        Returns: undefined
      }
      registrar_evento_patrocinado: {
        Args: {
          p_campana_id: string
          p_huella: string
          p_negocio_id: string
          p_tipo: string
        }
        Returns: boolean
      }
      registrar_impresion_patrocinada: {
        Args: { p_campana_id: string }
        Returns: undefined
      }
      registrar_intento_auth: {
        Args: { p_email: string; p_exitoso: boolean; p_tipo: string }
        Returns: undefined
      }
      registrar_movimiento_inventario: {
        Args: {
          p_cantidad: number
          p_motivo?: string
          p_producto_id: string
          p_sede_id: string
          p_tipo: Database["public"]["Enums"]["movimiento_inventario_tipo"]
        }
        Returns: {
          id: string
          negocio_id: string
          producto_id: string
          sede_id: string
          stock_actual: number
          stock_minimo: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "producto_stock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_referido: {
        Args: { p_codigo: string; p_negocio_id?: string }
        Returns: {
          completado_at: string | null
          created_at: string
          estado: Database["public"]["Enums"]["referido_estado"]
          id: string
          monto_recompensa: number | null
          negocio_id: string | null
          referente_cliente_id: string
          referido_cliente_id: string
          referido_codigo_id: string
          reserva_completada_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_referido_staff: {
        Args: {
          p_cliente_referido_id: string
          p_negocio_id: string
          p_recompensa_monto: number
          p_recompensa_tipo: string
        }
        Returns: {
          cliente_referido_id: string
          completado_at: string | null
          created_at: string
          estado: Database["public"]["Enums"]["referido_estado"]
          id: string
          negocio_id: string
          recompensa_monto: number | null
          recompensa_tipo: string | null
          reserva_completada_id: string | null
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_referido"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_resultado_cobro: {
        Args: { p_exito: boolean; p_motivo?: string; p_negocio_id: string }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_uso_membresia: {
        Args: {
          p_cliente_membresia_id: string
          p_monto_beneficio?: number
          p_reserva_id: string
          p_tipo: string
        }
        Returns: {
          cliente_membresia_id: string
          created_at: string
          id: string
          monto_beneficio: number
          reserva_id: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "membresia_uso"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_visita_perfil: {
        Args: { p_campana_id?: string; p_negocio_id: string }
        Returns: undefined
      }
      reportar_resena: {
        Args: { p_motivo: string; p_resena_id: string }
        Returns: {
          calificacion: number
          cliente_id: string
          comentario: string | null
          created_at: string
          estado: Database["public"]["Enums"]["resena_estado"]
          id: string
          moderado_motivo: string | null
          moderado_por: string | null
          negocio_id: string
          reserva_id: string
          respuesta_negocio: string | null
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "resena"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reportes_corporativo: { Args: { p_cuenta_id: string }; Returns: Json }
      reportes_ingresos_periodo: {
        Args: {
          p_agrupacion?: string
          p_desde?: string
          p_hasta?: string
          p_negocio_id: string
          p_sede_id?: string
        }
        Returns: {
          citas_completadas: number
          ingresos: number
          periodo: string
        }[]
      }
      reportes_ranking_staff: {
        Args: {
          p_desde?: string
          p_hasta?: string
          p_negocio_id: string
          p_sede_id?: string
          p_vinculo_id?: string
        }
        Returns: {
          comision_generada: number
          foto_url: string
          nombre: string
          reservas_completadas: number
          sede_nombre: string
          vinculo_id: string
        }[]
      }
      reportes_servicios_top: {
        Args: {
          p_desde?: string
          p_hasta?: string
          p_negocio_id: string
          p_sede_id?: string
        }
        Returns: {
          ingresos: number
          nombre: string
          servicio_id: string
          veces_vendido: number
        }[]
      }
      reprogramar_reserva: {
        Args: {
          p_motivo?: string
          p_nueva_hora_inicio: string
          p_reserva_id: string
        }
        Returns: {
          bloqueo_fin: string | null
          bloqueo_inicio: string | null
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          cancelado_motivo: string | null
          cancelado_por: string | null
          checkin_at: string | null
          checkout_at: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["reserva_estado"]
          expira_at: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          idempotency_key: string | null
          monto_sena: number
          monto_total: number
          negocio_id: string
          rango: unknown
          recurso_id: string | null
          sede_id: string
          staff_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reserva"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      responder_invitacion: {
        Args: { p_aceptar: boolean; p_invitacion_id: string }
        Returns: Json
      }
      responder_ticket_soporte: {
        Args: { p_mensaje: string; p_ticket_id: string }
        Returns: {
          actor_tipo: string
          autor_id: string
          created_at: string
          id: string
          mensaje: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_mensaje"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restaurar_version_memoria_ia: {
        Args: { p_memoria_id_historica: string }
        Returns: {
          aprobado: boolean
          categoria: string
          contenido: Json
          creado_por: string | null
          created_at: string
          id: string
          negocio_id: string
          sede_id: string | null
          version: number
          vigente: boolean
        }
        SetofOptions: {
          from: "*"
          to: "ai_memoria_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resumen_eliminacion_cuenta: { Args: never; Returns: Json }
      retirar_empleado_corporativo: {
        Args: { p_cliente_id: string; p_cuenta_id: string }
        Returns: undefined
      }
      retirar_staff: {
        Args: { p_motivo?: string; p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revertir_comision_wallet: {
        Args: { p_monto_reembolsado: number; p_pago_id: string }
        Returns: undefined
      }
      revocar_guardian: {
        Args: { p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      saldo_creditos_ia: { Args: { p_negocio_id: string }; Returns: number }
      sembrar_niveles_vip_default: {
        Args: { p_negocio_id: string }
        Returns: {
          beneficios: string | null
          created_at: string
          id: string
          negocio_id: string
          nombre: string
          orden: number
          umbral_automatico_gasto: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vip_nivel"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      simular_consumo_ia: {
        Args: {
          p_num_clientes: number
          p_num_staff: number
          p_plan_codigo: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: Json
      }
      slots_disponibles: {
        Args: {
          p_fecha: string
          p_granularidad_minutos?: number
          p_sede_id: string
          p_servicio_ids: string[]
          p_staff_id?: string
        }
        Returns: {
          disponible: boolean
          hora_fin: string
          hora_inicio: string
          recurso_id: string
          staff_id: string
        }[]
      }
      solicitar_devolucion_saldo: {
        Args: { p_monto?: number }
        Returns: {
          cliente_id: string
          created_at: string
          estado: string
          id: string
          monto: number
          origen: string
          resuelta_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "solicitud_devolucion_saldo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      solicitar_downgrade_plan: {
        Args: {
          p_negocio_id: string
          p_plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: {
          activacion_manual: boolean
          aviso_1d_at: string | null
          aviso_3d_at: string | null
          ciclo: string
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          gracia_fin: string | null
          id: string
          manual_hasta: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          metodo_pago_proveedor: string | null
          metodo_pago_ref: string | null
          negocio_id: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          prueba_fin: string | null
          prueba_inicio: string | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      solicitar_eliminacion_cuenta: {
        Args: { p_confirmacion: string }
        Returns: {
          auth_cerrada: boolean
          cancelada_at: string | null
          created_at: string
          ejecutada_at: string | null
          error: string | null
          estado: string
          id: string
          intentos: number
          programada_para: string | null
          tipo: string
          usuario_id: string
        }
        SetofOptions: {
          from: "*"
          to: "solicitud_cuenta"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      solicitar_upgrade_plan: {
        Args: {
          p_negocio_id: string
          p_plan_codigo_nuevo: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: {
          comision_plataforma_monto: number | null
          comision_plataforma_pct: number | null
          conexion_pago_id: string | null
          created_at: string
          cuenta_cobro: string | null
          entorno: string | null
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
          marketplace_fee: number
          metadata: Json
          monto: number
          monto_reembolsado: number
          motivo_reembolso: string | null
          negocio_id: string | null
          pasarela: string
          payload_pasarela: Json | null
          procesado_at: string | null
          reserva_id: string | null
          staff_destino_id: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pago"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      staff_de_sede: {
        Args: { p_sede_id: string }
        Returns: {
          es_guardian: boolean
          especialidad: string
          foto_url: string
          nivel: Database["public"]["Enums"]["nivel_staff"]
          nombre: string
          staff_id: string
          vinculo_id: string
        }[]
      }
      staff_mi_nivel_actual: { Args: never; Returns: Json }
      staff_mis_propinas: {
        Args: { p_desde?: string; p_hasta?: string }
        Returns: number
      }
      staff_perfil_publico: {
        Args: { p_negocio_id: string; p_staff_id: string }
        Returns: Json
      }
      staff_resenas_publicas: {
        Args: {
          p_limite?: number
          p_negocio_id: string
          p_offset?: number
          p_staff_id: string
        }
        Returns: {
          calificacion: number
          cliente_nombre: string
          comentario: string
          created_at: string
          id: string
          respuesta_negocio: string
          servicios: string
        }[]
      }
      supersu_configurar_sistema: {
        Args: {
          p_fin_estimado?: string
          p_inicio?: string
          p_mantenimiento: boolean
          p_mensaje?: string
          p_version_actual?: string
          p_version_minima?: string
        }
        Returns: undefined
      }
      suscribirse_membresia: {
        Args: { p_plan_id: string }
        Returns: {
          comision_plataforma_monto: number | null
          comision_plataforma_pct: number | null
          conexion_pago_id: string | null
          created_at: string
          cuenta_cobro: string | null
          entorno: string | null
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
          marketplace_fee: number
          metadata: Json
          monto: number
          monto_reembolsado: number
          motivo_reembolso: string | null
          negocio_id: string | null
          pasarela: string
          payload_pasarela: Json | null
          procesado_at: string | null
          reserva_id: string | null
          staff_destino_id: string | null
          tipo: Database["public"]["Enums"]["pago_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pago"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspender_negocio: {
        Args: { p_causa?: string; p_motivo: string; p_negocio_id: string }
        Returns: {
          anticipo_modo: string
          categoria: string[]
          ciudad: string
          comision_plataforma_pct: number
          created_at: string
          descripcion: string | null
          elegibilidad_marketplace: boolean
          email_contacto: string | null
          estado: Database["public"]["Enums"]["negocio_estado"]
          id: string
          identificacion_fiscal: string | null
          logo_url: string | null
          max_anticipacion_dias: number
          min_anticipacion_minutos: number
          nombre: string
          onboarding_completo: boolean
          owner_user_id: string
          pago_completo_en_app: boolean
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          puntos_expiracion_meses: number
          puntos_valor_100_cop: number
          reembolso_parcial_pct: number
          sena_maximo: number
          sena_minimo: number
          sena_monto_fijo: number | null
          sena_pct: number | null
          slug: string
          telefono_contacto: string | null
          updated_at: string
          ventana_reembolso_parcial_horas: number
          ventana_reembolso_total_horas: number
        }
        SetofOptions: {
          from: "*"
          to: "negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspender_staff: {
        Args: { p_motivo?: string; p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      telefono_valido_registro: {
        Args: { p_pais: string; p_telefono: string }
        Returns: boolean
      }
      temporada_actual_id: { Args: never; Returns: string }
      texto_politica_cancelacion: {
        Args: { p_parcial: number; p_pct: number; p_total: number }
        Returns: string
      }
      tiene_acceso_interno: { Args: { p_negocio_id: string }; Returns: boolean }
      trasladar_staff: {
        Args: { p_nueva_sede_id: string; p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vinculo_staff_negocio"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verificar_rate_limit_auth: {
        Args: { p_email: string; p_tipo: string }
        Returns: undefined
      }
      webhook_marcar_procesado: {
        Args: { p_proveedor: string; p_request_id: string; p_resultado: string }
        Returns: undefined
      }
      webhook_registrar: {
        Args: {
          p_conexion_id: string
          p_data_id: string
          p_proveedor: string
          p_request_id: string
          p_topico: string
        }
        Returns: boolean
      }
      whatsapp_acreditar_recarga: {
        Args: { p_compra_id: string; p_pago_id: string }
        Returns: string
      }
      whatsapp_admin_actualizar_config: {
        Args: {
          p_meses_vencimiento_recarga: number
          p_motivo: string
          p_pct_marketing_plan: number
          p_pct_marketing_recarga: number
          p_proveedor: string
          p_umbrales_alerta: number[]
        }
        Returns: undefined
      }
      whatsapp_admin_alternar_paquete: {
        Args: { p_activo: boolean; p_motivo: string; p_paquete_id: string }
        Returns: undefined
      }
      whatsapp_admin_crear_paquete: {
        Args: {
          p_codigo: string
          p_conversaciones: number
          p_moneda: string
          p_motivo: string
          p_nombre: string
          p_precio: number
        }
        Returns: string
      }
      whatsapp_admin_estado_conexion: {
        Args: { p_estado: string; p_motivo: string }
        Returns: undefined
      }
      whatsapp_admin_resumen: { Args: never; Returns: Json }
      whatsapp_admin_versionar_paquete: {
        Args: {
          p_conversaciones: number
          p_motivo: string
          p_nombre: string
          p_paquete_id: string
          p_precio: number
        }
        Returns: string
      }
      whatsapp_campana_cancelar: {
        Args: { p_campana_id: string }
        Returns: undefined
      }
      whatsapp_campana_crear: {
        Args: {
          p_negocio_id: string
          p_nombre: string
          p_plantilla_id: string
          p_programada_at: string
          p_segmento: Json
        }
        Returns: string
      }
      whatsapp_campana_programar: {
        Args: { p_campana_id: string }
        Returns: string
      }
      whatsapp_cancelar_recarga: {
        Args: { p_compra_id: string }
        Returns: undefined
      }
      whatsapp_otorgar_lote_plan: {
        Args: { p_negocio_id: string; p_periodo?: string }
        Returns: string
      }
      whatsapp_otorgar_lotes_plan_mes: { Args: never; Returns: number }
      whatsapp_panel_resumen: { Args: { p_negocio_id: string }; Returns: Json }
      whatsapp_plantilla_eliminar: {
        Args: { p_plantilla_id: string }
        Returns: undefined
      }
      whatsapp_plantilla_guardar: {
        Args: {
          p_categoria: string
          p_cuerpo: string
          p_idioma: string
          p_negocio_id: string
          p_nombre: string
          p_plantilla_id: string
          p_variables: Json
        }
        Returns: string
      }
      whatsapp_segmento_contar: {
        Args: { p_negocio_id: string; p_segmento: Json }
        Returns: Json
      }
      whatsapp_sistema_actualizar_estado: {
        Args: {
          p_estado: string
          p_evidencia: Json
          p_proveedor_mensaje_id: string
        }
        Returns: boolean
      }
      whatsapp_sistema_cerrar_campana: {
        Args: { p_campana_id: string }
        Returns: boolean
      }
      whatsapp_sistema_estado_conexion: {
        Args: { p_detalle: string; p_estado: string }
        Returns: undefined
      }
      whatsapp_sistema_plantilla_estado: {
        Args: {
          p_estado: string
          p_motivo: string
          p_plantilla_id: string
          p_proveedor_plantilla_id: string
        }
        Returns: undefined
      }
      whatsapp_sistema_preparar_campana: {
        Args: { p_campana_id: string }
        Returns: number
      }
      whatsapp_sistema_preparar_mensaje_utilidad: {
        Args: {
          p_cliente_id: string
          p_negocio_id: string
          p_plantilla_id: string
          p_referencia_id: string
          p_referencia_tipo: string
          p_variables: Json
        }
        Returns: string
      }
      whatsapp_sistema_registrar_envio: {
        Args: {
          p_evidencia: Json
          p_mensaje_id: string
          p_proveedor_mensaje_id: string
        }
        Returns: boolean
      }
      whatsapp_sistema_registrar_fallo: {
        Args: {
          p_error_codigo: string
          p_error_detalle: string
          p_evidencia: Json
          p_mensaje_id: string
        }
        Returns: boolean
      }
      whatsapp_sistema_reservar_envio: {
        Args: { p_mensaje_id: string }
        Returns: Json
      }
      whatsapp_solicitar_recarga: {
        Args: { p_negocio_id: string; p_paquete_id: string }
        Returns: string
      }
    }
    Enums: {
      campana_estado:
        | "BORRADOR"
        | "ACTIVA"
        | "PAUSADA"
        | "AGOTADA"
        | "FINALIZADA"
      campana_sellos_estado: "ACTIVA" | "PAUSADA" | "FINALIZADA"
      cashback_estado: "PENDIENTE" | "DISPONIBLE" | "UTILIZADO" | "EXPIRADO"
      categoria_puntaje: "ESTANDAR" | "PREMIUM" | "COMPLEMENTARIO"
      gift_card_estado: "ACTIVA" | "BLOQUEADA" | "CANJEADA" | "VENCIDA"
      invitacion_staff_estado:
        | "PENDIENTE"
        | "ACEPTADA"
        | "EXPIRADA"
        | "CANCELADA"
        | "RECHAZADA"
      lealtad_origen:
        | "GIFT_CARD"
        | "REFERIDO"
        | "CASHBACK"
        | "PROMOCION"
        | "SELLO_CONVERTIDO"
        | "VIP_BONO"
        | "CANJE"
      lista_espera_estado:
        | "ACTIVA"
        | "NOTIFICADA"
        | "CONVERTIDA"
        | "EXPIRADA_VENTANA"
        | "EXPIRADA_FECHA"
        | "CANCELADA"
      membresia_estado:
        | "ACTIVA"
        | "PROXIMA_A_VENCER"
        | "SUSPENDIDA"
        | "CANCELADA"
        | "VENCIDA"
      movimiento_inventario_tipo:
        | "ENTRADA"
        | "SALIDA"
        | "AJUSTE"
        | "CONSUMO_SERVICIO"
      negocio_estado:
        | "PENDIENTE_APROBACION"
        | "ACTIVO"
        | "SUSPENDIDO"
        | "RECHAZADO"
        | "CANCELADO"
      nivel_staff: "PRO" | "EXPERT" | "MASTER"
      pago_estado:
        | "PENDIENTE"
        | "APROBADO"
        | "RECHAZADO"
        | "REEMBOLSADO"
        | "REEMBOLSADO_PARCIAL"
        | "EN_DISPUTA"
      pago_tipo:
        | "SENA"
        | "SALDO"
        | "PROPINA"
        | "GIFT_CARD"
        | "MEMBRESIA"
        | "PAQUETE_CREDITOS_IA"
        | "PAQUETE_CONVERSACIONES_WHATSAPP"
        | "SUSCRIPCION"
      plan_codigo: "ESSENTIAL" | "STUDIO" | "PRESTIGE" | "SIGNATURE"
      recurso_estado: "DISPONIBLE" | "FUERA_DE_SERVICIO"
      referido_estado: "PENDIENTE" | "COMPLETADO" | "EXPIRADO"
      resena_estado: "VISIBLE" | "REPORTADA" | "ELIMINADA"
      reserva_estado:
        | "PENDIENTE_PAGO"
        | "CONFIRMADA"
        | "EN_CURSO"
        | "COMPLETADA"
        | "CANCELADA"
        | "NO_SHOW"
      servicio_estado: "ACTIVO" | "INACTIVO"
      solicitud_reposicion_estado: "PENDIENTE" | "ATENDIDA" | "CANCELADA"
      suscripcion_estado:
        | "ACTIVA"
        | "EN_MORA"
        | "SUSPENDIDA"
        | "CANCELADA"
        | "TRIAL"
        | "REQUIERE_PLAN"
      temporada_estado: "EN_CURSO" | "CERRADA" | "CONSOLIDADA"
      ticket_soporte_estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO"
      vinculo_estado: "INVITADO" | "ACTIVO" | "SUSPENDIDO" | "RETIRADO"
      whatsapp_campana_estado:
        | "BORRADOR"
        | "PROGRAMADA"
        | "BLOQUEADA_SIN_CONEXION"
        | "EN_ENVIO"
        | "COMPLETADA"
        | "CANCELADA"
      whatsapp_categoria: "UTILIDAD" | "MARKETING"
      whatsapp_compra_estado: "PENDIENTE_PAGO" | "ACREDITADA" | "CANCELADA"
      whatsapp_estado_conexion:
        | "NO_CONFIGURADO"
        | "PENDIENTE_CREDENCIALES"
        | "SANDBOX"
        | "PRODUCCION"
        | "SUSPENDIDO"
        | "REVOCADO"
        | "ERROR"
      whatsapp_mensaje_estado:
        | "PREPARADO"
        | "BLOQUEADO_SIN_CONEXION"
        | "ENVIADO"
        | "ENTREGADO"
        | "LEIDO"
        | "FALLIDO"
      whatsapp_plantilla_estado:
        | "BORRADOR"
        | "PENDIENTE_APROBACION"
        | "APROBADA"
        | "RECHAZADA"
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
      campana_estado: [
        "BORRADOR",
        "ACTIVA",
        "PAUSADA",
        "AGOTADA",
        "FINALIZADA",
      ],
      campana_sellos_estado: ["ACTIVA", "PAUSADA", "FINALIZADA"],
      cashback_estado: ["PENDIENTE", "DISPONIBLE", "UTILIZADO", "EXPIRADO"],
      categoria_puntaje: ["ESTANDAR", "PREMIUM", "COMPLEMENTARIO"],
      gift_card_estado: ["ACTIVA", "BLOQUEADA", "CANJEADA", "VENCIDA"],
      invitacion_staff_estado: [
        "PENDIENTE",
        "ACEPTADA",
        "EXPIRADA",
        "CANCELADA",
        "RECHAZADA",
      ],
      lealtad_origen: [
        "GIFT_CARD",
        "REFERIDO",
        "CASHBACK",
        "PROMOCION",
        "SELLO_CONVERTIDO",
        "VIP_BONO",
        "CANJE",
      ],
      lista_espera_estado: [
        "ACTIVA",
        "NOTIFICADA",
        "CONVERTIDA",
        "EXPIRADA_VENTANA",
        "EXPIRADA_FECHA",
        "CANCELADA",
      ],
      membresia_estado: [
        "ACTIVA",
        "PROXIMA_A_VENCER",
        "SUSPENDIDA",
        "CANCELADA",
        "VENCIDA",
      ],
      movimiento_inventario_tipo: [
        "ENTRADA",
        "SALIDA",
        "AJUSTE",
        "CONSUMO_SERVICIO",
      ],
      negocio_estado: [
        "PENDIENTE_APROBACION",
        "ACTIVO",
        "SUSPENDIDO",
        "RECHAZADO",
        "CANCELADO",
      ],
      nivel_staff: ["PRO", "EXPERT", "MASTER"],
      pago_estado: [
        "PENDIENTE",
        "APROBADO",
        "RECHAZADO",
        "REEMBOLSADO",
        "REEMBOLSADO_PARCIAL",
        "EN_DISPUTA",
      ],
      pago_tipo: [
        "SENA",
        "SALDO",
        "PROPINA",
        "GIFT_CARD",
        "MEMBRESIA",
        "PAQUETE_CREDITOS_IA",
        "PAQUETE_CONVERSACIONES_WHATSAPP",
        "SUSCRIPCION",
      ],
      plan_codigo: ["ESSENTIAL", "STUDIO", "PRESTIGE", "SIGNATURE"],
      recurso_estado: ["DISPONIBLE", "FUERA_DE_SERVICIO"],
      referido_estado: ["PENDIENTE", "COMPLETADO", "EXPIRADO"],
      resena_estado: ["VISIBLE", "REPORTADA", "ELIMINADA"],
      reserva_estado: [
        "PENDIENTE_PAGO",
        "CONFIRMADA",
        "EN_CURSO",
        "COMPLETADA",
        "CANCELADA",
        "NO_SHOW",
      ],
      servicio_estado: ["ACTIVO", "INACTIVO"],
      solicitud_reposicion_estado: ["PENDIENTE", "ATENDIDA", "CANCELADA"],
      suscripcion_estado: [
        "ACTIVA",
        "EN_MORA",
        "SUSPENDIDA",
        "CANCELADA",
        "TRIAL",
        "REQUIERE_PLAN",
      ],
      temporada_estado: ["EN_CURSO", "CERRADA", "CONSOLIDADA"],
      ticket_soporte_estado: ["ABIERTO", "EN_PROCESO", "RESUELTO"],
      vinculo_estado: ["INVITADO", "ACTIVO", "SUSPENDIDO", "RETIRADO"],
      whatsapp_campana_estado: [
        "BORRADOR",
        "PROGRAMADA",
        "BLOQUEADA_SIN_CONEXION",
        "EN_ENVIO",
        "COMPLETADA",
        "CANCELADA",
      ],
      whatsapp_categoria: ["UTILIDAD", "MARKETING"],
      whatsapp_compra_estado: ["PENDIENTE_PAGO", "ACREDITADA", "CANCELADA"],
      whatsapp_estado_conexion: [
        "NO_CONFIGURADO",
        "PENDIENTE_CREDENCIALES",
        "SANDBOX",
        "PRODUCCION",
        "SUSPENDIDO",
        "REVOCADO",
        "ERROR",
      ],
      whatsapp_mensaje_estado: [
        "PREPARADO",
        "BLOQUEADO_SIN_CONEXION",
        "ENVIADO",
        "ENTREGADO",
        "LEIDO",
        "FALLIDO",
      ],
      whatsapp_plantilla_estado: [
        "BORRADOR",
        "PENDIENTE_APROBACION",
        "APROBADA",
        "RECHAZADA",
      ],
    },
  },
} as const


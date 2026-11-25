export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      aceptacion_legal: {
        Row: {
          aceptado_at: string
          origen: string
          texto_legal_id: string
          tipo_aceptacion: string
          usuario_id: string
        }
        Insert: {
          aceptado_at?: string
          origen?: string
          texto_legal_id: string
          tipo_aceptacion?: string
          usuario_id: string
        }
        Update: {
          aceptado_at?: string
          origen?: string
          texto_legal_id?: string
          tipo_aceptacion?: string
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
      adicional_cobro: {
        Row: {
          created_at: string
          estado: string
          id: string
          lote_id: string
          monto: number
          mp_payment_id: string | null
          negocio_id: string
          pago_id: string
          periodo_desde: string | null
          periodo_hasta: string | null
          periodo_n: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          lote_id: string
          monto: number
          mp_payment_id?: string | null
          negocio_id: string
          pago_id: string
          periodo_desde?: string | null
          periodo_hasta?: string | null
          periodo_n: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          lote_id?: string
          monto?: number
          mp_payment_id?: string | null
          negocio_id?: string
          pago_id?: string
          periodo_desde?: string | null
          periodo_hasta?: string | null
          periodo_n?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adicional_cobro_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "adicional_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_cobro_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_cobro_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: true
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
        ]
      }
      adicional_config: {
        Row: {
          activacion_manual_max_dias: number
          avisos_dias_antes: number[]
          checkout_expira_horas: number
          gracia_dias: number
          habilitado: boolean
          id: boolean
          max_por_lote: number
          max_por_negocio: number
          pago_pendiente_expira_dias: number
          periodo_dias: number
          updated_at: string
          updated_by: string | null
          zona_horaria: string
        }
        Insert: {
          activacion_manual_max_dias?: number
          avisos_dias_antes?: number[]
          checkout_expira_horas?: number
          gracia_dias?: number
          habilitado?: boolean
          id?: boolean
          max_por_lote?: number
          max_por_negocio?: number
          pago_pendiente_expira_dias?: number
          periodo_dias?: number
          updated_at?: string
          updated_by?: string | null
          zona_horaria?: string
        }
        Update: {
          activacion_manual_max_dias?: number
          avisos_dias_antes?: number[]
          checkout_expira_horas?: number
          gracia_dias?: number
          habilitado?: boolean
          id?: boolean
          max_por_lote?: number
          max_por_negocio?: number
          pago_pendiente_expira_dias?: number
          periodo_dias?: number
          updated_at?: string
          updated_by?: string | null
          zona_horaria?: string
        }
        Relationships: []
      }
      adicional_estado_def: {
        Row: {
          aporta_cupo: boolean
          codigo: string
          etiqueta_en: string
          etiqueta_es: string
          orden: number
          terminal: boolean
        }
        Insert: {
          aporta_cupo?: boolean
          codigo: string
          etiqueta_en: string
          etiqueta_es: string
          orden: number
          terminal?: boolean
        }
        Update: {
          aporta_cupo?: boolean
          codigo?: string
          etiqueta_en?: string
          etiqueta_es?: string
          orden?: number
          terminal?: boolean
        }
        Relationships: []
      }
      adicional_historial: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          cantidad_antes: number | null
          cantidad_despues: number | null
          created_at: string
          datos: Json
          estado_antes: string | null
          estado_despues: string | null
          evento: string
          id: string
          lote_id: string
          motivo: string | null
          mp_ref: string | null
          negocio_id: string
          pago_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          cantidad_antes?: number | null
          cantidad_despues?: number | null
          created_at?: string
          datos?: Json
          estado_antes?: string | null
          estado_despues?: string | null
          evento: string
          id?: string
          lote_id: string
          motivo?: string | null
          mp_ref?: string | null
          negocio_id: string
          pago_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          cantidad_antes?: number | null
          cantidad_despues?: number | null
          created_at?: string
          datos?: Json
          estado_antes?: string | null
          estado_despues?: string | null
          evento?: string
          id?: string
          lote_id?: string
          motivo?: string | null
          mp_ref?: string | null
          negocio_id?: string
          pago_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adicional_historial_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "adicional_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_historial_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_historial_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
        ]
      }
      adicional_lote: {
        Row: {
          cancelado_at: string | null
          cancelar_renovacion: boolean
          cantidad: number
          contratado_at: string
          creado_por: string | null
          created_at: string
          estado: string
          gracia_fin: string | null
          id: string
          inicio_periodo_at: string | null
          manual_motivo: string | null
          manual_por: string | null
          manual_referencia: string | null
          manual_tipo: string | null
          moneda: string
          negocio_id: string
          origen: string
          pago_vigente_id: string | null
          pais_codigo: string
          periodo_n: number
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_unitario: number
          suspendido_at: string | null
          total: number
          ultimo_aviso_dias: number | null
          updated_at: string
          vigente_hasta: string | null
        }
        Insert: {
          cancelado_at?: string | null
          cancelar_renovacion?: boolean
          cantidad: number
          contratado_at?: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          gracia_fin?: string | null
          id?: string
          inicio_periodo_at?: string | null
          manual_motivo?: string | null
          manual_por?: string | null
          manual_referencia?: string | null
          manual_tipo?: string | null
          moneda?: string
          negocio_id: string
          origen?: string
          pago_vigente_id?: string | null
          pais_codigo: string
          periodo_n?: number
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_unitario: number
          suspendido_at?: string | null
          total: number
          ultimo_aviso_dias?: number | null
          updated_at?: string
          vigente_hasta?: string | null
        }
        Update: {
          cancelado_at?: string | null
          cancelar_renovacion?: boolean
          cantidad?: number
          contratado_at?: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          gracia_fin?: string | null
          id?: string
          inicio_periodo_at?: string | null
          manual_motivo?: string | null
          manual_por?: string | null
          manual_referencia?: string | null
          manual_tipo?: string | null
          moneda?: string
          negocio_id?: string
          origen?: string
          pago_vigente_id?: string | null
          pais_codigo?: string
          periodo_n?: number
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          precio_unitario?: number
          suspendido_at?: string | null
          total?: number
          ultimo_aviso_dias?: number | null
          updated_at?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adicional_lote_estado_fkey"
            columns: ["estado"]
            isOneToOne: false
            referencedRelation: "adicional_estado_def"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "adicional_lote_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_lote_pago_vigente_id_fkey"
            columns: ["pago_vigente_id"]
            isOneToOne: false
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_lote_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
        ]
      }
      adicional_mantenimiento_corrida: {
        Row: {
          ejecutado_at: string
          fecha: string
          resultado: Json
        }
        Insert: {
          ejecutado_at?: string
          fecha: string
          resultado?: Json
        }
        Update: {
          ejecutado_at?: string
          fecha?: string
          resultado?: Json
        }
        Relationships: []
      }
      adicional_pago_revision: {
        Row: {
          created_at: string
          detalle: Json
          estado: string
          id: string
          lote_id: string | null
          motivo: string
          negocio_id: string | null
          pago_id: string
          resolucion: string | null
          resuelto_at: string | null
          resuelto_por: string | null
        }
        Insert: {
          created_at?: string
          detalle?: Json
          estado?: string
          id?: string
          lote_id?: string | null
          motivo: string
          negocio_id?: string | null
          pago_id: string
          resolucion?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
        }
        Update: {
          created_at?: string
          detalle?: Json
          estado?: string
          id?: string
          lote_id?: string | null
          motivo?: string
          negocio_id?: string | null
          pago_id?: string
          resolucion?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adicional_pago_revision_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "adicional_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_pago_revision_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_pago_revision_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
        ]
      }
      adicional_precio_plan: {
        Row: {
          activo: boolean
          moneda: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          moneda?: string
          pais_codigo: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          moneda?: string
          pais_codigo?: string
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          precio_mensual?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adicional_precio_plan_pais_codigo_fkey"
            columns: ["pais_codigo"]
            isOneToOne: false
            referencedRelation: "pais"
            referencedColumns: ["codigo"]
          },
        ]
      }
      adicional_reembolso: {
        Row: {
          causa: string
          cobro_id: string | null
          created_at: string
          decidido_at: string | null
          decidido_por: string | null
          decision_motivo: string | null
          detalle: string | null
          estado: string
          id: string
          lote_id: string | null
          monto: number
          negocio_id: string
          pago_id: string | null
          referencia_ejecucion: string | null
          solicitado_por: string | null
          updated_at: string
        }
        Insert: {
          causa: string
          cobro_id?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          decision_motivo?: string | null
          detalle?: string | null
          estado?: string
          id?: string
          lote_id?: string | null
          monto: number
          negocio_id: string
          pago_id?: string | null
          referencia_ejecucion?: string | null
          solicitado_por?: string | null
          updated_at?: string
        }
        Update: {
          causa?: string
          cobro_id?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          decision_motivo?: string | null
          detalle?: string | null
          estado?: string
          id?: string
          lote_id?: string | null
          monto?: number
          negocio_id?: string
          pago_id?: string | null
          referencia_ejecucion?: string | null
          solicitado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adicional_reembolso_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "adicional_cobro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_reembolso_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "adicional_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_reembolso_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_reembolso_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
        ]
      }
      adicional_transicion: {
        Row: {
          actores: string[]
          desde: string
          hacia: string
        }
        Insert: {
          actores: string[]
          desde: string
          hacia: string
        }
        Update: {
          actores?: string[]
          desde?: string
          hacia?: string
        }
        Relationships: [
          {
            foreignKeyName: "adicional_transicion_desde_fkey"
            columns: ["desde"]
            isOneToOne: false
            referencedRelation: "adicional_estado_def"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "adicional_transicion_hacia_fkey"
            columns: ["hacia"]
            isOneToOne: false
            referencedRelation: "adicional_estado_def"
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
      autorizacion_datos_reserva: {
        Row: {
          aceptado_at: string
          cliente_id: string
          id: string
          negocio_id: string
          politica_datos_id: string | null
          reserva_id: string
          texto_aceptado: string
          version_texto: string
        }
        Insert: {
          aceptado_at?: string
          cliente_id: string
          id?: string
          negocio_id: string
          politica_datos_id?: string | null
          reserva_id: string
          texto_aceptado: string
          version_texto: string
        }
        Update: {
          aceptado_at?: string
          cliente_id?: string
          id?: string
          negocio_id?: string
          politica_datos_id?: string | null
          reserva_id?: string
          texto_aceptado?: string
          version_texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "autorizacion_datos_reserva_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacion_datos_reserva_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacion_datos_reserva_politica_datos_id_fkey"
            columns: ["politica_datos_id"]
            isOneToOne: false
            referencedRelation: "texto_legal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacion_datos_reserva_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: true
            referencedRelation: "reserva"
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
      caso_adjunto: {
        Row: {
          bytes: number
          created_at: string
          id: string
          mime: string
          nombre_original: string
          sha256: string
          storage_path: string
          subido_por: string | null
          subido_por_tipo: string
          ticket_id: string
        }
        Insert: {
          bytes: number
          created_at?: string
          id?: string
          mime: string
          nombre_original: string
          sha256: string
          storage_path: string
          subido_por?: string | null
          subido_por_tipo: string
          ticket_id: string
        }
        Update: {
          bytes?: number
          created_at?: string
          id?: string
          mime?: string
          nombre_original?: string
          sha256?: string
          storage_path?: string
          subido_por?: string | null
          subido_por_tipo?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caso_adjunto_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_historial: {
        Row: {
          actor_id: string | null
          actor_tipo: string
          created_at: string
          detalle: Json
          estado_destino: string | null
          estado_origen: string | null
          id: number
          ticket_id: string
          tipo_evento: string
          visible_solicitante: boolean
        }
        Insert: {
          actor_id?: string | null
          actor_tipo: string
          created_at?: string
          detalle?: Json
          estado_destino?: string | null
          estado_origen?: string | null
          id?: never
          ticket_id: string
          tipo_evento: string
          visible_solicitante?: boolean
        }
        Update: {
          actor_id?: string | null
          actor_tipo?: string
          created_at?: string
          detalle?: Json
          estado_destino?: string | null
          estado_origen?: string | null
          id?: never
          ticket_id?: string
          tipo_evento?: string
          visible_solicitante?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "caso_historial_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_plazo_regla: {
        Row: {
          activa: boolean
          articulo: string | null
          created_at: string
          desistimiento_meses: number | null
          estado_verificacion: string
          fuente_url: string | null
          id: string
          inicio_conteo: string
          leyenda_tramite_dias_habiles: number | null
          norma: string | null
          observaciones: string | null
          plazo: number | null
          prorroga_max: number | null
          prorroga_requiere_motivo: boolean
          subsanacion_dias: number | null
          subsanacion_unidad: string | null
          tipo_codigo: string
          traslado_dias_habiles: number | null
          unidad: string
          verificado_at: string | null
          verificado_por: string | null
          version: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          activa?: boolean
          articulo?: string | null
          created_at?: string
          desistimiento_meses?: number | null
          estado_verificacion?: string
          fuente_url?: string | null
          id?: string
          inicio_conteo?: string
          leyenda_tramite_dias_habiles?: number | null
          norma?: string | null
          observaciones?: string | null
          plazo?: number | null
          prorroga_max?: number | null
          prorroga_requiere_motivo?: boolean
          subsanacion_dias?: number | null
          subsanacion_unidad?: string | null
          tipo_codigo: string
          traslado_dias_habiles?: number | null
          unidad?: string
          verificado_at?: string | null
          verificado_por?: string | null
          version?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          activa?: boolean
          articulo?: string | null
          created_at?: string
          desistimiento_meses?: number | null
          estado_verificacion?: string
          fuente_url?: string | null
          id?: string
          inicio_conteo?: string
          leyenda_tramite_dias_habiles?: number | null
          norma?: string | null
          observaciones?: string | null
          plazo?: number | null
          prorroga_max?: number | null
          prorroga_requiere_motivo?: boolean
          subsanacion_dias?: number | null
          subsanacion_unidad?: string | null
          tipo_codigo?: string
          traslado_dias_habiles?: number | null
          unidad?: string
          verificado_at?: string | null
          verificado_por?: string | null
          version?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caso_plazo_regla_tipo_codigo_fkey"
            columns: ["tipo_codigo"]
            isOneToOne: false
            referencedRelation: "caso_tipo"
            referencedColumns: ["codigo"]
          },
        ]
      }
      caso_seguimiento: {
        Row: {
          creado_at: string
          expira_at: string
          rotado_at: string | null
          ticket_id: string
          token_hash: string
        }
        Insert: {
          creado_at?: string
          expira_at?: string
          rotado_at?: string | null
          ticket_id: string
          token_hash: string
        }
        Update: {
          creado_at?: string
          expira_at?: string
          rotado_at?: string | null
          ticket_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "caso_seguimiento_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "ticket_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_solicitante: {
        Row: {
          created_at: string
          email: string
          id_numero: string | null
          id_tipo: string | null
          nombre: string
          politica_aceptada_at: string | null
          politica_texto_id: string | null
          telefono: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id_numero?: string | null
          id_tipo?: string | null
          nombre: string
          politica_aceptada_at?: string | null
          politica_texto_id?: string | null
          telefono?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id_numero?: string | null
          id_tipo?: string | null
          nombre?: string
          politica_aceptada_at?: string | null
          politica_texto_id?: string | null
          telefono?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caso_solicitante_politica_texto_id_fkey"
            columns: ["politica_texto_id"]
            isOneToOne: false
            referencedRelation: "texto_legal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_solicitante_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "ticket_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_tipo: {
        Row: {
          activo: boolean
          categoria: string
          codigo: string
          created_at: string
          descripcion: string | null
          es_critico: boolean
          nombre: string
          orden: number
          prioridad_base: string
          publico: boolean
          requiere_identificacion: boolean
          requiere_revision_juridica: boolean
          sla_interno_dias_habiles: number | null
          sla_interno_horas: number | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          codigo: string
          created_at?: string
          descripcion?: string | null
          es_critico?: boolean
          nombre: string
          orden?: number
          prioridad_base?: string
          publico?: boolean
          requiere_identificacion?: boolean
          requiere_revision_juridica?: boolean
          sla_interno_dias_habiles?: number | null
          sla_interno_horas?: number | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          descripcion?: string | null
          es_critico?: boolean
          nombre?: string
          orden?: number
          prioridad_base?: string
          publico?: boolean
          requiere_identificacion?: boolean
          requiere_revision_juridica?: boolean
          sla_interno_dias_habiles?: number | null
          sla_interno_horas?: number | null
          updated_at?: string
        }
        Relationships: []
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
      cliente_saldo_movimiento: {
        Row: {
          actor_id: string | null
          cliente_id: string
          created_at: string
          id: string
          monto_delta: number
          motivo: string | null
          negocio_id: string
          pago_reserva_id: string | null
          reserva_id: string | null
          saldo_antes: number
          saldo_despues: number
          tipo: string
        }
        Insert: {
          actor_id?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          monto_delta: number
          motivo?: string | null
          negocio_id: string
          pago_reserva_id?: string | null
          reserva_id?: string | null
          saldo_antes: number
          saldo_despues: number
          tipo: string
        }
        Update: {
          actor_id?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          monto_delta?: number
          motivo?: string | null
          negocio_id?: string
          pago_reserva_id?: string | null
          reserva_id?: string | null
          saldo_antes?: number
          saldo_despues?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_saldo_movimiento_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_saldo_pendiente: {
        Row: {
          cliente_id: string
          negocio_id: string
          saldo_actual: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          negocio_id: string
          saldo_actual?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          negocio_id?: string
          saldo_actual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_saldo_pendiente_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
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
          gracia_permite_operar: boolean
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
          prueba_gracia_dias: number
          prueba_modalidad: string
          reembolso_max_intentos: number
          staff_transicion_fin: string | null
          staff_transicion_inicio: string | null
          suscripcion_gracia_dias: number
          suscripcion_periodo_dias: number
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
          gracia_permite_operar?: boolean
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
          prueba_gracia_dias?: number
          prueba_modalidad?: string
          reembolso_max_intentos?: number
          staff_transicion_fin?: string | null
          staff_transicion_inicio?: string | null
          suscripcion_gracia_dias?: number
          suscripcion_periodo_dias?: number
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
          gracia_permite_operar?: boolean
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
          prueba_gracia_dias?: number
          prueba_modalidad?: string
          reembolso_max_intentos?: number
          staff_transicion_fin?: string | null
          staff_transicion_inicio?: string | null
          suscripcion_gracia_dias?: number
          suscripcion_periodo_dias?: number
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
      cumplimiento_config: {
        Row: {
          clave: string
          descripcion: string | null
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          clave: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          clave?: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      cumplimiento_notificacion: {
        Row: {
          canal: string
          created_at: string
          datos: Json
          destinatario: string | null
          destinatario_tipo: string
          enviado_at: string | null
          estado: string
          id: string
          id_externo: string | null
          idempotency_key: string
          intentos: number
          leida_at: string | null
          max_intentos: number
          plantilla: string
          proximo_intento_at: string | null
          regla: string
          ticket_id: string
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          datos?: Json
          destinatario?: string | null
          destinatario_tipo: string
          enviado_at?: string | null
          estado?: string
          id?: string
          id_externo?: string | null
          idempotency_key: string
          intentos?: number
          leida_at?: string | null
          max_intentos?: number
          plantilla: string
          proximo_intento_at?: string | null
          regla: string
          ticket_id: string
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          datos?: Json
          destinatario?: string | null
          destinatario_tipo?: string
          enviado_at?: string | null
          estado?: string
          id?: string
          id_externo?: string | null
          idempotency_key?: string
          intentos?: number
          leida_at?: string | null
          max_intentos?: number
          plantilla?: string
          proximo_intento_at?: string | null
          regla?: string
          ticket_id?: string
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cumplimiento_notificacion_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      cumplimiento_notificacion_evento: {
        Row: {
          created_at: string
          detalle: string | null
          estado_destino: string
          estado_origen: string | null
          id: number
          intento: number
          notificacion_id: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          estado_destino: string
          estado_origen?: string | null
          id?: never
          intento?: number
          notificacion_id: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          estado_destino?: string
          estado_origen?: string | null
          id?: never
          intento?: number
          notificacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cumplimiento_notificacion_evento_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: false
            referencedRelation: "cumplimiento_notificacion"
            referencedColumns: ["id"]
          },
        ]
      }
      cumplimiento_plantilla: {
        Row: {
          activa: boolean
          asunto: string
          canal: string
          codigo: string
          cuerpo: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          asunto: string
          canal: string
          codigo: string
          cuerpo: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          asunto?: string
          canal?: string
          codigo?: string
          cuerpo?: string
          updated_at?: string
        }
        Relationships: []
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
      evidencia_legal: {
        Row: {
          accion: string
          canal: string
          categoria: string
          documento: string
          documento_id: string | null
          finalidad: string
          fuente_id: string
          fuente_tabla: string
          hash: string
          hash_anterior: string | null
          id: string
          importado: boolean
          negocio_id: string | null
          ocurrido_at: string
          referencia_id: string | null
          referencia_tipo: string | null
          registrado_at: string
          relacionado_con: string | null
          rol: string
          secuencia: number
          sede_id: string | null
          texto: string | null
          texto_sha256: string | null
          usuario_id: string | null
          version: string | null
        }
        Insert: {
          accion: string
          canal: string
          categoria: string
          documento: string
          documento_id?: string | null
          finalidad: string
          fuente_id: string
          fuente_tabla: string
          hash: string
          hash_anterior?: string | null
          id?: string
          importado?: boolean
          negocio_id?: string | null
          ocurrido_at: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          registrado_at?: string
          relacionado_con?: string | null
          rol: string
          secuencia: number
          sede_id?: string | null
          texto?: string | null
          texto_sha256?: string | null
          usuario_id?: string | null
          version?: string | null
        }
        Update: {
          accion?: string
          canal?: string
          categoria?: string
          documento?: string
          documento_id?: string | null
          finalidad?: string
          fuente_id?: string
          fuente_tabla?: string
          hash?: string
          hash_anterior?: string | null
          id?: string
          importado?: boolean
          negocio_id?: string | null
          ocurrido_at?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          registrado_at?: string
          relacionado_con?: string | null
          rol?: string
          secuencia?: number
          sede_id?: string | null
          texto?: string | null
          texto_sha256?: string | null
          usuario_id?: string | null
          version?: string | null
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
      festivo_co: {
        Row: {
          created_at: string
          fecha: string
          nombre: string
          origen: string
          verificado: boolean
        }
        Insert: {
          created_at?: string
          fecha: string
          nombre: string
          origen?: string
          verificado?: boolean
        }
        Update: {
          created_at?: string
          fecha?: string
          nombre?: string
          origen?: string
          verificado?: boolean
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
          rol_invitado: string
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
          rol_invitado?: string
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
          rol_invitado?: string
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
          foto_principal_public_id?: string | null
          foto_principal_url?: string | null
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
          foto_principal_public_id?: string | null
          foto_principal_url?: string | null
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
      negocio_foto: {
        Row: {
          created_at: string
          es_principal: boolean
          id: string
          negocio_id: string
          orden: number
          public_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          es_principal?: boolean
          id?: string
          negocio_id: string
          orden?: number
          public_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          es_principal?: boolean
          id?: string
          negocio_id?: string
          orden?: number
          public_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "negocio_foto_negocio_id_fkey"
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
      negocio_medio_pago_directo: {
        Row: {
          activo: boolean
          daviplata: string | null
          instrucciones: string | null
          link_pago: string | null
          llave_breb: string | null
          negocio_id: string
          nequi: string | null
          qr_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          daviplata?: string | null
          instrucciones?: string | null
          link_pago?: string | null
          llave_breb?: string | null
          negocio_id: string
          nequi?: string | null
          qr_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          daviplata?: string | null
          instrucciones?: string | null
          link_pago?: string | null
          llave_breb?: string | null
          negocio_id?: string
          nequi?: string | null
          qr_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocio_medio_pago_directo_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_verificacion: {
        Row: {
          decidida_at: string | null
          decidida_por: string | null
          enviada_at: string | null
          estado: Database["public"]["Enums"]["verificacion_estado"]
          iniciada_at: string | null
          motivo: string | null
          negocio_id: string
          updated_at: string
        }
        Insert: {
          decidida_at?: string | null
          decidida_por?: string | null
          enviada_at?: string | null
          estado?: Database["public"]["Enums"]["verificacion_estado"]
          iniciada_at?: string | null
          motivo?: string | null
          negocio_id: string
          updated_at?: string
        }
        Update: {
          decidida_at?: string | null
          decidida_por?: string | null
          enviada_at?: string | null
          estado?: Database["public"]["Enums"]["verificacion_estado"]
          iniciada_at?: string | null
          motivo?: string | null
          negocio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "negocio_verificacion_negocio_id_fkey"
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
      pago_reserva: {
        Row: {
          cliente_id: string
          comprobante_hash: string | null
          comprobante_url: string | null
          created_at: string
          estado: string
          id: string
          metodo: string
          monto_esperado: number
          monto_reportado: number
          motivo_rechazo: string | null
          negocio_id: string
          referencia_corta: string | null
          reserva_id: string
          revisado_at: string | null
          revisado_por: string | null
        }
        Insert: {
          cliente_id: string
          comprobante_hash?: string | null
          comprobante_url?: string | null
          created_at?: string
          estado?: string
          id?: string
          metodo?: string
          monto_esperado: number
          monto_reportado: number
          motivo_rechazo?: string | null
          negocio_id: string
          referencia_corta?: string | null
          reserva_id: string
          revisado_at?: string | null
          revisado_por?: string | null
        }
        Update: {
          cliente_id?: string
          comprobante_hash?: string | null
          comprobante_url?: string | null
          created_at?: string
          estado?: string
          id?: string
          metodo?: string
          monto_esperado?: number
          monto_reportado?: number
          motivo_rechazo?: string | null
          negocio_id?: string
          referencia_corta?: string | null
          reserva_id?: string
          revisado_at?: string | null
          revisado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pago_reserva_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_reserva_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reserva"
            referencedColumns: ["id"]
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
          propietario_perfil_auto_alta: boolean
          propietario_profesional_por_defecto: boolean
          propietario_puede_activar_perfil: boolean
          propietario_puede_desactivar_perfil: boolean
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
          propietario_perfil_auto_alta?: boolean
          propietario_profesional_por_defecto?: boolean
          propietario_puede_activar_perfil?: boolean
          propietario_puede_desactivar_perfil?: boolean
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
          propietario_perfil_auto_alta?: boolean
          propietario_profesional_por_defecto?: boolean
          propietario_puede_activar_perfil?: boolean
          propietario_puede_desactivar_perfil?: boolean
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
          dispositivo_hash: string | null
          documento_hash: string | null
          email_hash: string | null
          equipo_hash: string | null
          ip_hash: string | null
          negocio_id: string
          owner_user_id: string
          telefono_hash: string | null
        }
        Insert: {
          created_at?: string
          dispositivo_hash?: string | null
          documento_hash?: string | null
          email_hash?: string | null
          equipo_hash?: string | null
          ip_hash?: string | null
          negocio_id: string
          owner_user_id: string
          telefono_hash?: string | null
        }
        Update: {
          created_at?: string
          dispositivo_hash?: string | null
          documento_hash?: string | null
          email_hash?: string | null
          equipo_hash?: string | null
          ip_hash?: string | null
          negocio_id?: string
          owner_user_id?: string
          telefono_hash?: string | null
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
      solicitud_ausencia: {
        Row: {
          bloqueo_id: string | null
          created_at: string
          decidido_at: string | null
          decidido_por: string | null
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo: string | null
          motivo_decision: string | null
          negocio_id: string
          tipo: string
          vinculo_id: string
        }
        Insert: {
          bloqueo_id?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo?: string | null
          motivo_decision?: string | null
          negocio_id: string
          tipo?: string
          vinculo_id: string
        }
        Update: {
          bloqueo_id?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo?: string | null
          motivo_decision?: string | null
          negocio_id?: string
          tipo?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_ausencia_bloqueo_id_fkey"
            columns: ["bloqueo_id"]
            isOneToOne: false
            referencedRelation: "bloqueo_ausencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_ausencia_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_ausencia_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculo_staff_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_ausencia_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vista_staff_negocio"
            referencedColumns: ["vinculo_id"]
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
      solicitud_horario: {
        Row: {
          created_at: string
          decidido_at: string | null
          decidido_por: string | null
          estado: string
          id: string
          motivo_decision: string | null
          negocio_id: string
          propuesta: Json
          sede_id: string
          vinculo_id: string
        }
        Insert: {
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          estado?: string
          id?: string
          motivo_decision?: string | null
          negocio_id: string
          propuesta: Json
          sede_id: string
          vinculo_id: string
        }
        Update: {
          created_at?: string
          decidido_at?: string | null
          decidido_por?: string | null
          estado?: string
          id?: string
          motivo_decision?: string | null
          negocio_id?: string
          propuesta?: Json
          sede_id?: string
          vinculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_horario_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_horario_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_horario_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculo_staff_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_horario_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vista_staff_negocio"
            referencedColumns: ["vinculo_id"]
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
          contenido_sha256: string
          estado_juridico: string
          id: string
          publicado_at: string
          tipo: string
          version: number
        }
        Insert: {
          cambio_material?: boolean
          contenido: string
          contenido_sha256: string
          estado_juridico?: string
          id?: string
          publicado_at?: string
          tipo: string
          version: number
        }
        Update: {
          cambio_material?: boolean
          contenido?: string
          contenido_sha256?: string
          estado_juridico?: string
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
          autor_id: string | null
          created_at: string
          id: string
          mensaje: string
          sustantiva: boolean
          ticket_id: string
          tipo: string
        }
        Insert: {
          actor_tipo: string
          autor_id?: string | null
          created_at?: string
          id?: string
          mensaje: string
          sustantiva?: boolean
          ticket_id: string
          tipo?: string
        }
        Update: {
          actor_tipo?: string
          autor_id?: string | null
          created_at?: string
          id?: string
          mensaje?: string
          sustantiva?: boolean
          ticket_id?: string
          tipo?: string
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
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        Insert: {
          acuse_at?: string | null
          asunto: string
          canal?: string
          cerrado_at?: string | null
          creado_por?: string | null
          created_at?: string
          escalado_at?: string | null
          estado?: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso?: string
          estado_respuesta?: string
          fecha_limite?: string | null
          fecha_limite_original?: string | null
          id?: string
          idempotency_key?: string | null
          negocio_id?: string | null
          nota_cierre?: string | null
          numero_radicacion?: string | null
          plazo_origen?: string | null
          prioridad?: string
          prorroga_aplicada?: boolean
          prorroga_motivo?: string | null
          proxima_accion?: string | null
          recibido_at?: string | null
          reclamo_en_tramite_desde?: string | null
          referencia_externa?: string | null
          regla_id?: string | null
          respondido_at?: string | null
          responsable_id?: string | null
          resuelto_at?: string | null
          resultado?: string | null
          subsanacion_requerida_at?: string | null
          supervisor_id?: string | null
          tipo_codigo?: string | null
          updated_at?: string
        }
        Update: {
          acuse_at?: string | null
          asunto?: string
          canal?: string
          cerrado_at?: string | null
          creado_por?: string | null
          created_at?: string
          escalado_at?: string | null
          estado?: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso?: string
          estado_respuesta?: string
          fecha_limite?: string | null
          fecha_limite_original?: string | null
          id?: string
          idempotency_key?: string | null
          negocio_id?: string | null
          nota_cierre?: string | null
          numero_radicacion?: string | null
          plazo_origen?: string | null
          prioridad?: string
          prorroga_aplicada?: boolean
          prorroga_motivo?: string | null
          proxima_accion?: string | null
          recibido_at?: string | null
          reclamo_en_tramite_desde?: string | null
          referencia_externa?: string | null
          regla_id?: string | null
          respondido_at?: string | null
          responsable_id?: string | null
          resuelto_at?: string | null
          resultado?: string | null
          subsanacion_requerida_at?: string | null
          supervisor_id?: string | null
          tipo_codigo?: string | null
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
          {
            foreignKeyName: "ticket_soporte_regla_id_fkey"
            columns: ["regla_id"]
            isOneToOne: false
            referencedRelation: "caso_plazo_regla"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_soporte_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_soporte_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_soporte_tipo_codigo_fkey"
            columns: ["tipo_codigo"]
            isOneToOne: false
            referencedRelation: "caso_tipo"
            referencedColumns: ["codigo"]
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
      verificacion_documento: {
        Row: {
          bytes: number
          formato: string
          id: string
          negocio_id: string
          public_id: string
          retirado_at: string | null
          subido_at: string
          subido_por: string
          tipo: string
          version: number
        }
        Insert: {
          bytes: number
          formato: string
          id?: string
          negocio_id: string
          public_id: string
          retirado_at?: string | null
          subido_at?: string
          subido_por: string
          tipo: string
          version: number
        }
        Update: {
          bytes?: number
          formato?: string
          id?: string
          negocio_id?: string
          public_id?: string
          retirado_at?: string | null
          subido_at?: string
          subido_por?: string
          tipo?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_documento_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_evento: {
        Row: {
          actor_id: string | null
          actor_rol: string
          created_at: string
          estado_anterior:
            | Database["public"]["Enums"]["verificacion_estado"]
            | null
          estado_nuevo: Database["public"]["Enums"]["verificacion_estado"]
          id: number
          motivo: string | null
          negocio_id: string
          origen: string
        }
        Insert: {
          actor_id?: string | null
          actor_rol: string
          created_at?: string
          estado_anterior?:
            | Database["public"]["Enums"]["verificacion_estado"]
            | null
          estado_nuevo: Database["public"]["Enums"]["verificacion_estado"]
          id?: never
          motivo?: string | null
          negocio_id: string
          origen: string
        }
        Update: {
          actor_id?: string | null
          actor_rol?: string
          created_at?: string
          estado_anterior?:
            | Database["public"]["Enums"]["verificacion_estado"]
            | null
          estado_nuevo?: Database["public"]["Enums"]["verificacion_estado"]
          id?: never
          motivo?: string | null
          negocio_id?: string
          origen?: string
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_evento_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      vinculo_staff_negocio: {
        Row: {
          comision_pct: number | null
          created_at: string
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
          sede_activa_id: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          comision_pct?: number | null
          created_at?: string
          es_admin?: boolean
          es_guardian?: boolean
          estado?: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso?: string | null
          id?: string
          negocio_id: string
          presta_servicios?: boolean
          sede_activa_id?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          comision_pct?: number | null
          created_at?: string
          es_admin?: boolean
          es_guardian?: boolean
          estado?: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso?: string | null
          id?: string
          negocio_id?: string
          presta_servicios?: boolean
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
          error: string | null
          estado_proveedor: string | null
          firma: string | null
          id: number
          intentos: number
          live_mode: boolean | null
          negocio_id: string | null
          pago_id: string | null
          procesado_at: string | null
          proveedor: string
          recibido_at: string
          request_id: string
          resultado: string | null
          topico: string | null
          ultimo_intento_at: string
        }
        Insert: {
          conexion_id?: string | null
          data_id?: string | null
          error?: string | null
          estado_proveedor?: string | null
          firma?: string | null
          id?: number
          intentos?: number
          live_mode?: boolean | null
          negocio_id?: string | null
          pago_id?: string | null
          procesado_at?: string | null
          proveedor: string
          recibido_at?: string
          request_id: string
          resultado?: string | null
          topico?: string | null
          ultimo_intento_at?: string
        }
        Update: {
          conexion_id?: string | null
          data_id?: string | null
          error?: string | null
          estado_proveedor?: string | null
          firma?: string | null
          id?: number
          intentos?: number
          live_mode?: boolean | null
          negocio_id?: string | null
          pago_id?: string | null
          procesado_at?: string | null
          proveedor?: string
          recibido_at?: string
          request_id?: string
          resultado?: string | null
          topico?: string | null
          ultimo_intento_at?: string
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
          es_admin: boolean | null
          es_guardian: boolean | null
          especialidad: string | null
          estado: Database["public"]["Enums"]["vinculo_estado"] | null
          fecha_ingreso: string | null
          foto_url: string | null
          negocio_id: string | null
          nivel: Database["public"]["Enums"]["nivel_staff"] | null
          nombre: string | null
          presta_servicios: boolean | null
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
      _activar_perfil_propietario: {
        Args: {
          p_ignorar_cupo?: boolean
          p_negocio_id: string
          p_usuario_id: string
        }
        Returns: string
      }
      _adicional_aplicar_pago: {
        Args: {
          p_estado: Database["public"]["Enums"]["pago_estado"]
          p_id_transaccion: string
          p_pago: Database["public"]["Tables"]["pago"]["Row"]
          p_payload: Json
        }
        Returns: Json
      }
      _adicional_cerrar_checkout: {
        Args: {
          p_actor: string
          p_actor_tipo: string
          p_lote: string
          p_motivo: string
        }
        Returns: undefined
      }
      _adicional_cotizacion: {
        Args: {
          p_cantidad: number
          p_excluir_lote?: string
          p_negocio_id: string
        }
        Returns: Json
      }
      _adicional_exige_supersu: {
        Args: { p_motivo?: string; p_motivo_obligatorio?: boolean }
        Returns: undefined
      }
      _adicional_historial: {
        Args: {
          p_actor: string
          p_actor_tipo: string
          p_cant_antes?: number
          p_cant_despues?: number
          p_datos?: Json
          p_estado_antes?: string
          p_estado_despues?: string
          p_evento: string
          p_lote: string
          p_motivo: string
          p_mp_ref?: string
          p_pago?: string
        }
        Returns: boolean
      }
      _adicional_notificar: {
        Args: {
          p_clave: string
          p_evento: string
          p_extra?: Json
          p_lote: string
        }
        Returns: undefined
      }
      _adicional_revisar_pago: {
        Args: {
          p_detalle?: Json
          p_lote: string
          p_motivo: string
          p_mp_ref: string
          p_pago: Database["public"]["Tables"]["pago"]["Row"]
        }
        Returns: Json
      }
      _adicional_transicionar: {
        Args: {
          p_a: string
          p_actor?: string
          p_actor_tipo: string
          p_datos?: Json
          p_evento: string
          p_lote: string
          p_motivo?: string
          p_pago?: string
        }
        Returns: boolean
      }
      _adicionales_activos: { Args: { p_negocio_id: string }; Returns: number }
      _adicionales_resumen: { Args: { p_negocio_id: string }; Returns: Json }
      _anonimizar_cliente: { Args: { p_usuario: string }; Returns: undefined }
      _anticipo_descontado_reserva: {
        Args: { p_reserva_id: string }
        Returns: number
      }
      _aplicar_semana: {
        Args: { p_dias: Json; p_sede: string; p_vinculo: string }
        Returns: undefined
      }
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
      _auditar_pago: {
        Args: {
          p_accion: string
          p_antes: Json
          p_despues: Json
          p_entidad: string
          p_id: string
          p_motivo: string
          p_negocio: string
        }
        Returns: undefined
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
      _avisar_decisores: {
        Args: {
          p_cuerpo: string
          p_dedupe: string
          p_tipo: string
          p_titulo: string
          p_vinculo: string
        }
        Returns: undefined
      }
      _capacidad_profesional: {
        Args: {
          p_adicionales?: number
          p_excluir_email?: string
          p_negocio_id: string
          p_plan_codigo?: string
        }
        Returns: Json
      }
      _caso_exigir_supersu: { Args: never; Returns: string }
      _caso_log: {
        Args: {
          p_a: string
          p_actor: string
          p_actor_tipo: string
          p_de: string
          p_detalle?: Json
          p_evento: string
          p_ticket: string
          p_visible?: boolean
        }
        Returns: number
      }
      _caso_mover: {
        Args: {
          p_actor: string
          p_actor_tipo: string
          p_detalle?: Json
          p_nuevo: string
          p_ticket: string
          p_visible?: boolean
        }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _caso_plazo_efectivo: {
        Args: { p_tipo: string }
        Returns: {
          origen: string
          plazo: number
          prorroga_max: number
          regla_id: string
          unidad: string
        }[]
      }
      _caso_prioridad_calculada: {
        Args: { t: Database["public"]["Tables"]["ticket_soporte"]["Row"] }
        Returns: string
      }
      _caso_prioridad_orden: { Args: { p: string }; Returns: number }
      _caso_transicion_valida: {
        Args: { p_a: string; p_de: string }
        Returns: boolean
      }
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
      _cupo_bloquear: { Args: { p_negocio_id: string }; Returns: undefined }
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
      _es_dueno_o_supersu: { Args: { p_negocio_id: string }; Returns: boolean }
      _estado_operativo_en: {
        Args: { p_ahora: string; p_negocio: string }
        Returns: Json
      }
      _evidencia_canonica: {
        Args: { e: Database["public"]["Tables"]["evidencia_legal"]["Row"] }
        Returns: string
      }
      _evidencia_desde_aceptacion_legal: {
        Args: {
          a: Database["public"]["Tables"]["aceptacion_legal"]["Row"]
          p_importado: boolean
        }
        Returns: string
      }
      _evidencia_desde_autorizacion_reserva: {
        Args: {
          a: Database["public"]["Tables"]["autorizacion_datos_reserva"]["Row"]
          p_importado: boolean
        }
        Returns: string
      }
      _evidencia_desde_consentimiento: {
        Args: {
          c: Database["public"]["Tables"]["consentimiento_evento"]["Row"]
          p_importado: boolean
        }
        Returns: string
      }
      _evidencia_desde_politica_reserva: {
        Args: {
          a: Database["public"]["Tables"]["aceptacion_politica_reserva"]["Row"]
          p_importado: boolean
        }
        Returns: string
      }
      _evidencia_desde_solicitud: {
        Args: {
          p_importado: boolean
          s: Database["public"]["Tables"]["solicitud_cuenta"]["Row"]
        }
        Returns: string
      }
      _evidencia_hash: {
        Args: { e: Database["public"]["Tables"]["evidencia_legal"]["Row"] }
        Returns: string
      }
      _exigir_operativo: { Args: { p_negocio_id: string }; Returns: undefined }
      _exigir_operativo_reserva: {
        Args: { p_reserva_id: string }
        Returns: undefined
      }
      _exigir_operativo_reserva_sin_productos: {
        Args: { p_productos: Json; p_reserva_id: string }
        Returns: undefined
      }
      _exigir_operativo_sede: {
        Args: { p_sede_id: string }
        Returns: undefined
      }
      _familia_miembro: { Args: { p_familia_id: string }; Returns: boolean }
      _familia_titular: { Args: { p_familia_id: string }; Returns: boolean }
      _galeria_exigir_propietario: {
        Args: { p_negocio: string }
        Returns: undefined
      }
      _galeria_sincronizar: { Args: { p_negocio: string }; Returns: undefined }
      _galeria_validar_archivo: {
        Args: { p_negocio: string; p_public_id: string; p_url: string }
        Returns: undefined
      }
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
      _lunes_siguiente: { Args: { p_fecha: string }; Returns: string }
      _nombre_vinculo: { Args: { p_vinculo: string }; Returns: string }
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
      _precio_plan_ciclo: {
        Args: {
          p_ciclo: string
          p_negocio_id: string
          p_plan: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: number
      }
      _puede_decidir_vinculo: { Args: { p_vinculo: string }; Returns: boolean }
      _puede_gestionar_invitacion: {
        Args: { p_invitacion_id: string }
        Returns: boolean
      }
      _puede_gestionar_vinculo: {
        Args: { p_vinculo_id: string }
        Returns: boolean
      }
      _puede_reagendar: {
        Args: { p_reserva: Database["public"]["Tables"]["reserva"]["Row"] }
        Returns: string
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
      _registrar_evidencia: {
        Args: {
          p_accion: string
          p_canal: string
          p_categoria: string
          p_documento: string
          p_documento_id: string
          p_finalidad: string
          p_fuente_id: string
          p_fuente_tabla: string
          p_importado?: boolean
          p_negocio: string
          p_ocurrido: string
          p_ref_id: string
          p_ref_tipo: string
          p_relacionado: string
          p_rol?: string
          p_sede: string
          p_texto: string
          p_usuario: string
          p_version: string
        }
        Returns: string
      }
      _reserva_es_hoy: { Args: { p_reserva_id: string }; Returns: boolean }
      _rol_de_usuario: {
        Args: { p_negocio?: string; p_usuario: string }
        Returns: string
      }
      _rol_equipo: {
        Args: { p_negocio_id: string; p_usuario_id: string }
        Returns: string
      }
      _saldo_pendiente_liquidar: {
        Args: {
          p_cliente_id: string
          p_negocio_id: string
          p_reserva_id: string
        }
        Returns: number
      }
      _sincronizar_registro_pendiente: {
        Args: { p_pendiente: boolean; p_usuario: string }
        Returns: undefined
      }
      _staff_ultima_autorizacion: {
        Args: { p_documento: string; p_negocio: string; p_staff: string }
        Returns: {
          accion: string
          canal: string
          categoria: string
          documento: string
          documento_id: string | null
          finalidad: string
          fuente_id: string
          fuente_tabla: string
          hash: string
          hash_anterior: string | null
          id: string
          importado: boolean
          negocio_id: string | null
          ocurrido_at: string
          referencia_id: string | null
          referencia_tipo: string | null
          registrado_at: string
          relacionado_con: string | null
          rol: string
          secuencia: number
          sede_id: string | null
          texto: string | null
          texto_sha256: string | null
          usuario_id: string | null
          version: string | null
        }
        SetofOptions: {
          from: "*"
          to: "evidencia_legal"
          isOneToOne: true
          isSetofReturn: false
        }
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
      _validar_semana: { Args: { p_dias: Json }; Returns: undefined }
      _verif_es_propietario: {
        Args: { p_negocio: string; p_usuario: string }
        Returns: boolean
      }
      _verif_transicion: {
        Args: {
          p_actor: string
          p_motivo: string
          p_negocio: string
          p_nuevo: Database["public"]["Enums"]["verificacion_estado"]
          p_origen: string
          p_rol: string
        }
        Returns: undefined
      }
      _verificar_evidencia: {
        Args: { e: Database["public"]["Tables"]["evidencia_legal"]["Row"] }
        Returns: Json
      }
      _vinculo_exige_aprobacion: {
        Args: { p_vinculo: string }
        Returns: boolean
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
      aceptar_invitacion_staff: {
        Args: { p_autoriza_tratamiento: boolean; p_invitacion_id: string }
        Returns: Json
      }
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
      activar_perfil_profesional_propietario: {
        Args: { p_negocio_id: string }
        Returns: Json
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
          gracia_permite_operar: boolean
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
          prueba_gracia_dias: number
          prueba_modalidad: string
          reembolso_max_intentos: number
          staff_transicion_fin: string | null
          staff_transicion_inicio: string | null
          suscripcion_gracia_dias: number
          suscripcion_periodo_dias: number
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
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
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
          propietario_perfil_auto_alta: boolean
          propietario_profesional_por_defecto: boolean
          propietario_puede_activar_perfil: boolean
          propietario_puede_desactivar_perfil: boolean
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
          gracia_permite_operar: boolean
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
          prueba_gracia_dias: number
          prueba_modalidad: string
          reembolso_max_intentos: number
          staff_transicion_fin: string | null
          staff_transicion_inicio: string | null
          suscripcion_gracia_dias: number
          suscripcion_periodo_dias: number
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
      adicional_cancelar_renovacion: {
        Args: { p_lote_id: string; p_motivo?: string }
        Returns: Json
      }
      adicional_checkout_fallido_srv: {
        Args: { p_actor: string; p_lote_id: string; p_motivo?: string }
        Returns: undefined
      }
      adicional_cotizar: {
        Args: { p_cantidad: number; p_negocio_id: string }
        Returns: Json
      }
      adicional_dias_para: {
        Args: { p_desde?: string; p_hasta: string }
        Returns: number
      }
      adicional_fecha_bogota: { Args: { p_instante: string }; Returns: string }
      adicional_fin_periodo: {
        Args: { p_dias?: number; p_inicio: string }
        Returns: string
      }
      adicional_iniciar: {
        Args: {
          p_cantidad: number
          p_negocio_id: string
          p_total_esperado: number
        }
        Returns: Json
      }
      adicional_mantenimiento_srv: {
        Args: { p_ahora?: string; p_forzar?: boolean }
        Returns: Json
      }
      adicional_marcar_pago_pendiente_srv: {
        Args: { p_id_transaccion: string; p_pago_id: string }
        Returns: boolean
      }
      adicional_mis_lotes: { Args: { p_negocio_id: string }; Returns: Json }
      adicional_renovar: { Args: { p_lote_id: string }; Returns: Json }
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
      admin_adicional_accion: {
        Args: {
          p_accion: string
          p_datos?: Json
          p_lote_id: string
          p_motivo: string
        }
        Returns: Json
      }
      admin_adicional_activar_manual: {
        Args: {
          p_cantidad: number
          p_dias: number
          p_motivo: string
          p_negocio_id: string
          p_referencia?: string
          p_tipo: string
        }
        Returns: Json
      }
      admin_adicional_config_guardar: {
        Args: { p_config: Json; p_motivo: string }
        Returns: Json
      }
      admin_adicional_config_obtener: { Args: never; Returns: Json }
      admin_adicional_detalle: { Args: { p_lote_id: string }; Returns: Json }
      admin_adicional_listar: { Args: { p_filtros?: Json }; Returns: Json }
      admin_adicional_precio_guardar: {
        Args: {
          p_activo?: boolean
          p_motivo: string
          p_pais: string
          p_plan: Database["public"]["Enums"]["plan_codigo"]
          p_precio: number
        }
        Returns: Json
      }
      admin_adicional_reembolso_decidir: {
        Args: {
          p_cerrar_lote?: boolean
          p_decision: string
          p_id: string
          p_motivo: string
          p_referencia?: string
        }
        Returns: Json
      }
      admin_adicional_reembolso_listar: {
        Args: { p_estado?: string }
        Returns: Json
      }
      admin_adicional_reembolso_solicitar: {
        Args: {
          p_causa: string
          p_detalle: string
          p_monto?: number
          p_motivo: string
          p_pago_id: string
        }
        Returns: Json
      }
      admin_adicional_revision_listar: {
        Args: { p_estado?: string }
        Returns: Json
      }
      admin_adicional_revision_resolver: {
        Args: { p_id: string; p_motivo: string; p_resolucion: string }
        Returns: Json
      }
      admin_anular_comision_programada: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      admin_aprobar_verificacion_y_negocio: {
        Args: { p_motivo?: string; p_negocio_id: string }
        Returns: Json
      }
      admin_buscar: { Args: { p_q: string }; Returns: Json }
      admin_buscar_evidencias: {
        Args: {
          p_accion?: string
          p_categoria?: string
          p_correo?: string
          p_desde?: string
          p_documento?: string
          p_hasta?: string
          p_limite?: number
          p_negocio?: string
          p_offset?: number
          p_usuario?: string
        }
        Returns: Json
      }
      admin_comisiones_resumen: { Args: never; Returns: Json }
      admin_configurar_perfil_propietario_plan: {
        Args: {
          p_auto_alta: boolean
          p_motivo: string
          p_plan: Database["public"]["Enums"]["plan_codigo"]
          p_por_defecto: boolean
          p_puede_activar: boolean
          p_puede_desactivar: boolean
        }
        Returns: Json
      }
      admin_dashboard_resumen: { Args: never; Returns: Json }
      admin_decidir_verificacion: {
        Args: { p_motivo: string; p_negocio_id: string; p_nuevo: string }
        Returns: Database["public"]["Enums"]["verificacion_estado"]
      }
      admin_estado_operativo_negocios: {
        Args: { p_negocio_ids: string[] }
        Returns: {
          estado_operativo: Json
          negocio_id: string
        }[]
      }
      admin_estado_sistema: { Args: never; Returns: Json }
      admin_evidencia_detalle: { Args: { p_id: string }; Returns: Json }
      admin_expediente_evidencias: {
        Args: { p_motivo: string; p_usuario: string }
        Returns: Json
      }
      admin_marketing_resumen: { Args: never; Returns: Json }
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
      admin_reporte: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
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
      admin_set_config_suscripcion: {
        Args: {
          p_gracia_permite_operar: boolean
          p_motivo: string
          p_periodo_dias: number
          p_prueba_gracia_dias: number
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
      admin_usuario_detalle: { Args: { p_id: string }; Returns: Json }
      admin_usuario_registrar_accion: {
        Args: { p_accion: string; p_id: string; p_motivo: string }
        Returns: undefined
      }
      admin_usuarios_listar: {
        Args: {
          p_limite?: number
          p_offset?: number
          p_q?: string
          p_rol?: string
        }
        Returns: Json
      }
      admin_verificacion_detalle: {
        Args: { p_negocio_id: string }
        Returns: Json
      }
      admin_verificaciones_listar: {
        Args: {
          p_estado?: string
          p_limite?: number
          p_offset?: number
          p_q?: string
        }
        Returns: Json
      }
      admin_verificar_cadena_evidencias: { Args: never; Returns: Json }
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
      ai_acciones_costo_admin: {
        Args: never
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
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_accion_costo"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ajustar_saldo_pendiente_cliente: {
        Args: {
          p_cliente_id: string
          p_motivo: string
          p_negocio_id: string
          p_nuevo_saldo: number
          p_tipo?: string
        }
        Returns: number
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
      anular_cita_por_pago_invalido: {
        Args: { p_motivo: string; p_reserva_id: string }
        Returns: undefined
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
      autorizar_lectura_documento_srv: {
        Args: { p_actor: string; p_documento_id: string }
        Returns: Json
      }
      autorizar_staff: {
        Args: { p_canal?: string; p_documento: string }
        Returns: string
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
      calcular_fecha_limite: {
        Args: { p_plazo: number; p_recibido: string; p_unidad: string }
        Returns: string
      }
      calcular_festivos_co: {
        Args: { p_anio: number }
        Returns: {
          fecha: string
          nombre: string
        }[]
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
      cambiar_rol_equipo: {
        Args: { p_rol: string; p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
      cancelar_solicitud_ausencia: {
        Args: { p_solicitud_id: string }
        Returns: undefined
      }
      cancelar_solicitud_horario: {
        Args: { p_solicitud_id: string }
        Returns: undefined
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
      capacidad_profesional_negocio: {
        Args: { p_negocio_id: string }
        Returns: Json
      }
      caso_asignar: {
        Args: { p_responsable: string; p_supervisor?: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_autorizar_descarga: { Args: { p_adjunto: string }; Returns: string }
      caso_cambiar_estado: {
        Args: { p_motivo?: string; p_nuevo: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_cerrar: {
        Args: { p_nota?: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_consultar_publico: {
        Args: { p_numero: string; p_token_hash: string }
        Returns: Json
      }
      caso_dashboard: { Args: never; Returns: Json }
      caso_detalle: { Args: { p_ticket: string }; Returns: Json }
      caso_escalar: {
        Args: { p_motivo: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_evidencias: {
        Args: { p_ticket: string }
        Returns: {
          accion: string
          finalidad: string
          hash: string
          hash_anterior: string
          ocurrido_at: string
          rol: string
          secuencia: number
          tiene_texto: boolean
        }[]
      }
      caso_extender_plazo: {
        Args: { p_motivo: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_listar: {
        Args: {
          p_bandeja?: string
          p_filtros?: Json
          p_limite?: number
          p_offset?: number
        }
        Returns: {
          asunto: string
          canal: string
          categoria: string
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string
          horas_restantes: number
          id: string
          negocio_id: string
          numero: string
          plazo_origen: string
          prioridad: string
          proxima_accion: string
          recibido_at: string
          responsable: string
          responsable_id: string
          tipo_codigo: string
          tipo_nombre: string
          total: number
          vencido: boolean
        }[]
      }
      caso_nota_interna: {
        Args: { p_nota: string; p_ticket: string }
        Returns: number
      }
      caso_radicar: {
        Args: {
          p_asunto: string
          p_canal: string
          p_creado_por: string
          p_descripcion: string
          p_idempotency_key: string
          p_negocio_id: string
          p_politica_texto_id: string
          p_referencia: string
          p_solicitante: Json
          p_tipo: string
          p_token_hash: string
        }
        Returns: Json
      }
      caso_reabrir: {
        Args: { p_motivo: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_registrar_adjunto: {
        Args: {
          p_actor: string
          p_actor_tipo: string
          p_bytes: number
          p_mime: string
          p_nombre: string
          p_path: string
          p_sha256: string
          p_ticket: string
        }
        Returns: string
      }
      caso_registrar_envio: {
        Args: {
          p_destinatario: string
          p_error: string
          p_id_externo: string
          p_plantilla: string
          p_resultado: string
          p_ticket: string
        }
        Returns: undefined
      }
      caso_resolver: {
        Args: { p_resultado: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_responder: {
        Args: { p_mensaje: string; p_sustantiva?: boolean; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_responder_publico: {
        Args: { p_mensaje: string; p_numero: string; p_token_hash: string }
        Returns: boolean
      }
      caso_rotar_token: {
        Args: { p_email: string; p_numero: string; p_token_hash: string }
        Returns: string
      }
      caso_solicitar_subsanacion: {
        Args: { p_mensaje: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caso_trasladar: {
        Args: { p_destino: string; p_motivo: string; p_ticket: string }
        Returns: {
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
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
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
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
      completar_onboarding_negocio: {
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
      completar_reserva_sin_pos: {
        Args: { p_reserva_id: string }
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
      config_suscripcion: { Args: never; Returns: Json }
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
          p_rol?: string
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
          rol_invitado: string
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
      crear_reserva_autorizada: {
        Args: {
          p_autoriza_datos?: boolean
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
          acuse_at: string | null
          asunto: string
          canal: string
          cerrado_at: string | null
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["ticket_soporte_estado"]
          estado_caso: string
          estado_respuesta: string
          fecha_limite: string | null
          fecha_limite_original: string | null
          id: string
          idempotency_key: string | null
          negocio_id: string | null
          nota_cierre: string | null
          numero_radicacion: string | null
          plazo_origen: string | null
          prioridad: string
          prorroga_aplicada: boolean
          prorroga_motivo: string | null
          proxima_accion: string | null
          recibido_at: string | null
          reclamo_en_tramite_desde: string | null
          referencia_externa: string | null
          regla_id: string | null
          respondido_at: string | null
          responsable_id: string | null
          resuelto_at: string | null
          resultado: string | null
          subsanacion_requerida_at: string | null
          supervisor_id: string | null
          tipo_codigo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_soporte"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_clientes_filtrados: {
        Args: {
          p_etiqueta?: string
          p_limite?: number
          p_ltv_max?: number
          p_ltv_min?: number
          p_negocio_id: string
          p_offset?: number
          p_orden?: string
          p_patron_nombre?: string
          p_patron_telefono?: string
          p_primera_antes?: string
          p_primera_despues?: string
          p_sede_id?: string
          p_solo_consentimiento?: boolean
          p_ultima_antes?: string
          p_ultima_despues?: string
        }
        Returns: {
          fila: Json
          total: number
        }[]
      }
      cuentas_registro_abandonado: {
        Args: { p_horas?: number; p_limite?: number }
        Returns: {
          usuario_id: string
        }[]
      }
      cumplimiento_alertas_crm: {
        Args: { p_limite?: number }
        Returns: {
          created_at: string
          id: string
          leida: boolean
          numero: string
          prioridad: string
          regla: string
          ticket_id: string
        }[]
      }
      cumplimiento_config_set: {
        Args: { p_clave: string; p_valor: Json }
        Returns: undefined
      }
      cumplimiento_encolar: {
        Args: {
          p_plantilla: string
          p_regla: string
          p_ticket: string
          p_ventana?: string
        }
        Returns: number
      }
      cumplimiento_evaluar_sla: { Args: never; Returns: Json }
      cumplimiento_marcar: {
        Args: {
          p_error?: string
          p_id: string
          p_id_externo?: string
          p_resultado: string
        }
        Returns: string
      }
      cumplimiento_marcar_leidas: {
        Args: { p_ids?: string[] }
        Returns: number
      }
      cumplimiento_tomar_lote: {
        Args: { p_limite?: number }
        Returns: {
          canal: string
          created_at: string
          datos: Json
          destinatario: string | null
          destinatario_tipo: string
          enviado_at: string | null
          estado: string
          id: string
          id_externo: string | null
          idempotency_key: string
          intentos: number
          leida_at: string | null
          max_intentos: number
          plantilla: string
          proximo_intento_at: string | null
          regla: string
          ticket_id: string
          ultimo_error: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cumplimiento_notificacion"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cupo_plan_negocio: { Args: { p_negocio_id: string }; Returns: Json }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
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
      decidir_solicitud_ausencia: {
        Args: {
          p_aprobar: boolean
          p_confirmar_con_citas?: boolean
          p_motivo?: string
          p_solicitud_id: string
        }
        Returns: Json
      }
      decidir_solicitud_horario: {
        Args: { p_aprobar: boolean; p_motivo?: string; p_solicitud_id: string }
        Returns: string
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
      desactivar_perfil_profesional_propietario: {
        Args: { p_negocio_id: string }
        Returns: Json
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
      dias_habiles_entre: {
        Args: { p_a: string; p_b: string }
        Returns: number
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
      enviar_verificacion_a_revision: {
        Args: { p_negocio_id: string }
        Returns: Database["public"]["Enums"]["verificacion_estado"]
      }
      es_dia_habil: { Args: { p_fecha: string }; Returns: boolean }
      establecer_sede_principal: {
        Args: { p_sede_id: string }
        Returns: undefined
      }
      estado_autorizaciones_staff: {
        Args: { p_negocio: string }
        Returns: {
          en_transicion: boolean
          nombre: string
          publicable: boolean
          publicacion: string
          publicacion_at: string
          publicacion_evidencia: string
          staff_id: string
          tiene_foto: boolean
          transicion_fin: string
          tratamiento: string
          tratamiento_at: string
        }[]
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
      fecha_colombia: { Args: { p_ts: string }; Returns: string }
      fijar_foto_principal_negocio: {
        Args: { p_negocio_id: string; p_public_id: string; p_url: string }
        Returns: undefined
      }
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
      galeria_agregar: {
        Args: { p_negocio_id: string; p_public_id?: string; p_url: string }
        Returns: string
      }
      galeria_eliminar: { Args: { p_foto_id: string }; Returns: string }
      galeria_marcar_principal: {
        Args: { p_foto_id: string }
        Returns: undefined
      }
      galeria_reemplazar: {
        Args: { p_foto_id: string; p_public_id?: string; p_url: string }
        Returns: string
      }
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
      iniciar_prueba_negocio_srv2: {
        Args: {
          p_actor: string
          p_ciclo: string
          p_dispositivo_hash: string
          p_documento_hash: string
          p_email_hash: string
          p_equipo_hash: string
          p_ip_hash: string
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
      iniciar_verificacion_negocio: {
        Args: { p_negocio_id: string }
        Returns: Database["public"]["Enums"]["verificacion_estado"]
      }
      invalidar_sesion_usuario: {
        Args: { p_motivo: string; p_negocio_id: string; p_usuario_id: string }
        Returns: undefined
      }
      invitacion_para_enrutar: {
        Args: { p_invitacion_id: string }
        Returns: Json
      }
      invitacion_publica: { Args: { p_invitacion_id: string }; Returns: Json }
      is_admin_de: { Args: { p_negocio_id: string }; Returns: boolean }
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
      listar_eventos_fraude_negocio: {
        Args: { p_negocio_id: string; p_revisado?: boolean }
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
      marcar_pago_no_recibido_post_cita: {
        Args: { p_motivo: string; p_pago_id: string }
        Returns: number
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
      medios_pago_directo_para_reserva: {
        Args: { p_reserva_id: string }
        Returns: Json
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
      mi_verificacion_negocio: { Args: { p_negocio_id: string }; Returns: Json }
      mi_vinculo: {
        Args: never
        Returns: {
          comision_pct: number | null
          created_at: string
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
      negocio_acepta_anticipo: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      negocio_acepta_reservas: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      negocio_cobra_en_linea: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      negocio_estado_operativo: {
        Args: { p_negocio_id: string }
        Returns: Json
      }
      negocio_funcion_valor: {
        Args: { p_clave: string; p_negocio_id: string }
        Returns: string
      }
      negocio_operativo: { Args: { p_negocio_id: string }; Returns: boolean }
      negocio_puede_recibir_reservas: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      negocio_reportes_funciones: {
        Args: { p_negocio_id: string }
        Returns: Json
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
      negocio_verificado: { Args: { p_negocio_id: string }; Returns: boolean }
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
      pago_registrar_disputa: {
        Args: {
          p_estado_proveedor: string
          p_id_transaccion: string
          p_pago_id: string
        }
        Returns: Json
      }
      pascua: { Args: { p_anio: number }; Returns: string }
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
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
          contenido_sha256: string
          estado_juridico: string
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
      purgar_retencion_1581: { Args: never; Returns: Json }
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
      reagendar_reserva: {
        Args: {
          p_cliente_solicito?: boolean
          p_nuevo_inicio: string
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
          rol_invitado: string
          sede_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invitacion_staff"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_aceptacion_legal: {
        Args: { p_origen: string; p_texto_ids: string[]; p_tipo?: string }
        Returns: number
      }
      registrar_aceptacion_legal_registro: {
        Args: { p_texto_ids: string[]; p_usuario: string }
        Returns: number
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
      registrar_documento_verificacion_srv: {
        Args: {
          p_actor: string
          p_bytes: number
          p_formato: string
          p_negocio_id: string
          p_public_id: string
          p_tipo: string
          p_version: number
        }
        Returns: string
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
      registrar_pago_directo_reserva: {
        Args: {
          p_comprobante_hash: string
          p_comprobante_url: string
          p_monto_reportado: number
          p_reserva_id: string
        }
        Returns: string
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
          autor_id: string | null
          created_at: string
          id: string
          mensaje: string
          sustantiva: boolean
          ticket_id: string
          tipo: string
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
      retirar_documento_verificacion: {
        Args: { p_documento_id: string }
        Returns: undefined
      }
      retirar_empleado_corporativo: {
        Args: { p_cliente_id: string; p_cuenta_id: string }
        Returns: undefined
      }
      retirar_staff: {
        Args: { p_motivo?: string; p_vinculo_id: string }
        Returns: {
          comision_pct: number | null
          created_at: string
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
      revocar_publicacion_staff: { Args: never; Returns: string }
      rol_equipo: {
        Args: { p_negocio_id: string; p_usuario_id?: string }
        Returns: string
      }
      saldo_creditos_ia: { Args: { p_negocio_id: string }; Returns: number }
      saldo_pendiente_cliente: {
        Args: { p_cliente_id?: string; p_negocio_id: string }
        Returns: number
      }
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
      slots_para_reagendar: {
        Args: { p_fecha: string; p_reserva_id: string }
        Returns: {
          hora_fin: string
          hora_inicio: string
        }[]
      }
      solicitar_ausencia: {
        Args: {
          p_fin: string
          p_inicio: string
          p_motivo: string
          p_tipo: string
          p_vinculo_id: string
        }
        Returns: string
      }
      solicitar_cambio_horario: {
        Args: { p_dias: Json; p_sede_id: string; p_vinculo_id: string }
        Returns: string
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
      solicitar_pago_plan: {
        Args: {
          p_ciclo?: string
          p_negocio_id: string
          p_plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
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
      staff_es_publicable: {
        Args: { p_negocio: string; p_staff: string }
        Returns: boolean
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
      sumar_dias_habiles: {
        Args: { p_dias: number; p_inicio: string }
        Returns: string
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
      suscripcion_dia: { Args: { p_ts: string }; Returns: string }
      suscripcion_fecha_limite: {
        Args: { p_dias: number; p_inicio: string }
        Returns: string
      }
      suscripcion_inicio_dia: { Args: { p_dia: string }; Returns: string }
      suscripcion_numero_dia: {
        Args: { p_ahora: string; p_inicio: string }
        Returns: number
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
          foto_principal_public_id: string | null
          foto_principal_url: string | null
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
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
      texto_autorizacion_datos_reserva: {
        Args: { p_negocio: string }
        Returns: string
      }
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
          es_admin: boolean
          es_guardian: boolean
          estado: Database["public"]["Enums"]["vinculo_estado"]
          fecha_ingreso: string | null
          id: string
          negocio_id: string
          presta_servicios: boolean
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
      verificar_cadena_evidencias: {
        Args: { p_desde?: number; p_hasta?: number }
        Returns: {
          problema: string
          secuencia: number
        }[]
      }
      verificar_pago_reserva: {
        Args: { p_pago_id: string }
        Returns: undefined
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
      webhook_registrar_resultado: {
        Args: {
          p_error?: string
          p_estado_proveedor?: string
          p_firma?: string
          p_live_mode?: boolean
          p_negocio_id?: string
          p_pago_id?: string
          p_procesado: boolean
          p_proveedor: string
          p_request_id: string
          p_resultado: string
        }
        Returns: undefined
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
      verificacion_estado:
        | "NO_INICIADA"
        | "PENDIENTE_DOCUMENTACION"
        | "EN_REVISION"
        | "VERIFICADA"
        | "REQUIERE_CORRECCION"
        | "RECHAZADA"
        | "REVOCADA"
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
      verificacion_estado: [
        "NO_INICIADA",
        "PENDIENTE_DOCUMENTACION",
        "EN_REVISION",
        "VERIFICADA",
        "REQUIERE_CORRECCION",
        "RECHAZADA",
        "REVOCADA",
      ],
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


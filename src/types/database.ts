export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      configuracion_plataforma: {
        Row: {
          comision_plataforma_pct_default: number
          cpc_destacado_cop: number
          cpc_pin_cop: number
          cpm_pin_cop: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comision_plataforma_pct_default?: number
          cpc_destacado_cop?: number
          cpc_pin_cop?: number
          cpm_pin_cop?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comision_plataforma_pct_default?: number
          cpc_destacado_cop?: number
          cpc_pin_cop?: number
          cpm_pin_cop?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          payload_antes: Json | null
          payload_despues: Json | null
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
          payload_antes?: Json | null
          payload_despues?: Json | null
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
          payload_antes?: Json | null
          payload_despues?: Json | null
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
          lote_id: string | null
          mensaje: string | null
          monto_original: number
          negocio_id: string
          pin_hash: string
          saldo_actual: number
          updated_at: string
        }
        Insert: {
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
          lote_id?: string | null
          mensaje?: string | null
          monto_original: number
          negocio_id: string
          pin_hash: string
          saldo_actual: number
          updated_at?: string
        }
        Update: {
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
        Relationships: []
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
      pago: {
        Row: {
          comision_plataforma_monto: number | null
          created_at: string
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
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
          created_at?: string
          es_huerfano?: boolean
          estado?: Database["public"]["Enums"]["pago_estado"]
          id?: string
          id_preferencia_pasarela?: string | null
          id_transaccion_pasarela?: string | null
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
          created_at?: string
          es_huerfano?: boolean
          estado?: Database["public"]["Enums"]["pago_estado"]
          id?: string
          id_preferencia_pasarela?: string | null
          id_transaccion_pasarela?: string | null
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
          nombre: string
          telefono: string | null
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
          nombre: string
          telefono?: string | null
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
          nombre?: string
          telefono?: string | null
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
          consentimiento: boolean
          created_at: string
          id: string
          negocio_id: string
          reserva_id: string
          subido_por: string
          url: string
        }
        Insert: {
          cliente_id: string
          consentimiento: boolean
          created_at?: string
          id?: string
          negocio_id: string
          reserva_id: string
          subido_por: string
          url: string
        }
        Update: {
          cliente_id?: string
          consentimiento?: boolean
          created_at?: string
          id?: string
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
          buffer_posterior_minutos: number
          buffer_previo_minutos: number
          categoria_puntaje: Database["public"]["Enums"]["categoria_puntaje"]
          created_at: string
          descripcion: string | null
          duracion_minutos: number
          estado: Database["public"]["Enums"]["servicio_estado"]
          id: string
          negocio_id: string
          nombre: string
          precio_base: number
          requiere_recurso_tipo_id: string | null
          updated_at: string
        }
        Insert: {
          buffer_posterior_minutos?: number
          buffer_previo_minutos?: number
          categoria_puntaje?: Database["public"]["Enums"]["categoria_puntaje"]
          created_at?: string
          descripcion?: string | null
          duracion_minutos: number
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
          negocio_id: string
          nombre: string
          precio_base: number
          requiere_recurso_tipo_id?: string | null
          updated_at?: string
        }
        Update: {
          buffer_posterior_minutos?: number
          buffer_previo_minutos?: number
          categoria_puntaje?: Database["public"]["Enums"]["categoria_puntaje"]
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number
          estado?: Database["public"]["Enums"]["servicio_estado"]
          id?: string
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
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
          reintentos_fallo_count: number
          suspendido_causa: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo?: string
          fecha_proximo_cobro: string
          id?: string
          negocio_id: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino?:
            | Database["public"]["Enums"]["plan_codigo"]
            | null
          reintentos_fallo_count?: number
          suspendido_causa?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo?: string
          fecha_proximo_cobro?: string
          id?: string
          negocio_id?: string
          plan_codigo?: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino?:
            | Database["public"]["Enums"]["plan_codigo"]
            | null
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
      whatsapp_conversacion_lote: {
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
            foreignKeyName: "whatsapp_conversacion_lote_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
      _validar_gift_card_para_canje: {
        Args: { p_codigo: string; p_pin: string }
        Returns: {
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
          comision_plataforma_pct_default: number
          cpc_destacado_cop: number
          cpc_pin_cop: number
          cpm_pin_cop: number
          id: boolean
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
          comision_plataforma_pct_default: number
          cpc_destacado_cop: number
          cpc_pin_cop: number
          cpm_pin_cop: number
          id: boolean
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
      admin_dashboard_resumen: { Args: never; Returns: Json }
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
      bloquear_gift_card: {
        Args: { p_gift_card_id: string; p_motivo: string }
        Returns: {
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
      cancelar_downgrade_programado: {
        Args: { p_negocio_id: string }
        Returns: {
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
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
      cierre_caja_dia: {
        Args: { p_fecha?: string; p_negocio_id: string; p_sede_id?: string }
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
          created_at: string
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
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
      configurar_funcion_plan_ia: {
        Args: {
          p_funcion: string
          p_habilitado: boolean
          p_plan_codigo: Database["public"]["Enums"]["plan_codigo"]
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
          created_at: string
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
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
          created_at: string
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
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
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
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
      eliminar_banner_home: { Args: { p_id: string }; Returns: undefined }
      enviar_negocio_a_aprobacion: {
        Args: { p_negocio_id: string }
        Returns: {
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
      is_barberia_de: { Args: { p_negocio_id: string }; Returns: boolean }
      is_guardian_de_negocio: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      is_guardian_de_sede: { Args: { p_sede_id: string }; Returns: boolean }
      is_staff_de: { Args: { p_negocio_id: string }; Returns: boolean }
      is_supersu: { Args: never; Returns: boolean }
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
      marcar_negocio_en_mora: {
        Args: { p_motivo: string; p_negocio_id: string }
        Returns: {
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
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
      mi_nivel_vip: {
        Args: { p_negocio_id: string }
        Returns: {
          beneficios: string
          nivel_nombre: string
          orden: number
        }[]
      }
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
      registrar_evento_fraude: {
        Args: {
          p_negocio_id?: string
          p_payload?: Json
          p_severidad?: string
          p_tipo: string
        }
        Returns: undefined
      }
      registrar_impresion_patrocinada: {
        Args: { p_campana_id: string }
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
      solicitar_downgrade_plan: {
        Args: {
          p_negocio_id: string
          p_plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: {
          created_at: string
          estado: Database["public"]["Enums"]["suscripcion_estado"]
          fecha_inicio_ciclo: string
          fecha_proximo_cobro: string
          id: string
          negocio_id: string
          plan_codigo: Database["public"]["Enums"]["plan_codigo"]
          plan_codigo_destino: Database["public"]["Enums"]["plan_codigo"] | null
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
      solicitar_upgrade_plan: {
        Args: {
          p_negocio_id: string
          p_plan_codigo_nuevo: Database["public"]["Enums"]["plan_codigo"]
        }
        Returns: {
          comision_plataforma_monto: number | null
          created_at: string
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
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
      suscribirse_membresia: {
        Args: { p_plan_id: string }
        Returns: {
          comision_plataforma_monto: number | null
          created_at: string
          es_huerfano: boolean
          estado: Database["public"]["Enums"]["pago_estado"]
          id: string
          id_preferencia_pasarela: string | null
          id_transaccion_pasarela: string | null
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
      temporada_actual_id: { Args: never; Returns: string }
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
      plan_codigo: "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER"
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
      suscripcion_estado: "ACTIVA" | "EN_MORA" | "SUSPENDIDA" | "CANCELADA"
      temporada_estado: "EN_CURSO" | "CERRADA" | "CONSOLIDADA"
      ticket_soporte_estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO"
      vinculo_estado: "INVITADO" | "ACTIVO" | "SUSPENDIDO" | "RETIRADO"
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
  graphql_public: {
    Enums: {},
  },
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
      plan_codigo: ["RAVEN", "JARL", "VALHALLA", "ALLFATHER"],
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
      suscripcion_estado: ["ACTIVA", "EN_MORA", "SUSPENDIDA", "CANCELADA"],
      temporada_estado: ["EN_CURSO", "CERRADA", "CONSOLIDADA"],
      ticket_soporte_estado: ["ABIERTO", "EN_PROCESO", "RESUELTO"],
      vinculo_estado: ["INVITADO", "ACTIVO", "SUSPENDIDO", "RETIRADO"],
    },
  },
} as const


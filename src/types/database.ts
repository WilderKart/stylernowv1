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
          created_at: string
          estado: Database["public"]["Enums"]["campana_estado"]
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string
          gasto_hoy: number
          gasto_hoy_fecha: string
          gasto_total: number
          id: string
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total: number | null
          segmentacion: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["campana_estado"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          formato: string
          gasto_hoy?: number
          gasto_hoy_fecha?: string
          gasto_total?: number
          id?: string
          negocio_id: string
          presupuesto_diario: number
          presupuesto_total?: number | null
          segmentacion?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["campana_estado"]
          fecha_fin?: string | null
          fecha_inicio?: string | null
          formato?: string
          gasto_hoy?: number
          gasto_hoy_fecha?: string
          gasto_total?: number
          id?: string
          negocio_id?: string
          presupuesto_diario?: number
          presupuesto_total?: number | null
          segmentacion?: Json
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
      aplicar_evento_pago: {
        Args: {
          p_estado: Database["public"]["Enums"]["pago_estado"]
          p_id_transaccion: string
          p_pago_id: string
          p_payload?: Json
        }
        Returns: Json
      }
      calcular_sena: {
        Args: { p_monto_total: number; p_negocio_id: string }
        Returns: number
      }
      cancelar_invitacion: {
        Args: { p_invitacion_id: string }
        Returns: undefined
      }
      cancelar_reserva: {
        Args: { p_motivo?: string; p_reserva_id: string }
        Returns: Json
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
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suscripcion"
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
      expirar_reservas_vencidas: { Args: never; Returns: number }
      is_barberia_de: { Args: { p_negocio_id: string }; Returns: boolean }
      is_guardian_de_negocio: {
        Args: { p_negocio_id: string }
        Returns: boolean
      }
      is_guardian_de_sede: { Args: { p_sede_id: string }; Returns: boolean }
      is_staff_de: { Args: { p_negocio_id: string }; Returns: boolean }
      is_supersu: { Args: never; Returns: boolean }
      marketplace_buscar: {
        Args: {
          p_categoria?: string
          p_ciudad?: string
          p_limite?: number
          p_offset?: number
          p_orden?: string
          p_texto?: string
        }
        Returns: {
          calificacion: number
          categoria: string[]
          ciudad: string
          descripcion: string
          id: string
          logo_url: string
          nombre: string
          precio_desde: number
          proxima_disponibilidad: string
          sede_id: string
          slug: string
          total_resenas: number
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
      responder_invitacion: {
        Args: { p_aceptar: boolean; p_invitacion_id: string }
        Returns: Json
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      categoria_puntaje: "ESTANDAR" | "PREMIUM" | "COMPLEMENTARIO"
      invitacion_staff_estado:
        | "PENDIENTE"
        | "ACEPTADA"
        | "EXPIRADA"
        | "CANCELADA"
        | "RECHAZADA"
      lista_espera_estado:
        | "ACTIVA"
        | "NOTIFICADA"
        | "CONVERTIDA"
        | "EXPIRADA_VENTANA"
        | "EXPIRADA_FECHA"
        | "CANCELADA"
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
      plan_codigo: "RAVEN" | "JARL" | "VALHALLA" | "ALLFATHER"
      recurso_estado: "DISPONIBLE" | "FUERA_DE_SERVICIO"
      resena_estado: "VISIBLE" | "REPORTADA" | "ELIMINADA"
      reserva_estado:
        | "PENDIENTE_PAGO"
        | "CONFIRMADA"
        | "EN_CURSO"
        | "COMPLETADA"
        | "CANCELADA"
        | "NO_SHOW"
      servicio_estado: "ACTIVO" | "INACTIVO"
      suscripcion_estado: "ACTIVA" | "EN_MORA" | "SUSPENDIDA" | "CANCELADA"
      temporada_estado: "EN_CURSO" | "CERRADA" | "CONSOLIDADA"
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
      categoria_puntaje: ["ESTANDAR", "PREMIUM", "COMPLEMENTARIO"],
      invitacion_staff_estado: [
        "PENDIENTE",
        "ACEPTADA",
        "EXPIRADA",
        "CANCELADA",
        "RECHAZADA",
      ],
      lista_espera_estado: [
        "ACTIVA",
        "NOTIFICADA",
        "CONVERTIDA",
        "EXPIRADA_VENTANA",
        "EXPIRADA_FECHA",
        "CANCELADA",
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
      ],
      plan_codigo: ["RAVEN", "JARL", "VALHALLA", "ALLFATHER"],
      recurso_estado: ["DISPONIBLE", "FUERA_DE_SERVICIO"],
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
      suscripcion_estado: ["ACTIVA", "EN_MORA", "SUSPENDIDA", "CANCELADA"],
      temporada_estado: ["EN_CURSO", "CERRADA", "CONSOLIDADA"],
      vinculo_estado: ["INVITADO", "ACTIVO", "SUSPENDIDO", "RETIRADO"],
    },
  },
} as const


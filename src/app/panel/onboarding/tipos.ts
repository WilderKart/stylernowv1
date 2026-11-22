export interface NegocioData {
  pais_codigo?: string;
  id: string;
  nombre: string;
  categoria: string[];
  ciudad: string;
  descripcion: string | null;
  logo_url: string | null;
  foto_principal_url?: string | null;
  telefono_contacto: string | null;
  email_contacto: string | null;
  plan_codigo: string;
  onboarding_completo: boolean;
  estado: string;
}

export interface SedeData {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario_base: unknown;
  latitud: number | null;
  longitud: number | null;
}

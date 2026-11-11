import "server-only";
import { llamarRpc, type Resultado } from "./base";

/** C11 Idioma y región, C12 Permisos, C17 Registro. Idiomas: es|en. Países: CO|US|MX|ES. */
export type Pais = "CO" | "US" | "MX" | "ES";
export type Idioma = "es" | "en";
export type EstadoPermiso = "PERMITIDO" | "MAS_TARDE";

export interface Preferencias {
  pais: Pais | null;
  locale: Idioma;
  nombre: string;
  permiso_ubicacion: EstadoPermiso | null;
  permiso_notificaciones: EstadoPermiso | null;
  onboarding_completo: boolean;
}
export const obtenerPreferencias = (): Promise<Resultado<Preferencias>> => llamarRpc<Preferencias>("obtener_preferencias");

/** C11 «CONTINUAR». */
export async function actualizarIdiomaRegion(pais: Pais, locale: Idioma): Promise<Resultado<{ pais: Pais; locale: Idioma }>> {
  const r = await llamarRpc<{ pais: Pais; locale: Idioma }[]>("actualizar_idioma_region", { p_pais: pais, p_locale: locale });
  if (!r.ok) return r;
  return r.data[0] ? { ok: true, data: r.data[0] } : { ok: false, codigo: "PERFIL_NO_ENCONTRADO", error: "No encontramos tu perfil." };
}

/**
 * C12 «EMPEZAR». Guarda la decisión del usuario (el permiso real del SO/navegador lo gestiona el cliente).
 * `PERMITIDO` solo si el usuario concedió; `MAS_TARDE` si pulsó «Ahora no». null = sin cambio.
 */
export function guardarPermisos(ubicacion: EstadoPermiso | null, notificaciones: EstadoPermiso | null, completarOnboarding = true): Promise<Resultado<unknown>> {
  return llamarRpc("guardar_permisos", {
    // La función SQL no define default para p_ubicacion/p_notificaciones: PostgREST (PGRST202) exige enviar ambos, aunque sea null.
    p_ubicacion: ubicacion,
    p_notificaciones: notificaciones,
    p_completar: completarOnboarding,
  });
}

/**
 * C17 «CREAR CUENTA» — llamar DESPUÉS de verificar el código (sesión activa).
 * `marketing` es la casilla opcional y debe ser false salvo marcado explícito por el usuario.
 * Guarda nombre/país/idioma, acepta Términos y Política vigentes y registra el consentimiento de marketing.
 */
export function completarRegistro(datos: { nombre: string; pais: Pais; marketing: boolean; locale?: Idioma }): Promise<Resultado<{ ok: true; pais: Pais; locale: Idioma }>> {
  return llamarRpc("completar_registro", {
    p_nombre: datos.nombre,
    p_pais: datos.pais,
    p_marketing: datos.marketing === true,
    p_locale: datos.locale ?? "es",
  });
}

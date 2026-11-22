const CLAVE_DISPOSITIVO = "sn_dispositivo_id";

/**
 * Rasgos estables del equipo para el antiabuso de la prueba (migración 135). No identifican a la persona:
 * el servidor solo guarda su HMAC y lo combina con la red. Solo navegador.
 */
export function rasgosDelEquipo(): string {
  try {
    const n = navigator as Navigator & { deviceMemory?: number };
    return [
      n.userAgent,
      n.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(window.devicePixelRatio),
      String(n.hardwareConcurrency ?? ""),
      String(n.deviceMemory ?? ""),
    ]
      .join("|")
      .slice(0, 600);
  } catch {
    return "equipo-desconocido";
  }
}

/** Identificador estable del dispositivo: se genera una vez y se persiste (try/catch por si el almacenamiento falla). */
export function obtenerDispositivoId(): string {
  try {
    const existente = window.localStorage.getItem(CLAVE_DISPOSITIVO);
    if (existente) return existente;
    const nuevo = crypto.randomUUID();
    window.localStorage.setItem(CLAVE_DISPOSITIVO, nuevo);
    return nuevo;
  } catch {
    return crypto.randomUUID();
  }
}

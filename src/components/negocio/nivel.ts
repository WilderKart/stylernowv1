/** Convierte el texto libre de `nivel` del staff a la clave del componente Tier. */
export function nivelATier(nivel: string | null | undefined): "pro" | "expert" | "master" | undefined {
  const n = (nivel ?? "").toLowerCase();
  if (n.includes("master")) return "master";
  if (n.includes("expert")) return "expert";
  if (n.includes("pro")) return "pro";
  return undefined;
}

/** Fotos de respaldo del prototipo (public/img) cuando no hay imagen en Storage. */
export const FOTOS_RESPALDO = ["/img/interior.jpg", "/img/mirror.jpg", "/img/shave.jpg", "/img/tools.jpg", "/img/facade.jpg"];
export const FOTO_NEGOCIO_RESPALDO = "/img/chairs.jpg";

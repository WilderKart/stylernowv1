const RESPALDOS = ["interior", "tools", "mirror", "facade", "shave", "chairs"] as const;

/** Foto del negocio, o una del set del sistema (determinista por id) si no tiene imagen. */
export function fotoNegocio(id: string, logoUrl: string | null) {
  if (logoUrl) return logoUrl;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `/img/${RESPALDOS[h % RESPALDOS.length]}.jpg`;
}

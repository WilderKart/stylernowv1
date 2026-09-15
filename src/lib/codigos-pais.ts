/**
 * Códigos de país para el selector de celular. Colombia primero y por
 * defecto — es el mercado de lanzamiento (06-Security/04_Compliance_
 * Colombia.md) — el resto cubre los países más probables de expansión
 * regional (01-PRD/01_Product_Vision.md: "arquitectura preparada para
 * expansión regional").
 */
export const CODIGOS_PAIS = [
  { codigo: "+57", pais: "Colombia", bandera: "🇨🇴" },
  { codigo: "+52", pais: "México", bandera: "🇲🇽" },
  { codigo: "+51", pais: "Perú", bandera: "🇵🇪" },
  { codigo: "+593", pais: "Ecuador", bandera: "🇪🇨" },
  { codigo: "+54", pais: "Argentina", bandera: "🇦🇷" },
  { codigo: "+56", pais: "Chile", bandera: "🇨🇱" },
  { codigo: "+58", pais: "Venezuela", bandera: "🇻🇪" },
  { codigo: "+34", pais: "España", bandera: "🇪🇸" },
  { codigo: "+1", pais: "Estados Unidos", bandera: "🇺🇸" },
] as const;

export const CODIGO_PAIS_DEFECTO = "+57";

/** Separa un teléfono guardado ("+573183943465") en código + número local. */
export function separarTelefono(telefono: string | null): { codigo: string; local: string } {
  if (!telefono) return { codigo: CODIGO_PAIS_DEFECTO, local: "" };
  const encontrado = [...CODIGOS_PAIS]
    .sort((a, b) => b.codigo.length - a.codigo.length) // +593 antes que +57, etc.
    .find((c) => telefono.startsWith(c.codigo));
  if (!encontrado) return { codigo: CODIGO_PAIS_DEFECTO, local: telefono.replace(/\D/g, "") };
  return { codigo: encontrado.codigo, local: telefono.slice(encontrado.codigo.length) };
}

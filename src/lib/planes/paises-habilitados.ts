/**
 * Países HABILITADOS para operar y mostrarse en el lanzamiento. StylerNow arranca solo en Colombia: los demás países siguen en la
 * arquitectura (tablas, precios, moneda, validaciones del servidor) para una expansión futura, pero NO se ofrecen como opción en
 * formularios, onboarding, ajustes ni la página comercial. Para abrir un mercado se agrega su código a la variable
 * NEXT_PUBLIC_PAISES_HABILITADOS (por ejemplo "CO,MX") y se vuelve a desplegar; no hay que tocar código.
 */
const DEFECTO = ["CO"];

export function paisesHabilitados(valor: string | undefined = process.env.NEXT_PUBLIC_PAISES_HABILITADOS): string[] {
  const lista = (valor ?? "")
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p) => /^[A-Z]{2}$/.test(p));
  return lista.length > 0 ? lista : DEFECTO;
}

export function paisEstaHabilitado(codigo: string, valor?: string): boolean {
  return paisesHabilitados(valor).includes(codigo.toUpperCase());
}

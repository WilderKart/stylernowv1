// Uso: node scripts/legal/generar-migracion.mjs
// Genera supabase/migrations/149_textos_legales_tawilstack.sql a partir de las dos fuentes canónicas. Nunca se edita la migración a mano.
import fs from "node:fs";
import path from "node:path";
const R = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..") + path.sep;
const leer = (f) => fs.readFileSync(R + f, "utf8").replace(/\r\n/g, "\n");
const terminosFuente = leer("docs/legal/TERMINOS_v4_borrador.txt");
const inicio = terminosFuente.indexOf("Términos y Condiciones de Uso — StylerNow");
const terminos = terminosFuente.slice(inicio).replace(/\s+$/, "");
const politica = leer("docs/legal/POLITICA_DATOS_v3_texto.txt").replace(/\s+$/, "");
for (const [n, s] of [["terminos", terminos], ["politica", politica]]) if (s.includes("$" + n + "$")) throw new Error("el texto contiene el delimitador " + n);

const sql = `-- 149 · Publica nuevas versiones de los Términos y Condiciones y de la Política de Tratamiento de Datos Personales (TAWILSTACK S.A.S.), sin cambios de esquema.
-- Fuentes canónicas (esta migración se GENERA de ellas; no se edita a mano): docs/legal/TERMINOS_v4_borrador.txt (desde la línea del título) y docs/legal/POLITICA_DATOS_v3_texto.txt.
-- Verificación de sincronización: node scripts/legal/verificar-sincronizacion.mjs
-- cambio_material = true activa el flujo existente de reaceptación.
-- Estado de producción medido el 2026-11-17: TERMINOS hasta la versión 2 (texto corto) y POLITICA_DATOS hasta la versión 2 (con «NIT xxxxx» y dirección antigua).
-- La migración 115 (Términos de 18 000 caracteres) NO llegó a insertar su versión 3 en producción; por eso aquí las versiones nuevas son max+1 (TERMINOS 3, POLITICA_DATOS 3).
-- Se aborta (sin cambios) si el estado de las versiones no es el esperado o si los textos conservan marcadores. El NIT permanece «en trámite de asignación» a propósito.

begin;

do $publicar$
declare
  v_terminos text := $terminos$${terminos}
$terminos$;
  v_politica text := $politica$${politica}
$politica$;
  v_max_terminos integer;
  v_max_politica integer;
begin
  select coalesce(max(version), 0) into v_max_terminos from public.texto_legal where tipo = 'TERMINOS';
  select coalesce(max(version), 0) into v_max_politica from public.texto_legal where tipo = 'POLITICA_DATOS';

  -- Términos: 2 (producción hoy) o 3 (si algún día se aplicó la 115). Política: 2.
  if v_max_terminos not in (2, 3) or v_max_politica <> 2 then
    raise exception 'VERSION_LEGAL_INESPERADA: términos %, política %; revisar antes de publicar', v_max_terminos, v_max_politica;
  end if;
  if v_terminos like '%[PENDIENTE%' or v_politica like '%[PENDIENTE%'
    or v_terminos like '%[COMPLETAR%' or v_politica like '%[COMPLETAR%'
    or v_terminos like '%[DECISIÓN%' or v_politica like '%[DECISIÓN%'
    or v_terminos like '%xxxxx%' or v_politica like '%xxxxx%' then
    raise exception 'TEXTOS_LEGALES_CON_MARCADORES';
  end if;
  if position('TAWILSTACK S.A.S.' in v_terminos) = 0
    or position('TAWILSTACK S.A.S.' in v_politica) = 0
    or position('NIT en trámite de asignación' in v_terminos) = 0
    or position('NIT en trámite de asignación' in v_politica) = 0
    or position('Calle 15B # 20-79' in v_terminos) = 0
    or position('Calle 15B # 20-79' in v_politica) = 0 then
    raise exception 'IDENTIFICACION_TAWILSTACK_INCOMPLETA';
  end if;

  insert into public.texto_legal (tipo, version, contenido, cambio_material)
  values
    ('TERMINOS', v_max_terminos + 1, v_terminos, true),
    ('POLITICA_DATOS', v_max_politica + 1, v_politica, true);
end;
$publicar$;

commit;
`;
fs.writeFileSync(R + "supabase/migrations/149_textos_legales_tawilstack.sql", sql, "utf8");
console.log("migración generada:", sql.length, "caracteres");

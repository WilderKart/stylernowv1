import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.resolve(process.cwd());
const leer = (relativo: string) => fs.readFileSync(path.join(raiz, relativo), "utf8");

function archivosFuente(directorio: string): string[] {
  const absolute = path.join(raiz, directorio);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) return archivosFuente(relativo);
    return /\.(ts|tsx)$/.test(entrada.name) ? [relativo] : [];
  });
}

describe("Fase 5 · cumplimiento técnico Ley 1581", () => {
  it("mantiene los textos legales publicados sincronizados y con datos reales", () => {
    const salida = execFileSync(process.execPath, ["scripts/legal/verificar-sincronizacion.mjs"], {
      cwd: raiz,
      encoding: "utf8",
    });
    expect(salida).toContain("TODO COINCIDE");
    for (const canonica of ["docs/legal/TERMINOS_v4_borrador.txt", "docs/legal/POLITICA_DATOS_v3_texto.txt"]) {
      expect(leer(canonica)).toContain("NIT 902127652-0");
    }
  });

  it("exige aceptación legal expresa y desmarcada por defecto en el registro", () => {
    const campos = leer("src/app/login/_componentes/campos.tsx");
    expect(campos).toContain("Casilla obligatoria de Términos y Política de Tratamiento de Datos");

    const registro = leer("src/app/registro/formulario-registro.tsx");
    expect(registro).toContain('useState(false)');
    expect(registro).toContain("<CasillaLegal");
    expect(registro).not.toMatch(/CasillaLegal[^>]*defaultChecked/);
  });

  it("conserva el historial de consentimientos append-only y sin finalidades de funcionamiento", () => {
    const consentimientos = leer("src/lib/cliente/privacidad.ts");
    expect(consentimientos).toContain("APPEND-ONLY");
    for (const proposito of ["analitica", "personalizacion", "ofertas_cercanas", "beneficios_marcas", "marketing_email", "marketing_whatsapp"]) {
      expect(consentimientos).toContain(`"${proposito}"`);
    }
    expect(consentimientos).not.toContain('"funcionamiento"');
  });

  it("purga y anonimiza los datos personales de retención corta mediante cron", () => {
    const migracion = leer("supabase/migrations/183_retencion_1581_purgas.sql");
    expect(migracion).toContain("create or replace function public.purgar_retencion_1581()");
    expect(migracion).toContain("public.intento_auth");
    expect(migracion).toContain("interval '30 days'");
    expect(migracion).toContain("public.anuncio_evento_dedupe");
    expect(migracion).toContain("interval '730 days'");
    expect(migracion).toContain("public.prueba_uso");
    expect(migracion).toContain("ip_hash = null");
    expect(migracion).toContain("equipo_hash = null");
    expect(migracion).toContain("revoke all on function public.purgar_retencion_1581() from public, anon, authenticated");

    const cron = leer("src/app/api/cron/diario/route.ts");
    expect(cron).toContain('rpc("purgar_retencion_1581")');
    expect(cron).toContain("resultado.retencion_1581");
  });

  it("elimina PII de eventos de Sentry antes de enviarlos", () => {
    const sentry = leer("src/lib/sentry/comun.ts");
    expect(sentry).toContain("sendDefaultPii: false");
    expect(sentry).toContain("delete req.cookies");
    expect(sentry).toContain("delete req.data");
    expect(sentry).toContain("req.headers = {}");
    expect(sentry).toContain("evento.user.id");
    expect(sentry).toContain("CLAVE_SENSIBLE");
  });

  it("no escribe correos, teléfonos ni documentos en console.*", () => {
    const pii = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b3\d{9}\b|\b\d{6,10}\b(?=\D*$)/;
    const hallazgos = archivosFuente("src").flatMap((archivo) =>
      leer(archivo)
        .split("\n")
        .filter((linea) => /console\.(log|info|debug|warn|error)\(/.test(linea) && pii.test(linea))
        .map((linea) => `${archivo}: ${linea.trim()}`)
    );
    expect(hallazgos).toEqual([]);
  });
});

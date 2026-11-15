/**
 * H-008 · Server Actions de /admin: ¿cada operación verifica la autorización en el SERVIDOR?
 *
 * Ejecuta el código REAL de cada Server Action exportada en src/app/admin/** con la sesión REAL (JWT de GoTrue local) de
 * cada actor contra la base LOCAL de Docker, y mide:
 *   · el resultado devuelto (ok / datos),
 *   · si cambió el estado de la base (huella md5 de todas las tablas de `public` y de `auth.users` antes/después).
 * Un actor que no es Super Admin NO debe: obtener ok:true en una escritura, leer datos de la plataforma, ni alterar la base.
 * El Super Admin hace de CONTROL: sirve para demostrar que las llamadas son válidas (si el control falla, la prueba no vale).
 *
 * Solo corre con PRUEBAS_LOCALES_ADMIN=1 y exige que la API sea http://127.0.0.1:55321 (jamás un entorno remoto).
 * Salida: docs/plan_cierre/evidencias_1a/admin_actions_<etiqueta>.json
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const API = process.env.API_URL ?? "";
const ANON = process.env.ANON_KEY ?? "";
const SERVICE = process.env.SERVICE_ROLE_KEY ?? "";
const PW = process.env.PW_PRUEBAS ?? "";
const ETIQUETA = process.env.ETIQUETA ?? "ejecucion";
const habilitado = process.env.PRUEBAS_LOCALES_ADMIN === "1" && API === "http://127.0.0.1:55321" && ANON && SERVICE && PW;

// ── Sustitutos de Next (no hay servidor Next en esta prueba; el resto del código es el real) ───────────────────────────
let actual: SupabaseClient;
let admin: SupabaseClient;
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => actual }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));

const sql = (q: string) =>
  execSync("docker exec -i supabase_db_stylernow-cierre psql -U postgres -d postgres -At -v ON_ERROR_STOP=1", { input: q, encoding: "utf8" }).trim();
const uno = (q: string, defecto: string) => {
  try {
    return sql(q).split("\n")[0] || defecto;
  } catch {
    return defecto;
  }
};

/** Huella por tabla (md5 del contenido). Se compara antes/después de cada actor. */
function huella(): Record<string, string> {
  const filas = sql(`
    select t.s || '.' || t.n || '=' || (xpath('/row/c/text()', query_to_xml(format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) as c from %I.%I x', t.s, t.n), false, true, '')))[1]::text
    from (select schemaname s, tablename n from pg_tables where schemaname = 'public' union all select 'auth', 'users') t order by 1`);
  return Object.fromEntries(filas.split("\n").map((l) => l.split("=") as [string, string]));
}
const diferencias = (a: Record<string, string>, b: Record<string, string>) => Object.keys(b).filter((k) => a[k] !== b[k]);

const ACTORES = ["anonimo", "intruso", "cliente-a", "pro-a1", "guardian-a", "dueno-a", "dueno-b", "super"] as const;

describe.skipIf(!habilitado)("H-008 · Server Actions de /admin con sesión real por actor", () => {
  it("matriz acción × actor", async () => {
    sql(readFileSync("supabase/seed_admin_acciones.sql", "utf8")); // repone el estado inicial de los objetos que consumen las acciones
    const R = "11111111-1111-4111-8111-111111111111"; // UUID v4 válido que no existe
    const NEG = (x: string) => `00000000-0000-0000-0006-0000000005${x}`; // negocios sembrados en el estado que exige cada acción
    const N = "00000000-0000-0000-0006-0000000001b0";
    const U = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // cuenta víctima (seed_admin_acciones.sql)
    const id = (tabla: string, col = "id") => uno(`select ${col} from public.${tabla} limit 1`, R);
    const ids = {
      resena: R,
      ticket: id("ticket_soporte"),
      banner: id("banner_home"),
      fraude: id("lealtad_fraude_evento"),
      reembolso: R,
      aiAccion: uno("select accion from public.ai_accion_costo limit 1", "x"),
      aiModelo: uno("select nombre from public.ai_modelo_config limit 1", "x"),
      aiPaquete: id("ai_paquete_creditos"),
      waPaquete: uno("select id from public.whatsapp_paquete limit 1", R),
    };

    const ahora = new Date(Date.now() + 40 * 86400_000).toISOString();
    const M = "motivo de prueba local";
    type Caso = { modulo: string; fn: string; tipo: "lectura" | "escritura"; args: unknown[] };
    const c = (modulo: string, fn: string, tipo: Caso["tipo"], ...args: unknown[]): Caso => ({ modulo, fn, tipo, args });

    const casos: Caso[] = [
      c("@/app/admin/actions", "obtenerResumenAdmin", "lectura"),
      c("@/app/admin/actions", "listarNegocios", "lectura"),
      c("@/app/admin/actions", "listarResenasReportadas", "lectura"),
      c("@/app/admin/actions", "aprobarNegocio", "escritura", NEG("a1")),
      c("@/app/admin/actions", "rechazarNegocio", "escritura", NEG("a2"), M),
      c("@/app/admin/actions", "suspenderNegocio", "escritura", NEG("b1"), M, "INFRACCION"),
      c("@/app/admin/actions", "marcarNegocioEnMora", "escritura", NEG("b2"), M),
      c("@/app/admin/actions", "forzarReactivacionPagoExterno", "escritura", NEG("c1"), M),
      c("@/app/admin/actions", "reactivarNegocio", "escritura", NEG("c2")),
      c("@/app/admin/actions", "cancelarNegocio", "escritura", NEG("b3"), M),
      c("@/app/admin/actions", "activarPlanManual", "escritura", { negocioId: NEG("b4"), estado: "ACTIVA", plan: "STUDIO", tipo: "CORTESIA", motivo: M, dias: 30, referencia: null }),
      c("@/app/admin/actions", "moderarResena", "escritura", ids.resena, "MANTENER", M),
      c("@/app/admin/ai/actions", "listarAccionesCostoIa", "lectura"),
      c("@/app/admin/ai/actions", "listarModelosIa", "lectura"),
      c("@/app/admin/ai/actions", "listarPaquetesIa", "lectura"),
      c("@/app/admin/ai/actions", "listarFuncionesPlanIa", "lectura"),
      c("@/app/admin/ai/actions", "obtenerResumenConsumoIa", "lectura"),
      c("@/app/admin/ai/actions", "simularConsumoIa", "lectura", "ESSENTIAL", 2, 100),
      c("@/app/admin/ai/actions", "actualizarCostoAccionIa", "escritura", ids.aiAccion, 7, true),
      c("@/app/admin/ai/actions", "actualizarModeloIa", "escritura", ids.aiModelo, 7, true),
      c("@/app/admin/ai/actions", "actualizarPaqueteIa", "escritura", ids.aiPaquete, 7777, true),
      c("@/app/admin/ai/actions", "configurarFuncionPlanIa", "escritura", "ESSENTIAL", "funcion_prueba", true),
      c("@/app/admin/auditoria/actions", "listarAuditoriaAdmin", "lectura", {}),
      c("@/app/admin/auditoria/actions", "listarEntidadesAdmin", "lectura"),
      c("@/app/admin/auditoria/actions", "buscarNegociosAuditoria", "lectura", "barber"),
      c("@/app/admin/barra-actions", "buscarGlobal", "lectura", "barber"),
      c("@/app/admin/configuracion/actions", "obtenerComisionGlobal", "lectura"),
      c("@/app/admin/configuracion/actions", "obtenerTarifasAds", "lectura"),
      c("@/app/admin/configuracion/actions", "obtenerMetricasAdsPlataforma", "lectura"),
      c("@/app/admin/configuracion/actions", "listarCiudades", "lectura"),
      c("@/app/admin/configuracion/actions", "listarBanners", "lectura"),
      c("@/app/admin/configuracion/actions", "listarPlanes", "lectura"),
      c("@/app/admin/configuracion/actions", "listarTextosLegales", "lectura"),
      c("@/app/admin/configuracion/actions", "actualizarTarifasAds", "escritura", { cpcDestacado: 777, cpcPin: 777, cpmPin: 777 }),
      c("@/app/admin/configuracion/actions", "actualizarComisionGlobal", "escritura", 9),
      c("@/app/admin/configuracion/actions", "actualizarCiudad", "escritura", "Cali", false),
      c("@/app/admin/configuracion/actions", "crearBanner", "escritura", { imagenUrl: "https://ejemplo.test/b.png", texto: "banner prueba", urlDestino: "", vigenciaDesde: "", vigenciaHasta: "", orden: 1 }),
      c("@/app/admin/configuracion/actions", "actualizarBanner", "escritura", ids.banner, { activo: false }),
      c("@/app/admin/configuracion/actions", "eliminarBanner", "escritura", ids.banner),
      c("@/app/admin/configuracion/actions", "actualizarPlan", "escritura", { codigo: "ESSENTIAL", precioMensual: 777, limiteSedes: null, staffIncluido: null, staffAddonPrecio: null, sedeAddonPrecio: null, guardianDisponible: true, marketplaceAdsDisponible: true, creditosIaMes: null, conversacionesWhatsappMes: null }),
      c("@/app/admin/configuracion/actions", "publicarTextoLegal", "escritura", "TERMINOS", "contenido de prueba local", false),
      c("@/app/admin/lealtad/actions", "obtenerMetricasLealtad", "lectura"),
      c("@/app/admin/lealtad/actions", "listarEventosFraude", "lectura"),
      c("@/app/admin/lealtad/actions", "marcarFraudeRevisado", "escritura", ids.fraude),
      c("@/app/admin/planes/actions", "obtenerDatosPlanes", "lectura"),
      c("@/app/admin/planes/actions", "guardarAjustesPais", "escritura", { codigo: "CO", activo: true, pasarela: "MERCADOPAGO", cobroRecurrente: false, fundadorDescuentoPct: 31, fundadorCupos: 100, fundadorMeses: 12, impuestoPct: null, precioMasImpuesto: false }, M),
      c("@/app/admin/planes/actions", "guardarPrecioPlan", "escritura", { plan: "STUDIO", pais: "CO", precioMensual: 777, esDesde: false, precioStaffExtra: null, precioSedeExtra: null, activo: true }, M),
      c("@/app/admin/planes/actions", "guardarPrecioAddon", "escritura", "CO", 777, M),
      c("@/app/admin/planes/actions", "guardarCaracteristica", "escritura", { plan: "STUDIO", clave: "clave_prueba", habilitado: true, valor: null }, M),
      c("@/app/admin/reglas/actions", "obtenerReglas", "lectura"),
      c("@/app/admin/reglas/actions", "guardarLimites", "escritura", { totalMin: 24, totalMax: 48, parcialMin: 2, pctMin: 25, pctMax: 55, maxIntentos: 3, motivo: M }),
      c("@/app/admin/reglas/actions", "guardarConfigPrueba", "escritura", { dias: 14, modalidad: "SIN_TARJETA", graciaDias: 3, aviso1: 5, aviso2: 1, motivo: M }),
      c("@/app/admin/reglas/actions", "programarComision", "escritura", { negocioId: null, pct: 5, efectivoDesde: ahora, motivo: M }),
      c("@/app/admin/reglas/actions", "anularComisionProgramada", "escritura", R, M),
      c("@/app/admin/reglas/actions", "guardarComisionDefault", "escritura", 9),
      c("@/app/admin/reglas/actions", "reintentarReembolso", "escritura", ids.reembolso, M),
      c("@/app/admin/soporte/actions", "listarTicketsAdmin", "lectura"),
      c("@/app/admin/soporte/actions", "obtenerHiloTicketAdmin", "lectura", ids.ticket),
      c("@/app/admin/soporte/actions", "responderTicketAdmin", "escritura", ids.ticket, "respuesta de prueba local"),
      c("@/app/admin/soporte/actions", "actualizarEstadoTicket", "escritura", ids.ticket, "RESUELTO"),
      c("@/app/admin/usuarios/actions", "suspenderUsuario", "escritura", U, M),
      c("@/app/admin/usuarios/actions", "cerrarSesionesUsuario", "escritura", U, M),
      c("@/app/admin/usuarios/actions", "reactivarUsuario", "escritura", U, M),
      c("@/app/admin/whatsapp/actions", "obtenerResumenAdminWhatsApp", "lectura"),
      c("@/app/admin/whatsapp/actions", "actualizarConfigWhatsApp", "escritura", { pctMarketingPlan: 12, pctMarketingRecarga: 12, mesesVencimientoRecarga: 12, umbralesAlerta: [80], proveedor: null, motivo: M }),
      c("@/app/admin/whatsapp/actions", "cambiarEstadoConexion", "escritura", { estado: "SUSPENDIDO", motivo: M }),
      c("@/app/admin/whatsapp/actions", "crearPaqueteWhatsApp", "escritura", { codigo: "PRUEBA_LOCAL_X1", nombre: "Paquete prueba", conversaciones: 100, precio: 1000, moneda: "COP", motivo: M }),
      c("@/app/admin/whatsapp/actions", "versionarPaqueteWhatsApp", "escritura", { paqueteId: ids.waPaquete, nombre: "Paquete v2", conversaciones: 100, precio: 1000, motivo: M }),
      c("@/app/admin/whatsapp/actions", "alternarPaqueteWhatsApp", "escritura", { paqueteId: ids.waPaquete, activo: false, motivo: M }),
    ];

    admin = createClient(API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    const clientes: Record<string, SupabaseClient> = {};
    for (const a of ACTORES) {
      const cl = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      if (a !== "anonimo") {
        const { error } = await cl.auth.signInWithPassword({ email: `${a}@pruebas.test`, password: PW });
        if (error) throw new Error(`no se pudo iniciar sesión como ${a}: ${error.message}`);
      }
      clientes[a] = cl;
    }

    const modulos: Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>> = {};
    for (const m of new Set(casos.map((k) => k.modulo))) modulos[m] = await import(/* @vite-ignore */ m);

    const salida: unknown[] = [];
    const resumen: Record<string, { llamadas: number; escrituras_ok: number; lecturas_con_datos: number; tablas_cambiadas: string[] }> = {};
    for (const actor of ACTORES) {
      actual = clientes[actor];
      const antes = huella();
      let escriturasOk = 0;
      let lecturasConDatos = 0;
      for (const caso of casos) {
        let res: unknown;
        let lanzo = "";
        try {
          res = await modulos[caso.modulo][caso.fn](...caso.args);
        } catch (e) {
          lanzo = e instanceof Error ? (e as Error & { digest?: string }).digest ?? e.message : String(e);
        }
        const r = res as { ok?: boolean; data?: unknown; error?: string } | null | undefined;
        const ok = r === null || r === undefined ? false : typeof r.ok === "boolean" ? r.ok : true; // buscarGlobal devuelve el objeto
        const datos = Array.isArray(r?.data) ? r.data.length : r?.data && typeof r.data === "object" ? Object.keys(r.data).length : r && r.ok === undefined ? Object.values(r as object).flat().length : r?.data ? 1 : 0;
        if (caso.tipo === "escritura" && ok) escriturasOk++;
        if (caso.tipo === "lectura" && ok && datos > 0) lecturasConDatos++;
        salida.push({ actor, modulo: caso.modulo.replace("@/app/admin/", ""), fn: caso.fn, tipo: caso.tipo, ok, datos, lanzo: lanzo || undefined, error: r?.error?.slice(0, 120) });
      }
      const despues = huella();
      resumen[actor] = { llamadas: casos.length, escrituras_ok: escriturasOk, lecturas_con_datos: lecturasConDatos, tablas_cambiadas: diferencias(antes, despues) };
    }

    mkdirSync("docs/plan_cierre/evidencias_1a", { recursive: true });
    writeFileSync(`docs/plan_cierre/evidencias_1a/admin_actions_${ETIQUETA}.json`, JSON.stringify({ resumen, detalle: salida }, null, 1));
    console.info("RESUMEN", JSON.stringify(resumen, null, 1));

    // El CONTROL debe funcionar: el Super Admin tiene que poder leer y escribir (si no, las llamadas no son válidas).
    expect(resumen.super.lecturas_con_datos).toBeGreaterThan(10);
    expect(resumen.super.escrituras_ok).toBeGreaterThan(15);
    // Ningún actor que no sea Super Admin: escrituras con ok, lecturas con datos ni cambios en la base.
    for (const a of ACTORES.filter((x) => x !== "super")) {
      expect(resumen[a].escrituras_ok, `${a}: escrituras con ok:true`).toBe(0);
      expect(resumen[a].lecturas_con_datos, `${a}: lecturas con datos`).toBe(0);
      expect(resumen[a].tablas_cambiadas, `${a}: tablas cambiadas`).toEqual([]);
    }
  }, 600_000);
});


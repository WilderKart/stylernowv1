/**
 * Fase 1B · Server Actions FUERA de /admin: ¿una persona ajena al negocio B puede leer o alterar algo de B?
 *
 * Importa el código REAL de cada Server Action exportada (inventario: scripts/inventario-server-actions.mjs) y la invoca con la
 * sesión REAL (JWT de GoTrue local) de cada actor, apuntando los argumentos a los recursos del NEGOCIO B (ids sembrados).
 * Mide por llamada:
 *   · fuga de lectura: el resultado devuelto contiene identificadores/nombres del negocio B,
 *   · escritura cruzada: cambió la huella del contenido del negocio B (todas las tablas con negocio_id = B, perfiles/usuarios de B).
 * Actores NO autorizados sobre B: anónimo, intruso, cliente A, profesional A1, guardián A, dueño A.
 * Actores de B y super: se ejecutan DESPUÉS (modifican B) y sirven de CONTROL — si no consiguen ejecutar la acción, la llamada no era válida y
 * el resultado de los ajenos NO prueba nada para esa acción (queda «inconcluso»).
 *
 * Solo corre con PRUEBAS_LOCALES_FASE1B=1 y API = http://127.0.0.1:55321. fetch hacia hosts no locales se BLOQUEA (sin pagos, mensajes ni correos).
 * Salida: docs/plan_cierre/evidencias_1b/server_actions_<etiqueta>.json
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, it, vi } from "vitest";

const API = process.env.API_URL ?? "";
const ANON = process.env.ANON_KEY ?? "";
const SERVICE = process.env.SERVICE_ROLE_KEY ?? "";
const PW = process.env.PW_PRUEBAS ?? "";
const ETIQUETA = process.env.ETIQUETA ?? "ejecucion";
const SOLO = process.env.SOLO_ARCHIVO ?? ""; // filtro opcional por ruta
const habilitado = process.env.PRUEBAS_LOCALES_FASE1B === "1" && API === "http://127.0.0.1:55321" && ANON && SERVICE && PW;

let actual: SupabaseClient;
let admin: SupabaseClient;
const bloqueados: string[] = [];
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/headers", () => {
  const jar = { get: () => undefined, getAll: () => [], has: () => false, set: () => {}, delete: () => {} };
  const h = { get: () => null, has: () => false, entries: () => [][Symbol.iterator](), forEach: () => {} };
  return { cookies: async () => jar, headers: async () => h };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => actual }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));

const sql = (q: string) =>
  execSync("docker exec -i supabase_db_stylernow-cierre psql -U postgres -d postgres -At -v ON_ERROR_STOP=1", { input: q, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const uno = (q: string, defecto: string) => {
  try {
    return sql(q).split("\n")[0] || defecto;
  } catch {
    return defecto;
  }
};

const NEG_B = "00000000-0000-0000-0006-0000000001b0";
const ID_B = [NEG_B, "00000000-0000-0000-0006-0000000002b0", "00000000-0000-0000-0006-0000000000b1", "00000000-0000-0000-0006-0000000000b2", "00000000-0000-0000-0006-0000000000b3", "00000000-0000-0000-0006-0000000000b4"];
const MARCA_B = /0006-0{0,10}[0-9a-f]{0,3}b[0-9a-f]\b|Barber[ií]a B\b|Profesional B1|Cliente B\b|Due[ñn]o B\b|Guardi[aá]n B\b|prueba-barberia-b/i;

/** Huella del contenido del negocio B: una línea por tabla con negocio_id (filas de B) + perfiles/usuarios/staff de B. */
let consultaHuella = "";
function huellaB(): Record<string, string> {
  if (!consultaHuella) {
    const tablas = sql(`select string_agg(table_name, ',') from information_schema.columns c where table_schema='public' and column_name='negocio_id'
      and exists (select 1 from information_schema.tables t where t.table_schema='public' and t.table_name=c.table_name and t.table_type='BASE TABLE') and table_name <> '_sembrado'`).split(",");
    consultaHuella =
      tablas.map((t) => `select '${t}' k, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) h from public.${t} x where negocio_id = '${NEG_B}'`).join(" union all ") +
      ` union all select 'perfil_B', md5(coalesce(string_agg(x::text,'|' order by x::text),'')) from public.perfil x where id in (${ID_B.map((i) => `'${i}'`).join(",")})` +
      ` union all select 'staff_B', md5(coalesce(string_agg(x::text,'|' order by x::text),'')) from public.staff x where usuario_id in (${ID_B.map((i) => `'${i}'`).join(",")})` +
      ` union all select 'auth_users_B', md5(coalesce(string_agg(x::text,'|' order by x::text),'')) from auth.users x where id in (${ID_B.map((i) => `'${i}'`).join(",")})` +
      ` union all select 'reserva_B', md5(coalesce(string_agg(x::text,'|' order by x::text),'')) from public.reserva x where negocio_id = '${NEG_B}'` +
      ` union all select 'negocio_B', md5(x::text) from public.negocio x where id = '${NEG_B}'`;
  }
  return Object.fromEntries(sql(consultaHuella).split("\n").map((l) => l.split("|") as [string, string]));
}
const dif = (a: Record<string, string>, b: Record<string, string>) => Object.keys(b).filter((k) => a[k] !== b[k]);

type Inv = { archivo: string; accion: string; params: { nombre: string; tipo: string; opcional: boolean }[]; rpcs: string[]; escritas: string[]; leidas: string[] };
type Ctx = Record<string, string>;

/** Argumento de una acción según el nombre/tipo del parámetro: siempre apunta a recursos del negocio B. */
function argumento(p: Inv["params"][number], ctx: Ctx, archivo: string): unknown {
  const n = p.nombre.toLowerCase();
  const t = p.tipo;
  const idPorNombre: [RegExp, string][] = [
    [/^(negocioid|negocio_id|idnegocio)$/, NEG_B],
    [/^(sedeid|sede_id)$/, ctx.sede],
    [/^(reservaid|reserva_id)$/, ctx.reserva],
    [/^(clienteid|cliente_id|titularid)$/, ctx.clienteB],
    [/^(staffid|usuarioid|profesionalid|userid|barberoid)$/, ctx.staffB],
    [/^(vinculoid|vinculo_id)$/, ctx.vinculo],
    [/^(servicioid|servicio_id)$/, ctx.servicio],
    [/^(productoid|producto_id)$/, ctx.producto],
    [/^(planid|planmembresiaid)$/, ctx.planMembresia],
    [/^(campanaid|campana_id)$/, ctx.campana],
    [/^(ticketid)$/, ctx.ticket],
    [/^(sugerenciaid)$/, ctx.sugerencia],
    [/^(promptid)$/, ctx.prompt],
    [/^(memoriaid)$/, ctx.memoria],
    [/^(invitacionid)$/, ctx.invitacion],
    [/^(pagoid)$/, ctx.pago],
    [/^(facturaid|ventaid)$/, ctx.venta],
    [/^(slug)$/, "prueba-barberia-b"],
  ];
  for (const [re, v] of idPorNombre) if (re.test(n)) return v ?? "11111111-1111-4111-8111-111111111111";
  if (/^id$|id$/.test(n)) {
    const porArchivo: [RegExp, string][] = [
      [/servicios/, ctx.servicio], [/inventario/, ctx.producto], [/staff/, ctx.vinculo], [/sedes/, ctx.sede], [/agenda|reserva|pos/, ctx.reserva],
      [/crm/, ctx.clienteB], [/soporte|ayuda/, ctx.ticket], [/ads/, ctx.campana], [/lealtad/, ctx.planMembresia], [/membresia/, ctx.planMembresia],
    ];
    for (const [re, v] of porArchivo) if (re.test(archivo) && v) return v;
    return NEG_B;
  }
  if (/fecha|date|desde|hasta/.test(n)) return new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
  if (/email|correo/.test(n)) return "ajeno@pruebas.test";
  if (/telefono|celular/.test(n)) return "+573001112233";
  if (/^(motivo|nota|mensaje|comentario|texto|descripcion|nombre|titulo|asunto)$/.test(n)) return "texto de prueba fase 1b";
  if (/boolean/.test(t)) return true;
  if (/number/.test(t)) return 1;
  const lit = t.match(/^["']([^"']+)["']/);
  if (lit) return lit[1];
  if (/\[\]/.test(t)) return [];
  if (/string/.test(t)) return "x";
  // objeto/interfaz: bolsa con todas las claves habituales apuntando a B
  return {
    negocioId: NEG_B, sedeId: ctx.sede, reservaId: ctx.reserva, clienteId: ctx.clienteB, staffId: ctx.staffB, servicioId: ctx.servicio, id: ctx.servicio,
    nombre: "prueba fase 1b", descripcion: "prueba", precio: 1000, duracionMin: 30, cantidad: 1, monto: 1000, activo: true, motivo: "prueba fase 1b", mensaje: "prueba",
    email: "ajeno@pruebas.test", telefono: "+573001112233", rol: "PROFESIONAL", porcentaje: 10, pct: 10,
  };
}

const ACTORES_AJENOS = ["anonimo", "intruso", "cliente-a", "pro-a1", "guardian-a", "dueno-a"] as const;
const ACTORES_B = ["cliente-b", "pro-b1", "guardian-b", "dueno-b", "super"] as const;
const TODOS = [...ACTORES_AJENOS, ...ACTORES_B];

describe.skipIf(!habilitado)("Fase 1B · Server Actions fuera de /admin con sesión real por actor", () => {
  it("matriz acción × actor sobre el negocio B", async () => {
    const globalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
        bloqueados.push(url.slice(0, 80));
        throw new Error("RED_EXTERNA_BLOQUEADA_EN_PRUEBA");
      }
      return globalFetch(input as RequestInfo, init);
    }) as typeof fetch;

    const inv: Inv[] = JSON.parse(readFileSync("docs/plan_cierre/evidencias_1b/inventario_server_actions.json", "utf8")).filter(
      (a: Inv) => !SOLO || a.archivo.includes(SOLO)
    );
    const ctx: Ctx = {
      sede: "00000000-0000-0000-0006-0000000002b0",
      reserva: uno(`select id from public.reserva where negocio_id='${NEG_B}' order by created_at limit 1`, "11111111-1111-4111-8111-111111111111"),
      clienteB: "00000000-0000-0000-0006-0000000000b3",
      staffB: "00000000-0000-0000-0006-0000000000b2",
      vinculo: uno(`select id from public.vinculo_staff_negocio where negocio_id='${NEG_B}' order by created_at limit 1`, "11111111-1111-4111-8111-111111111111"),
      servicio: uno(`select id from public.servicio where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      producto: uno(`select id from public.producto where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      planMembresia: uno(`select id from public.membresia_plan where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      campana: uno(`select id from public.campana_publicitaria where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      ticket: uno(`select id from public.ticket_soporte where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      sugerencia: uno(`select id from public.recompensa_sugerencia where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      prompt: uno(`select id from public.ai_prompt where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      memoria: uno(`select id from public.ai_memoria_negocio where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      invitacion: uno(`select id from public.invitacion where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      pago: uno(`select id from public.pago where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
      venta: uno(`select id from public.venta_producto where negocio_id='${NEG_B}' limit 1`, "11111111-1111-4111-8111-111111111111"),
    };

    admin = createClient(API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    const clientes: Record<string, SupabaseClient> = {};
    for (const a of TODOS) {
      const cl = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      if (a !== "anonimo") {
        const { error } = await cl.auth.signInWithPassword({ email: `${a}@pruebas.test`, password: PW });
        if (error) throw new Error(`no se pudo iniciar sesión como ${a}: ${error.message}`);
      }
      clientes[a] = cl;
    }

    const modulos: Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>> = {};
    const fallosImport: Record<string, string> = {};
    for (const a of inv) {
      if (modulos[a.archivo] || fallosImport[a.archivo]) continue;
      try {
        modulos[a.archivo] = await import(/* @vite-ignore */ "@/" + a.archivo.replace(/^src\//, "").replace(/\.(ts|tsx)$/, ""));
      } catch (e) {
        fallosImport[a.archivo] = e instanceof Error ? e.message.slice(0, 160) : String(e);
      }
    }

    // Acciones que NO se invocan: cierran sesión, crean cuentas/códigos reales o disparan pasarelas (se analizan solo en estático).
    const OMITIR = /^(iniciarSesionConGoogle|iniciarSesionConContrasena|enviarCodigo|verificarCodigo|solicitarRecuperacion|crearCuentaRegistro|cerrarSesion)$/;

    const salida: unknown[] = [];
    for (const actor of TODOS) {
      actual = clientes[actor];
      for (const a of inv) {
        const modulo = modulos[a.archivo];
        const base = { actor, archivo: a.archivo.replace("src/", ""), accion: a.accion };
        if (!modulo || typeof modulo[a.accion] !== "function") {
          salida.push({ ...base, estado: "NO_IMPORTABLE", detalle: fallosImport[a.archivo] });
          continue;
        }
        if (OMITIR.test(a.accion)) {
          salida.push({ ...base, estado: "OMITIDA" });
          continue;
        }
        const args = a.params.map((p) => argumento(p, ctx, a.archivo));
        const antes = huellaB();
        let res: unknown;
        let lanzo = "";
        try {
          res = await Promise.race([modulo[a.accion](...args), new Promise((_, rej) => setTimeout(() => rej(new Error("TIEMPO_AGOTADO")), 20000))]);
        } catch (e) {
          lanzo = e instanceof Error ? (e as Error & { digest?: string }).digest ?? e.message : String(e);
        }
        const despues = huellaB();
        let texto = "";
        try {
          texto = JSON.stringify(res ?? null) ?? "";
        } catch {
          texto = "";
        }
        const r = res as { ok?: boolean; error?: string; mensaje?: string; data?: unknown } | null | undefined;
        const ok = r == null ? false : typeof r.ok === "boolean" ? r.ok : true;
        salida.push({
          ...base,
          estado: "EJECUTADA",
          ok,
          lanzo: lanzo.slice(0, 100) || undefined,
          error: (r?.error ?? r?.mensaje ?? "").toString().slice(0, 110) || undefined,
          fugaB: ok && MARCA_B.test(texto),
          bytes: texto.length,
          escrituraB: dif(antes, despues),
        });
      }
    }

    mkdirSync("docs/plan_cierre/evidencias_1b", { recursive: true });
    writeFileSync(`docs/plan_cierre/evidencias_1b/server_actions_${ETIQUETA}.json`, JSON.stringify({ bloqueados: [...new Set(bloqueados)], fallosImport, detalle: salida }, null, 1));
    globalThis.fetch = globalFetch;
  }, 3_000_000);
});

import { requireSuperSU } from "@/lib/auth/require-supersu";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CircleAlert, CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { EncabezadoAdmin } from "../_componentes/encabezado-admin";
import { rpcAdmin } from "../_componentes/rpc";
import { Caja, TituloCaja } from "../_componentes/ui-admin";
import { ProbarAlertas } from "./probar-alertas";
import { entornoPagos } from "@/lib/pagos/entorno";

export const dynamic = "force-dynamic";

type EstadoBase = {
  notificaciones: { pendientes: number; fallidas_24h: number; enviadas_24h: number; ultimo_envio: string | null; ultimo_error: string | null };
  webhooks: { recibidos_24h: number; errores_24h: number; sin_procesar: number; ultimo: string | null };
  pagos: { pendientes_viejos: number; huerfanos: number };
  auditoria: { ultimo: string | null; eventos_24h: number };
  base: { tamano: string; hora: string };
};

type Nivel = "ok" | "alerta" | "falla";
type Chequeo = { nombre: string; nivel: Nivel; detalle: string; ms?: number };

async function medir<T>(fn: () => Promise<T>): Promise<{ ms: number; valor?: T; error?: unknown }> {
  const t = performance.now();
  try {
    const valor = await fn();
    return { ms: Math.round(performance.now() - t), valor };
  } catch (error) {
    return { ms: Math.round(performance.now() - t), error };
  }
}

const hace = (iso: string | null) => {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
};
const hay = (...nombres: string[]) => nombres.every((n) => !!process.env[n]?.trim());
const faltan = (...nombres: string[]) => nombres.filter((n) => !process.env[n]?.trim());

/**
 * Modo real de Mercado Pago, sin mostrar ningún valor secreto: entorno que decide el servidor, tipo de credencial (solo el
 * prefijo) y, preguntándole a Mercado Pago de quién es el token, si la cuenta es de prueba o real.
 */
async function modoMercadoPago(): Promise<{ nivel: Nivel; detalle: string }> {
  let entorno: string;
  try {
    entorno = entornoPagos();
  } catch (e) {
    return { nivel: "falla", detalle: e instanceof Error ? e.message : "Entorno inválido" };
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
  const clave = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ?? "";
  const tipo = (v: string) => (v.startsWith("TEST-") ? "TEST-" : v.startsWith("APP_USR-") ? "APP_USR-" : v ? "otro" : "falta");
  let cuenta = "no se pudo consultar";
  let esPrueba: boolean | null = null;
  if (token) {
    try {
      const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const u = (await r.json()) as { nickname?: string; site_id?: string; tags?: string[] };
        esPrueba = /^TEST/i.test(u.nickname ?? "") || (u.tags ?? []).includes("test_user");
        cuenta = `${esPrueba ? "cuenta de PRUEBA" : "cuenta REAL"} (${u.site_id ?? "?"})`;
      } else {
        cuenta = `Mercado Pago respondió ${r.status} al validar el token`;
      }
    } catch {
      cuenta = "sin respuesta de Mercado Pago";
    }
  }
  const coherente = entorno === "SANDBOX" ? esPrueba !== false : esPrueba !== true;
  return {
    nivel: !token ? "falla" : coherente ? "ok" : "falla",
    detalle: `Entorno del servidor: ${entorno} · token ${tipo(token)} · clave pública ${tipo(clave)} · ${cuenta}${coherente ? "" : " · NO COINCIDEN: los pagos se rechazarán"}`,
  };
}

/**
 * Estado del sistema con comprobaciones en vivo (cada carga mide de verdad) y lo que registra la base.
 * Solo dice si cada variable de entorno EXISTE; nunca muestra su valor.
 */
export default async function AdminSistemaPage() {
  await requireSuperSU();
  const supabase = await createClient();

  const [db, auth, storage, modoMp] = await Promise.all([
    medir(() => rpcAdmin<EstadoBase>("admin_estado_sistema")),
    medir(() => supabase.auth.getUser()),
    medir(() => createAdminClient().storage.from("negocio-media").list("", { limit: 1 })),
    modoMercadoPago(),
  ]);

  const base = db.valor && db.valor.ok ? db.valor.data : null;
  const nivelMs = (ms: number): Nivel => (ms > 1500 ? "alerta" : "ok");
  const faltanMp = faltan("MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET", "MERCADOPAGO_CLIENT_ID", "MERCADOPAGO_CLIENT_SECRET");

  const chequeos: Chequeo[] = [
    {
      nombre: "Base de datos",
      nivel: base ? nivelMs(db.ms) : "falla",
      detalle: base ? `Responde · ${base.base.tamano} usados` : "No respondió",
      ms: db.ms,
    },
    {
      nombre: "Autenticación",
      nivel: auth.valor && !auth.valor.error ? nivelMs(auth.ms) : "falla",
      detalle: auth.valor && !auth.valor.error ? "Sesiones verificadas por el servidor de Auth" : "No respondió",
      ms: auth.ms,
    },
    {
      nombre: "Almacenamiento de imágenes",
      nivel: storage.valor && !storage.valor.error ? nivelMs(storage.ms) : "falla",
      detalle: storage.valor && !storage.valor.error ? "Bucket negocio-media accesible" : "No respondió",
      ms: storage.ms,
    },
    {
      nombre: "Correos (Resend)",
      nivel: !hay("RESEND_API_KEY") ? "falla" : base && base.notificaciones.fallidas_24h > 0 ? "alerta" : "ok",
      detalle: !hay("RESEND_API_KEY")
        ? "Falta RESEND_API_KEY"
        : base
          ? `${base.notificaciones.enviadas_24h} enviados y ${base.notificaciones.fallidas_24h} fallidos en 24 h · ${base.notificaciones.pendientes} en cola · último envío ${hace(base.notificaciones.ultimo_envio)}`
          : "Configurado",
    },
    {
      nombre: "Pagos (Mercado Pago)",
      nivel: faltanMp.length > 0
        ? "falla"
        : base && (base.webhooks.errores_24h > 0 || base.webhooks.sin_procesar > 0 || base.pagos.pendientes_viejos > 0)
          ? "alerta"
          : "ok",
      detalle: faltanMp.length > 0
        ? `Faltan en Vercel: ${faltanMp.join(", ")}${faltanMp.some((n) => n.includes("CLIENT")) ? " (sin ellas las barberías no pueden conectar su cuenta de Mercado Pago)" : ""}${faltanMp.includes("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY") ? " (sin la clave pública el pago no se abre en el modal y se continúa en Mercado Pago)" : ""}`
        : base
          ? `${base.webhooks.recibidos_24h} avisos recibidos en 24 h (${base.webhooks.errores_24h} con error, ${base.webhooks.sin_procesar} sin procesar) · último ${hace(base.webhooks.ultimo)} · ${base.pagos.pendientes_viejos} pagos pendientes de más de 1 h`
          : "Configurado",
    },
    { nombre: "Modo de Mercado Pago (prueba o real)", nivel: modoMp.nivel, detalle: modoMp.detalle },
    {
      nombre: "Monitoreo de errores (Sentry)",
      nivel: hay("NEXT_PUBLIC_SENTRY_DSN") ? "ok" : "alerta",
      detalle: hay("NEXT_PUBLIC_SENTRY_DSN") ? "Configurado" : "Sin NEXT_PUBLIC_SENTRY_DSN: los errores no se reportan",
    },
    {
      nombre: "Tareas programadas (cron diario)",
      nivel: hay("CRON_SECRET") ? "ok" : "falla",
      detalle: hay("CRON_SECRET") ? "Protegidas con CRON_SECRET · corre todos los días a las 3:00 a. m. (Colombia)" : "Falta CRON_SECRET",
    },
    {
      nombre: "Prueba gratuita (antiabuso)",
      nivel: hay("PRUEBA_HASH_PEPPER") ? "ok" : "alerta",
      detalle: hay("PRUEBA_HASH_PEPPER") ? "Huellas protegidas con clave propia" : "Usa la clave de Supabase como respaldo; conviene definir PRUEBA_HASH_PEPPER",
    },
    {
      nombre: "Auditoría",
      nivel: base ? "ok" : "falla",
      detalle: base ? `${base.auditoria.eventos_24h} eventos en 24 h · último ${hace(base.auditoria.ultimo)}` : "Sin datos",
    },
  ];

  const fallas = chequeos.filter((c) => c.nivel === "falla").length;
  const alertas = chequeos.filter((c) => c.nivel === "alerta").length;
  const general: Nivel = fallas > 0 ? "falla" : alertas > 0 ? "alerta" : "ok";
  const ICONO = { ok: CircleCheck, alerta: CircleAlert, falla: CircleX } as const;
  const COLOR = { ok: "text-success", alerta: "text-warning", falla: "text-danger" } as const;
  const IconoGeneral = ICONO[general];

  return (
    <main className="w-full min-w-0 max-w-5xl flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Estado del sistema"
        titulo="Salud de la"
        resaltado="plataforma."
        descripcion="Comprobaciones en vivo: cada vez que abres o recargas esta página se mide de verdad. Las credenciales solo se revisan por existencia; nunca se muestran."
        acciones={
          <a href="/admin/sistema" className="inline-flex min-h-11 items-center gap-2 border-2 border-border px-3.5 font-mono text-[11.5px] font-bold uppercase text-text hover:bg-text hover:text-bg">
            <RefreshCw className="size-4" aria-hidden /> Volver a medir
          </a>
        }
      />

      <Caja destacada className="mb-4">
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <IconoGeneral className={`size-8 shrink-0 ${COLOR[general]}`} aria-hidden />
          <div>
            <p className="font-display text-[20px] font-black uppercase text-text">
              {general === "ok" ? "Todo operativo" : general === "alerta" ? "Operativo con avisos" : "Hay servicios con falla"}
            </p>
            <p className="text-[12.5px] text-text-muted">
              {chequeos.length - fallas - alertas} en orden · {alertas} con aviso · {fallas} con falla
            </p>
          </div>
        </div>
      </Caja>

      <ProbarAlertas />

      <Caja>
        <TituloCaja>Servicios</TituloCaja>
        <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
          {chequeos.map((c) => {
            const Icono = ICONO[c.nivel];
            return (
              <li key={c.nombre} className="flex items-start gap-3 py-3.5">
                <Icono className={`mt-0.5 size-5 shrink-0 ${COLOR[c.nivel]}`} aria-label={c.nivel === "ok" ? "En orden" : c.nivel === "alerta" ? "Aviso" : "Falla"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-text">{c.nombre}</span>
                  <span className="block text-[12.5px] text-text-muted">{c.detalle}</span>
                </span>
                {c.ms !== undefined && <span className="shrink-0 font-mono text-[12px] text-text-faint">{c.ms} ms</span>}
              </li>
            );
          })}
        </ul>
      </Caja>

      {base?.notificaciones.ultimo_error && (
        <p className="mt-4 border-2 border-warning px-4 py-3 text-[12.5px] text-text">
          <span className="font-bold">Último error de envío de correos:</span> {base.notificaciones.ultimo_error}
        </p>
      )}
    </main>
  );
}

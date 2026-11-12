import { Pantalla, Top, ErrorAviso, diaYMes } from "@/app/lealtad/ui-cliente";
import { EmptyState, Status } from "@/components/brutal";
import { listarPagos, obtenerSaldo, type MovimientoPago } from "@/lib/cliente/mylook-pagos";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonDevolucion } from "./boton-devolucion";
import { obtenerT } from "@/lib/i18n/servidor";
import type { Traductor } from "@/lib/i18n/diccionario";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("pg.meta"), robots: { index: false, follow: false } };
}

const TZ = "America/Bogota";
const FILTROS = [
  { id: "TODO", etiqueta: "pg.f_todo" },
  { id: "PAGOS", etiqueta: "pg.f_pagos" },
  { id: "SALDO", etiqueta: "pg.f_saldo" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

const CONCEPTOS = {
  ANTICIPO: "pg.c_anticipo",
  SALDO_EN_SILLA: "pg.c_saldo_silla",
  PROPINA: "pg.c_propina",
  REFERIDO: "pg.c_referido",
  CASHBACK: "pg.c_cashback",
  CANJE: "pg.c_canje",
  CANCELACION: "pg.c_cancelacion",
} as const;

const ESTADOS = {
  PAGADO: { tone: "ok", etiqueta: "pg.e_pagado" },
  EN_PROCESO: { tone: "warn", etiqueta: "pg.e_en_proceso" },
  A_SALDO: { tone: "info", etiqueta: "pg.e_a_saldo" },
  REEMBOLSADO: { tone: "info", etiqueta: "pg.e_reembolsado" },
  RECHAZADO: { tone: "err", etiqueta: "pg.e_rechazado" },
  EN_DISPUTA: { tone: "err", etiqueta: "pg.e_en_disputa" },
} as const;

function dinero(valor: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda, maximumFractionDigits: moneda === "COP" ? 0 : 2 }).format(valor);
  } catch {
    return `${valor} ${moneda}`;
  }
}

function concepto(m: MovimientoPago, t: Traductor) {
  const clave = CONCEPTOS[m.concepto as keyof typeof CONCEPTOS];
  const c = clave ? t(clave) : m.concepto.charAt(0) + m.concepto.slice(1).toLowerCase().replace(/_/g, " ");
  return m.negocio_nombre ? `${c} · ${m.negocio_nombre}` : c;
}

export default async function PagosPage(props: PageProps<"/pagos">) {
  const t = await obtenerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pagos");

  const sp = await props.searchParams;
  const filtro: Filtro = FILTROS.some((f) => f.id === sp.f) ? (sp.f as Filtro) : "TODO";

  const [saldoRes, pagosRes] = await Promise.all([obtenerSaldo(), listarPagos(filtro)]);
  const moneda = saldoRes.ok ? saldoRes.data.moneda : "COP";
  const saldo = saldoRes.ok ? Number(saldoRes.data.saldo) : 0;
  const pendiente = saldoRes.ok ? saldoRes.data.devolucion_pendiente : null;

  return (
    <Pantalla className="pb-10">
      <Top titulo={t("pg.top")} volverA="/perfil" />

      <h1 className="poster-2 break-words p-4">
        {t("pg.t1")} <span className="sn-hot">{t("pg.t2")}</span>
      </h1>

      <section aria-label={t("pg.saldo_aria")} className="mx-4 border-2 border-line shadow-[var(--sn-shadow-hard)]">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="sn-num">{t("pg.sec_saldo")}</span>
            <span className="sn-label">{moneda}</span>
          </div>
          {saldoRes.ok ? (
            <div className="sn-fig mt-2 break-words text-4xl">{dinero(saldo, moneda)}</div>
          ) : (
            <div className="mt-2">
              <ErrorAviso>{saldoRes.error}</ErrorAviso>
            </div>
          )}
          <p className="body-sm mt-2 break-words">
            {t("pg.usalo")}
          </p>
          {pendiente != null ? (
            <p role="status" className="sn-meta mt-2 break-words">
              {t("pg.devolucion_proceso", { monto: dinero(Number(pendiente), moneda) })}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 border-t-2 border-line p-3 min-[360px]:grid-cols-2">
          <Link href="/" className="sn-btn sn-btn--primary no-underline">
            <span>{t("pg.usar")}</span>
            <span aria-hidden>↗</span>
          </Link>
          <BotonDevolucion deshabilitado={!saldoRes.ok || saldo <= 0 || pendiente != null} montoTexto={dinero(saldo, moneda)} />
        </div>
      </section>

      <div className="p-sec">
        <h2 className="sn-num">{t("pg.sec_historial")}</h2>
      </div>
      <nav aria-label={t("pg.filtrar")} className="p-chips">
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "TODO" ? "/pagos" : `/pagos?f=${f.id}`}
            aria-current={f.id === filtro ? "page" : undefined}
            className={`sn-chip no-underline ${f.id === filtro ? "is-selected" : ""}`}
          >
            {t(f.etiqueta)}
          </Link>
        ))}
      </nav>

      {!pagosRes.ok ? (
        <div className="px-4">
          <ErrorAviso>{pagosRes.error}</ErrorAviso>
        </div>
      ) : pagosRes.data.length === 0 ? (
        <div className="px-4">
          <EmptyState big={t("pg.sin_mov")} title={t("pg.sin_mov_titulo")} hint={t("pg.sin_mov_hint")} />
        </div>
      ) : (
        <div className="border-t-2 border-border">
          {pagosRes.data.map((m, i) => {
            const conocido = ESTADOS[m.estado as keyof typeof ESTADOS];
            const e = conocido ? { tone: conocido.tone, etiqueta: t(conocido.etiqueta) } : { tone: "info" as const, etiqueta: m.estado.replace(/_/g, " ").toLowerCase() };
            const { dia, mes } = diaYMes(m.fecha, TZ);
            const positivo = m.monto > 0;
            return (
              <div key={`${m.referencia_id}-${i}`} className="p-row">
                <span className="sn-label w-14 shrink-0">
                  {Number(dia)} {mes.toUpperCase()}
                </span>
                <span className="p-row__t">
                  <b className="break-words">{concepto(m, t)}</b>
                  <span>
                    <Status tone={e.tone}>{e.etiqueta}</Status>
                  </span>
                </span>
                <span className={`sn-fig shrink-0 text-sm ${positivo ? "text-signal" : ""}`}>
                  {positivo ? "+ " : "− "}
                  {dinero(Math.abs(Number(m.monto)), moneda)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Pantalla>
  );
}

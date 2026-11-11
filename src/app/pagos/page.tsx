import { Pantalla, Top, ErrorAviso, diaYMes } from "@/app/lealtad/ui-cliente";
import { EmptyState, Status } from "@/components/brutal";
import { listarPagos, obtenerSaldo, type MovimientoPago } from "@/lib/cliente/mylook-pagos";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonDevolucion } from "./boton-devolucion";

export const metadata = { title: "Pagos y saldo", robots: { index: false, follow: false } };

const TZ = "America/Bogota";
const FILTROS = [
  { id: "TODO", etiqueta: "Todo" },
  { id: "PAGOS", etiqueta: "Pagos" },
  { id: "SALDO", etiqueta: "Saldo" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

const CONCEPTOS: Record<string, string> = {
  ANTICIPO: "Anticipo",
  SALDO_EN_SILLA: "Saldo en silla",
  PROPINA: "Propina",
  REFERIDO: "Referido",
  CASHBACK: "Cashback",
  CANJE: "Canje",
  CANCELACION: "Cancelación a tiempo",
};

const ESTADOS: Record<string, { tone: "ok" | "warn" | "err" | "info"; etiqueta: string }> = {
  PAGADO: { tone: "ok", etiqueta: "Pagado" },
  EN_PROCESO: { tone: "warn", etiqueta: "En proceso" },
  A_SALDO: { tone: "info", etiqueta: "A saldo" },
  REEMBOLSADO: { tone: "info", etiqueta: "Reembolsado" },
  RECHAZADO: { tone: "err", etiqueta: "Rechazado" },
  EN_DISPUTA: { tone: "err", etiqueta: "En disputa" },
};

function dinero(valor: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda, maximumFractionDigits: moneda === "COP" ? 0 : 2 }).format(valor);
  } catch {
    return `${valor} ${moneda}`;
  }
}

function concepto(m: MovimientoPago) {
  const c = CONCEPTOS[m.concepto] ?? m.concepto.charAt(0) + m.concepto.slice(1).toLowerCase().replace(/_/g, " ");
  return m.negocio_nombre ? `${c} · ${m.negocio_nombre}` : c;
}

export default async function PagosPage(props: PageProps<"/pagos">) {
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
      <Top titulo="/Perfil/Pagos" volverA="/perfil" />

      <h1 className="poster-2 break-words p-4">
        Pagos y <span className="sn-hot">saldo.</span>
      </h1>

      <section aria-label="Saldo reembolsable" className="mx-4 border-2 border-line shadow-[var(--sn-shadow-hard)]">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="sn-num">01 / Saldo reembolsable</span>
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
            Úsalo en tu próxima reserva o pide la devolución a tu medio de pago.
          </p>
          {pendiente != null ? (
            <p role="status" className="sn-meta mt-2 break-words">
              Devolución en proceso: {dinero(Number(pendiente), moneda)}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 border-t-2 border-line p-3 min-[360px]:grid-cols-2">
          <Link href="/" className="sn-btn sn-btn--primary no-underline">
            <span>Usar</span>
            <span aria-hidden>↗</span>
          </Link>
          <BotonDevolucion deshabilitado={!saldoRes.ok || saldo <= 0 || pendiente != null} montoTexto={dinero(saldo, moneda)} />
        </div>
      </section>

      <div className="p-sec">
        <h2 className="sn-num">02 / Historial</h2>
      </div>
      <nav aria-label="Filtrar historial" className="p-chips">
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "TODO" ? "/pagos" : `/pagos?f=${f.id}`}
            aria-current={f.id === filtro ? "page" : undefined}
            className={`sn-chip no-underline ${f.id === filtro ? "is-selected" : ""}`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </nav>

      {!pagosRes.ok ? (
        <div className="px-4">
          <ErrorAviso>{pagosRes.error}</ErrorAviso>
        </div>
      ) : pagosRes.data.length === 0 ? (
        <div className="px-4">
          <EmptyState big="Sin movimientos" title="Todavía no hay movimientos" hint="Tus anticipos, pagos y saldo a favor aparecerán aquí." />
        </div>
      ) : (
        <div className="border-t-2 border-border">
          {pagosRes.data.map((m, i) => {
            const e = ESTADOS[m.estado] ?? { tone: "info" as const, etiqueta: m.estado.replace(/_/g, " ").toLowerCase() };
            const { dia, mes } = diaYMes(m.fecha, TZ);
            const positivo = m.monto > 0;
            return (
              <div key={`${m.referencia_id}-${i}`} className="p-row">
                <span className="sn-label w-14 shrink-0">
                  {Number(dia)} {mes.toUpperCase()}
                </span>
                <span className="p-row__t">
                  <b className="break-words">{concepto(m)}</b>
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

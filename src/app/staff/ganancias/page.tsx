import { FormAccion } from "@/components/ganancias/form-accion";
import { FiltrosForm, Paginacion, ResumenCards, TablaGanancias } from "@/components/ganancias/vista-ganancias";
import { Badge } from "@/components/ui/card";
import { argumentosListar, leerFiltros } from "@/lib/ganancias/filtros";
import { clienteGanancias, llamar } from "@/lib/ganancias/rpc";
import { ETIQUETA_LIQUIDACION, type Liquidacion, type ListaGanancias, type ResumenGanancias } from "@/lib/ganancias/tipos";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { solicitarRevision } from "./actions";

export const metadata = { title: "Mis ganancias" };

interface Revision { id: string; objeto_tipo: string; motivo: string; estado: string; respuesta: string | null; created_at: string }

/**
 * Ganancias del PROFESIONAL. No recibe ni usa ningún identificador de profesional: la base toma la identidad de la sesión
 * (p_negocio nulo = solo lo propio, en cualquier negocio donde trabaje) y descarta cualquier filtro de otro profesional.
 */
export default async function GananciasStaffPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const filtros = { ...leerFiltros(sp), staff: undefined, sede: undefined };

  const [lista, resumen, liq, supabase] = await Promise.all([
    llamar<ListaGanancias>("ganancias_listar", argumentosListar(filtros, null)),
    llamar<ResumenGanancias>("ganancias_resumen", { p_negocio: null, p_sede: null, p_staff: null, p_desde: filtros.desde ?? null, p_hasta: filtros.hasta ?? null }),
    llamar<Liquidacion[]>("liquidaciones_listar", { p_negocio: null, p_staff: null, p_sede: null, p_limite: 30, p_desplazamiento: 0 }),
    clienteGanancias(),
  ]);
  const { data: revData } = await supabase.from("ganancia_revision").select("id, objeto_tipo, motivo, estado, respuesta, created_at").order("created_at", { ascending: false }).limit(30);
  const revisiones = (revData ?? []) as Revision[];

  const params = {
    desde: filtros.rapido ? undefined : filtros.desde, hasta: filtros.rapido ? undefined : filtros.hasta, rapido: filtros.rapido,
    estado_comision: filtros.estadoComision, estado_cobro: filtros.estadoCobro, estado_liquidacion: filtros.estadoLiquidacion, q: filtros.q,
  };

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 sm:px-8">
      <h1 className="font-display mb-4 text-[22px] font-bold uppercase text-text">Mis ganancias</h1>
      <FiltrosForm accion="/staff/ganancias" valores={filtros} />
      {resumen.ok ? <ResumenCards r={resumen.data} esProfesional /> : <p className="text-danger">{resumen.error}</p>}

      <h2 className="mb-2 mt-6 text-[14px] font-bold uppercase">Mis servicios</h2>
      {lista.ok ? (
        <>
          <TablaGanancias
            filas={lista.data.filas}
            mostrarProfesional={false}
            mostrarParticipacion={false}
            accionFila={(f) => (
              <details>
                <summary className="cursor-pointer text-[12px] font-semibold underline">Pedir revisión</summary>
                <FormAccion accion={solicitarRevision} etiqueta="Enviar solicitud" exito="Solicitud enviada." className="mt-2 grid gap-2">
                  <input type="hidden" name="tipo" value="GANANCIA" />
                  <input type="hidden" name="objeto" value={f.id} />
                  <textarea name="motivo" required minLength={10} maxLength={500} placeholder="¿Qué no cuadra? (mín. 10 caracteres)" className="min-h-16 w-full border-2 border-border bg-bg p-2 text-[13px]" />
                </FormAccion>
              </details>
            )}
          />
          <Paginacion total={Number(lista.data.total)} pagina={filtros.pagina} base="/staff/ganancias" params={params} />
        </>
      ) : (
        <p className="text-danger">{lista.error}</p>
      )}

      <h2 className="mb-2 mt-8 text-[14px] font-bold uppercase">Mis liquidaciones</h2>
      {liq.ok && liq.data.length > 0 ? (
        <ul className="grid gap-2">
          {liq.data.map((l) => (
            <li key={l.id} className="border-2 border-border bg-surface p-3 text-[12.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">#{l.numero} · {l.desde} a {l.hasta}</p>
                <Badge tone={l.estado === "PAGADA" ? "success" : "accent"}>{ETIQUETA_LIQUIDACION[l.estado] ?? l.estado}</Badge>
              </div>
              <p className="mt-1">Total {formatCOP(l.total_neto)} · pagado {formatCOP(l.pagado)} · <b>me deben {formatCOP(l.saldo)}</b></p>
              <div className="mt-1 flex flex-wrap gap-4">
                <Link href={`/staff/ganancias/liquidacion/${l.id}`} className="font-semibold underline">Ver comprobante</Link>
                <details>
                  <summary className="cursor-pointer font-semibold underline">Pedir revisión</summary>
                  <FormAccion accion={solicitarRevision} etiqueta="Enviar solicitud" exito="Solicitud enviada." className="mt-2 grid gap-2">
                    <input type="hidden" name="tipo" value="LIQUIDACION" />
                    <input type="hidden" name="objeto" value={l.id} />
                    <textarea name="motivo" required minLength={10} maxLength={500} placeholder="¿Qué no cuadra? (mín. 10 caracteres)" className="min-h-16 w-full border-2 border-border bg-bg p-2 text-[13px]" />
                  </FormAccion>
                </details>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-text-muted">Todavía no tienes liquidaciones.</p>
      )}

      <h2 className="mb-2 mt-8 text-[14px] font-bold uppercase">Mis solicitudes de revisión</h2>
      {revisiones.length === 0 ? (
        <p className="text-[13px] text-text-muted">No has enviado solicitudes.</p>
      ) : (
        <ul className="grid gap-2">
          {revisiones.map((r) => (
            <li key={r.id} className="border-2 border-border bg-surface p-3 text-[12.5px]">
              <div className="flex justify-between gap-2"><b>{r.objeto_tipo.toLowerCase()}</b><Badge tone={r.estado === "APROBADA" ? "success" : r.estado === "RECHAZADA" ? "danger" : "accent"}>{r.estado.toLowerCase().replaceAll("_", " ")}</Badge></div>
              <p className="mt-1">{r.motivo}</p>
              {r.respuesta ? <p className="mt-1 text-text-muted">Respuesta: {r.respuesta}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

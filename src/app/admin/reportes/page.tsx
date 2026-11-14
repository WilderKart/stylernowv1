import { formatCOP } from "@/lib/utils";
import { CalendarDays, CircleDollarSign, Download, Store, Users } from "lucide-react";
import { EncabezadoAdmin } from "../_componentes/encabezado-admin";
import { leerRango } from "../_componentes/rango";
import { rpcAdmin } from "../_componentes/rpc";
import { SelectorFechas } from "../_componentes/selector-fechas";
import { Caja, GraficaBarras, Kpi, TituloCaja, Vacio } from "../_componentes/ui-admin";
import type { Reporte } from "./tipos";


const ESTADOS_SUSC: Record<string, string> = {
  ACTIVA: "Activas",
  TRIAL: "En prueba",
  EN_MORA: "En mora",
  REQUIERE_PLAN: "Requieren plan",
  SUSPENDIDA: "Suspendidas",
  CANCELADA: "Canceladas",
};

function Barra({ etiqueta, valor, max, extra }: { etiqueta: string; valor: number; max: number; extra?: string }) {
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate font-semibold text-text">{etiqueta}</span>
        <span className="shrink-0 font-mono text-text">
          {valor}
          {extra && <span className="ml-2 text-text-faint">{extra}</span>}
        </span>
      </div>
      <div className="mt-1 h-2 bg-surface">
        <div className="h-full bg-accent" style={{ width: `${max > 0 ? (valor / max) * 100 : 0}%` }} />
      </div>
    </li>
  );
}

export default async function AdminReportesPage(props: PageProps<"/admin/reportes">) {
  const sp = await props.searchParams;
  const rango = leerRango(sp, "30d");
  const res = await rpcAdmin<Reporte>("admin_reporte", { p_desde: rango.desde.toISOString(), p_hasta: rango.hasta.toISOString() });
  const qs = new URLSearchParams({ rango: rango.clave, desde: rango.desdeTexto, hasta: rango.hastaTexto }).toString();

  return (
    <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Reportes"
        titulo="Reportes de la"
        resaltado="operación."
        descripcion="Reservas, pagos, crecimiento y negocios destacados del periodo elegido. Montos de producción (sin pagos de prueba)."
        acciones={
          <a
            href={`/admin/reportes/exportar?${qs}`}
            className="inline-flex min-h-11 items-center gap-2 border-2 border-border px-3.5 font-mono text-[11.5px] font-bold uppercase text-text hover:bg-text hover:text-bg"
          >
            <Download className="size-4" aria-hidden /> Descargar CSV
          </a>
        }
      />
      <div className="mb-5">
        <SelectorFechas ruta="/admin/reportes" rango={rango} />
      </div>

      {!res.ok ? (
        <p className="border-2 border-danger px-4 py-3 text-[13px] font-semibold text-danger">{res.error}</p>
      ) : (
        (() => {
          const r = res.data;
          const maxTop = Math.max(0, ...r.top_negocios.map((n) => n.reservas));
          const maxCiudad = Math.max(0, ...r.ciudades.map((c) => c.reservas));
          const totalSusc = Object.values(r.suscripciones).reduce((a, b) => a + b, 0);
          const tasaCancel = r.reservas.total > 0 ? Math.round(((r.reservas.canceladas + r.reservas.no_show) / r.reservas.total) * 100) : 0;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Kpi icono={CalendarDays} etiqueta="Reservas creadas" valor={String(r.reservas.total)} nota={`${r.reservas.completadas} completadas · ${tasaCancel}% canceladas`} destacada />
                <Kpi icono={CircleDollarSign} etiqueta="Valor atendido" valor={formatCOP(Number(r.reservas.valor_completadas))} nota={`Ticket promedio ${formatCOP(Number(r.reservas.ticket_promedio))}`} />
                <Kpi icono={Users} etiqueta="Usuarios nuevos" valor={String(r.usuarios_nuevos)} nota="Cuentas creadas en el periodo" href="/admin/usuarios" />
                <Kpi icono={Store} etiqueta="Negocios nuevos" valor={String(r.negocios_nuevos)} nota="Registrados en el periodo" href="/admin/negocios" />
              </div>

              <Caja destacada className="mt-4 sm:mt-5">
                <TituloCaja>Reservas por día</TituloCaja>
                {r.reservas.total === 0 && r.usuarios_nuevos === 0 ? (
                  <Vacio>No hubo reservas ni cuentas nuevas en este periodo.</Vacio>
                ) : (
                  <GraficaBarras
                    serie={r.serie.map((d) => ({
                      etiqueta: d.dia.slice(8),
                      titulo: `${d.dia}: ${d.reservas} reservas, ${d.completadas} completadas, ${d.canceladas} canceladas, ${d.usuarios} usuarios nuevos`,
                      valores: [d.reservas, d.canceladas],
                    }))}
                    claves={[
                      { nombre: "Reservas", color: "bg-accent" },
                      { nombre: "Canceladas / no asistió", color: "bg-border-subtle" },
                    ]}
                  />
                )}
              </Caja>

              <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-3">
                <Caja>
                  <TituloCaja>Estado de las reservas</TituloCaja>
                  <ul className="px-4 pb-3 pt-2 sm:px-5">
                    <Barra etiqueta="Completadas" valor={r.reservas.completadas} max={r.reservas.total} />
                    <Barra etiqueta="Confirmadas / en curso" valor={r.reservas.confirmadas} max={r.reservas.total} />
                    <Barra etiqueta="Esperando pago" valor={r.reservas.pendientes_pago} max={r.reservas.total} />
                    <Barra etiqueta="Canceladas" valor={r.reservas.canceladas} max={r.reservas.total} />
                    <Barra etiqueta="No asistió" valor={r.reservas.no_show} max={r.reservas.total} />
                  </ul>
                </Caja>

                <Caja>
                  <TituloCaja>Pagos del periodo</TituloCaja>
                  <dl className="grid grid-cols-2 gap-4 px-4 pb-5 pt-4 sm:px-5">
                    {[
                      ["Aprobado", formatCOP(Number(r.pagos.monto_aprobado))],
                      ["Pagos aprobados", String(r.pagos.aprobados)],
                      ["De reservas", formatCOP(Number(r.pagos.monto_reservas))],
                      ["De suscripciones", formatCOP(Number(r.pagos.monto_suscripciones))],
                      ["Reembolsado", formatCOP(Number(r.pagos.reembolsado))],
                      ["Rechazados", String(r.pagos.rechazados)],
                      ["Comisión plataforma", formatCOP(Number(r.pagos.comision_plataforma))],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="font-mono text-[10.5px] font-bold uppercase text-text-faint">{k}</dt>
                        <dd className="mt-0.5 truncate font-display text-[17px] font-black text-text">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Caja>

                <Caja>
                  <TituloCaja href="/admin/planes">Suscripciones hoy</TituloCaja>
                  {totalSusc === 0 ? (
                    <Vacio>No hay suscripciones registradas.</Vacio>
                  ) : (
                    <ul className="px-4 pb-3 pt-2 sm:px-5">
                      {Object.entries(ESTADOS_SUSC)
                        .filter(([k]) => r.suscripciones[k])
                        .map(([k, etiqueta]) => (
                          <Barra key={k} etiqueta={etiqueta} valor={r.suscripciones[k]} max={totalSusc} />
                        ))}
                    </ul>
                  )}
                  {Object.keys(r.planes).length > 0 && (
                    <p className="px-4 pb-4 text-[12px] text-text-muted sm:px-5">
                      Planes vigentes: {Object.entries(r.planes).map(([p, c]) => `${p} ${c}`).join(" · ")}
                    </p>
                  )}
                </Caja>
              </div>

              <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-2">
                <Caja destacada>
                  <TituloCaja href="/admin/negocios">Negocios con más reservas</TituloCaja>
                  {r.top_negocios.length === 0 ? (
                    <Vacio>Sin reservas en el periodo.</Vacio>
                  ) : (
                    <ul className="px-4 pb-3 pt-2 sm:px-5">
                      {r.top_negocios.map((n) => (
                        <Barra
                          key={n.id}
                          etiqueta={`${n.nombre}${n.ciudad ? ` · ${n.ciudad}` : ""}`}
                          valor={n.reservas}
                          max={maxTop}
                          extra={n.valor > 0 ? formatCOP(Number(n.valor)) : undefined}
                        />
                      ))}
                    </ul>
                  )}
                </Caja>
                <Caja>
                  <TituloCaja>Reservas por ciudad</TituloCaja>
                  {r.ciudades.length === 0 ? (
                    <Vacio>Sin reservas en el periodo.</Vacio>
                  ) : (
                    <ul className="px-4 pb-3 pt-2 sm:px-5">
                      {r.ciudades.map((c) => (
                        <Barra key={c.ciudad} etiqueta={c.ciudad} valor={c.reservas} max={maxCiudad} />
                      ))}
                    </ul>
                  )}
                </Caja>
              </div>
            </>
          );
        })()
      )}
    </main>
  );
}

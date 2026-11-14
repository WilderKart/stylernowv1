import { formatCOP } from "@/lib/utils";
import { CircleDollarSign, Percent, Store } from "lucide-react";
import Link from "next/link";
import { EncabezadoAdmin } from "../_componentes/encabezado-admin";
import { rpcAdmin } from "../_componentes/rpc";
import { Caja, Insignia, Kpi, TituloCaja, Vacio } from "../_componentes/ui-admin";

type Resumen = {
  distribucion: { pct: number; negocios: number }[];
  programadas: {
    id: string;
    negocio: string | null;
    pct: number;
    efectivo_desde: string;
    motivo: string | null;
    aplicado_at: string | null;
    anulado_at: string | null;
    afectados: number | null;
    created_at: string;
  }[];
  cobrado: { mes: number; total: number; pagos_con_comision: number };
  por_negocio: { nombre: string; pct: number; cobrado: number }[];
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" });

export default async function AdminComisionesPage() {
  const res = await rpcAdmin<Resumen>("admin_comisiones_resumen");

  return (
    <main className="w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Comisiones"
        titulo="Comisión de la"
        resaltado="plataforma."
        descripcion={
          <>
            Porcentaje que tiene configurado cada negocio y lo cobrado en pagos reales (sin pruebas). Los cambios se programan en{" "}
            <Link href="/admin/reglas" className="font-semibold text-accent underline">
              Reglas y políticas
            </Link>
            .
          </>
        }
      />

      {!res.ok ? (
        <p className="border-2 border-danger px-4 py-3 text-[13px] font-semibold text-danger">{res.error}</p>
      ) : (
        (() => {
          const r = res.data;
          const totalNeg = r.distribucion.reduce((a, d) => a + d.negocios, 0);
          const conComision = r.distribucion.filter((d) => Number(d.pct) > 0).reduce((a, d) => a + d.negocios, 0);
          return (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Kpi icono={CircleDollarSign} etiqueta="Cobrado este mes" valor={formatCOP(Number(r.cobrado.mes))} destacada />
                <Kpi icono={CircleDollarSign} etiqueta="Cobrado total" valor={formatCOP(Number(r.cobrado.total))} nota={`${r.cobrado.pagos_con_comision} pagos con comisión`} />
                <Kpi icono={Store} etiqueta="Negocios con comisión" valor={`${conComision} / ${totalNeg}`} />
                <Kpi icono={Percent} etiqueta="Programaciones" valor={String(r.programadas.filter((p) => !p.aplicado_at && !p.anulado_at).length)} nota="Pendientes de aplicar" href="/admin/reglas" />
              </div>

              <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-2">
                <Caja destacada>
                  <TituloCaja>Porcentaje configurado</TituloCaja>
                  {r.distribucion.length === 0 ? (
                    <Vacio>No hay negocios.</Vacio>
                  ) : (
                    <ul className="px-4 pb-4 pt-2 sm:px-5">
                      {r.distribucion.map((d) => (
                        <li key={d.pct} className="py-2">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-semibold text-text">{Number(d.pct)} %</span>
                            <span className="font-mono text-text">{d.negocios} negocios</span>
                          </div>
                          <div className="mt-1 h-2 bg-surface">
                            <div className="h-full bg-accent" style={{ width: `${totalNeg ? (d.negocios / totalNeg) * 100 : 0}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Caja>

                <Caja>
                  <TituloCaja>Lo cobrado por negocio</TituloCaja>
                  {r.por_negocio.length === 0 ? (
                    <Vacio>Ningún negocio tiene comisión configurada.</Vacio>
                  ) : (
                    <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
                      {r.por_negocio.map((n, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                          <span className="min-w-0 truncate font-semibold text-text">{n.nombre}</span>
                          <span className="shrink-0 font-mono text-text-muted">
                            {Number(n.pct)} % · {formatCOP(Number(n.cobrado))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Caja>
              </div>

              <Caja className="mt-4 sm:mt-5">
                <TituloCaja href="/admin/reglas">Cambios programados</TituloCaja>
                {r.programadas.length === 0 ? (
                  <Vacio>No hay cambios de comisión programados.</Vacio>
                ) : (
                  <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
                    {r.programadas.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold text-text">
                            {Number(p.pct)} % · {p.negocio ?? "Todos los negocios"}
                          </span>
                          <span className="block text-[12px] text-text-muted">
                            Desde {fecha(p.efectivo_desde)}
                            {p.motivo && ` · ${p.motivo}`}
                          </span>
                        </span>
                        {p.anulado_at ? (
                          <Insignia>Anulado</Insignia>
                        ) : p.aplicado_at ? (
                          <Insignia tono="ok">Aplicado{p.afectados != null ? ` · ${p.afectados}` : ""}</Insignia>
                        ) : (
                          <Insignia tono="alerta">Programado</Insignia>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Caja>
            </>
          );
        })()
      )}
    </main>
  );
}

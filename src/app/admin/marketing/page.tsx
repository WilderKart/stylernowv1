import { Mail, MailCheck, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { EncabezadoAdmin } from "../_componentes/encabezado-admin";
import { rpcAdmin } from "../_componentes/rpc";
import { Caja, Kpi, TituloCaja, Vacio } from "../_componentes/ui-admin";

type Resumen = {
  audiencia: { total: number; con_consentimiento: number; con_telefono_verificado: number; por_pais: Record<string, number> };
  envios_30d: { canal: string; categoria: string; enviados: number; fallidos: number; pendientes: number }[];
  leidas_30d: { enviadas: number; leidas: number };
};

const PAISES: Record<string, string> = { CO: "Colombia", US: "Estados Unidos", MX: "México", ES: "España", SIN_PAIS: "Sin país" };
const CANALES: Record<string, string> = { EMAIL: "Correo", PUSH: "Notificación push", PANEL: "Aviso en la app" };

export default async function AdminMarketingPage() {
  const res = await rpcAdmin<Resumen>("admin_marketing_resumen");

  return (
    <main className="w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin
        seccion="Marketing"
        titulo="Audiencia y"
        resaltado="envíos."
        descripcion={
          <>
            Solo se cuenta como audiencia de marketing a quien aceptó recibir comunicaciones. Las campañas por WhatsApp se gestionan en{" "}
            <Link href="/admin/whatsapp" className="font-semibold text-accent underline">
              WhatsApp
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
          const pct = r.audiencia.total > 0 ? Math.round((r.audiencia.con_consentimiento / r.audiencia.total) * 100) : 0;
          const tasaLectura = r.leidas_30d.enviadas > 0 ? Math.round((r.leidas_30d.leidas / r.leidas_30d.enviadas) * 100) : 0;
          const paises = Object.entries(r.audiencia.por_pais).sort((a, b) => b[1] - a[1]);
          const maxPais = Math.max(0, ...paises.map(([, c]) => c));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Kpi icono={Users} etiqueta="Audiencia con permiso" valor={String(r.audiencia.con_consentimiento)} nota={`${pct}% de ${r.audiencia.total} cuentas`} destacada />
                <Kpi icono={MessageCircle} etiqueta="Con celular verificado" valor={String(r.audiencia.con_telefono_verificado)} nota="Alcanzables por WhatsApp" />
                <Kpi icono={Mail} etiqueta="Avisos en la app (30 días)" valor={String(r.leidas_30d.enviadas)} />
                <Kpi icono={MailCheck} etiqueta="Tasa de lectura" valor={`${tasaLectura}%`} nota={`${r.leidas_30d.leidas} leídos`} />
              </div>

              <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-2">
                <Caja destacada>
                  <TituloCaja>Audiencia por país</TituloCaja>
                  {paises.length === 0 ? (
                    <Vacio>Nadie ha aceptado comunicaciones de marketing todavía.</Vacio>
                  ) : (
                    <ul className="px-4 pb-4 pt-2 sm:px-5">
                      {paises.map(([p, c]) => (
                        <li key={p} className="py-2">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-semibold text-text">{PAISES[p] ?? p}</span>
                            <span className="font-mono text-text">{c}</span>
                          </div>
                          <div className="mt-1 h-2 bg-surface">
                            <div className="h-full bg-accent" style={{ width: `${maxPais ? (c / maxPais) * 100 : 0}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Caja>

                <Caja>
                  <TituloCaja>Envíos de los últimos 30 días</TituloCaja>
                  {r.envios_30d.length === 0 ? (
                    <Vacio>No hubo envíos en los últimos 30 días.</Vacio>
                  ) : (
                    <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
                      {r.envios_30d.map((e, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                          <span className="min-w-0">
                            <span className="block font-semibold text-text">{CANALES[e.canal] ?? e.canal}</span>
                            <span className="block text-[12px] text-text-muted">{e.categoria === "MARKETING" ? "Marketing" : "Transaccional"}</span>
                          </span>
                          <span className="shrink-0 text-right font-mono text-[12px] text-text-muted">
                            <span className="block text-text">{e.enviados} enviados</span>
                            {e.fallidos} fallidos · {e.pendientes} en cola
                          </span>
                        </li>
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

import { formatCOP } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EncabezadoAdmin } from "../../_componentes/encabezado-admin";
import { rpcAdmin } from "../../_componentes/rpc";
import { Caja, Insignia, TituloCaja, Vacio } from "../../_componentes/ui-admin";
import { AccionesUsuario } from "./acciones-usuario";

type Detalle = {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  telefono_verificado: boolean;
  pais: string | null;
  locale: string | null;
  es_supersu: boolean;
  registro_pendiente: boolean;
  consentimiento_datos_at: string | null;
  consentimiento_marketing: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmado: boolean;
  proveedor: string;
  suspendido: boolean;
  negocios: { id: string; nombre: string; slug: string; estado: string; plan: string; ciudad: string | null }[];
  vinculos: { negocio: string; estado: string; guardian: boolean; desde: string | null }[];
  reservas_total: number;
  reservas: { id: string; negocio: string; hora_inicio: string; estado: string; monto_total: number | null }[];
  eventos: { accion: string; entidad: string; motivo: string | null; created_at: string }[];
};

const fechaHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })
    : "—";
const legible = (t: string) => {
  const s = t.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-text-faint">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] text-text">{children}</dd>
    </div>
  );
}

export default async function AdminUsuarioDetallePage(props: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await rpcAdmin<Detalle>("admin_usuario_detalle", { p_id: id });
  if (!res.ok) {
    if (res.error.includes("encontramos")) notFound();
    return (
      <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
        <p className="border-2 border-danger px-4 py-3 text-[13px] font-semibold text-danger">{res.error}</p>
      </main>
    );
  }
  const u = res.data;
  const rol = u.es_supersu ? "Super Admin" : u.negocios.length > 0 ? "Barbería" : u.vinculos.length > 0 ? "Staff" : "Cliente";

  return (
    <main className="w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/admin/usuarios" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-accent">
        <ArrowLeft className="size-4" aria-hidden /> Usuarios
      </Link>
      <EncabezadoAdmin
        seccion={`Usuarios / ${rol}`}
        titulo={u.nombre || "Sin nombre"}
        descripcion={u.email ?? undefined}
        acciones={
          <span className="flex flex-wrap gap-1.5">
            <Insignia tono={u.es_supersu ? "acento" : "neutro"}>{rol}</Insignia>
            {u.suspendido ? <Insignia tono="peligro">Suspendido</Insignia> : <Insignia tono="ok">Activo</Insignia>}
            {u.registro_pendiente && <Insignia tono="alerta">Registro incompleto</Insignia>}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Caja destacada className="lg:col-span-2">
          <TituloCaja>Datos de la cuenta</TituloCaja>
          <dl className="grid grid-cols-1 gap-4 px-4 pb-5 pt-4 sm:grid-cols-2 sm:px-5">
            <Dato etiqueta="Correo">
              {u.email ?? "—"} {u.email_confirmado ? "" : <span className="text-text-faint">(sin confirmar)</span>}
            </Dato>
            <Dato etiqueta="Celular">
              {u.telefono ?? "—"} {u.telefono && (u.telefono_verificado ? <Insignia tono="ok">Verificado</Insignia> : <span className="text-text-faint">(sin verificar)</span>)}
            </Dato>
            <Dato etiqueta="País / idioma">{[u.pais, u.locale].filter(Boolean).join(" · ") || "—"}</Dato>
            <Dato etiqueta="Ingresa con">{u.proveedor === "google" ? "Google" : "Correo"}</Dato>
            <Dato etiqueta="Alta">{fechaHora(u.created_at)}</Dato>
            <Dato etiqueta="Último ingreso">{fechaHora(u.last_sign_in_at)}</Dato>
            <Dato etiqueta="Tratamiento de datos">{u.consentimiento_datos_at ? `Aceptado ${fechaHora(u.consentimiento_datos_at)}` : "Sin registro"}</Dato>
            <Dato etiqueta="Marketing">{u.consentimiento_marketing ? "Acepta comunicaciones" : "No acepta"}</Dato>
          </dl>
        </Caja>

        <Caja>
          <TituloCaja>Acciones</TituloCaja>
          <AccionesUsuario
            usuarioId={u.id}
            suspendido={u.suspendido}
            bloqueado={u.es_supersu ? "La cuenta Super Admin solo se administra desde la base de datos." : null}
          />
        </Caja>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Caja>
          <TituloCaja>Negocios propios ({u.negocios.length})</TituloCaja>
          {u.negocios.length === 0 ? (
            <Vacio>No es dueño de ningún negocio.</Vacio>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
              {u.negocios.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-text">{n.nombre}</span>
                    <span className="block truncate text-[12px] text-text-muted">{[n.ciudad, n.plan].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Insignia tono={n.estado === "ACTIVO" ? "ok" : n.estado === "PENDIENTE_APROBACION" ? "alerta" : "neutro"}>{legible(n.estado)}</Insignia>
                </li>
              ))}
            </ul>
          )}
        </Caja>

        <Caja>
          <TituloCaja>Staff en ({u.vinculos.length})</TituloCaja>
          {u.vinculos.length === 0 ? (
            <Vacio>No trabaja como staff en ningún negocio.</Vacio>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
              {u.vinculos.map((v, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-text">{v.negocio}</span>
                    <span className="block text-[12px] text-text-muted">{v.guardian ? "Guardián de sede · " : ""}Desde {fechaHora(v.desde)}</span>
                  </span>
                  <Insignia tono={v.estado === "ACTIVO" ? "ok" : "neutro"}>{legible(v.estado)}</Insignia>
                </li>
              ))}
            </ul>
          )}
        </Caja>

        <Caja>
          <TituloCaja>Reservas como cliente ({u.reservas_total})</TituloCaja>
          {u.reservas.length === 0 ? (
            <Vacio>No ha hecho reservas.</Vacio>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
              {u.reservas.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-text">{r.negocio}</span>
                    <span className="block text-[12px] text-text-muted">
                      {fechaHora(r.hora_inicio)}
                      {r.monto_total != null && ` · ${formatCOP(Number(r.monto_total))}`}
                    </span>
                  </span>
                  <Insignia tono={r.estado === "COMPLETADA" ? "ok" : r.estado === "CANCELADA" || r.estado === "NO_SHOW" ? "peligro" : "neutro"}>
                    {legible(r.estado)}
                  </Insignia>
                </li>
              ))}
            </ul>
          )}
        </Caja>

        <Caja>
          <TituloCaja>Actividad registrada</TituloCaja>
          {u.eventos.length === 0 ? (
            <Vacio>Sin eventos en la auditoría.</Vacio>
          ) : (
            <ul className="mt-2 divide-y divide-border-subtle px-4 pb-2 sm:px-5">
              {u.eventos.map((e, i) => (
                <li key={i} className="py-3">
                  <span className="block text-[13.5px] font-semibold text-text">{legible(e.accion)}</span>
                  <span className="block text-[12px] text-text-muted">
                    {fechaHora(e.created_at)}
                    {e.motivo && ` · ${e.motivo}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Caja>
      </div>
    </main>
  );
}

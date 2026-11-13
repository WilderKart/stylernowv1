"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { envioHabilitado } from "@/lib/whatsapp/reglas";
import {
  ESTADOS_CONEXION_ADMIN,
  PROVEEDORES,
  type EstadoConexionAdmin,
  type PaqueteAdmin,
  type Proveedor,
  type ResumenAdminWhatsApp,
} from "@/lib/whatsapp/tipos";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actualizarConfigWhatsApp,
  alternarPaqueteWhatsApp,
  cambiarEstadoConexion,
  crearPaqueteWhatsApp,
  versionarPaqueteWhatsApp,
} from "./actions";

const ETIQUETA_CONEXION: Record<string, string> = {
  NO_CONFIGURADO: "No configurado",
  PENDIENTE_CREDENCIALES: "Pendiente de credenciales",
  SANDBOX: "Sandbox (pruebas)",
  PRODUCCION: "Producción",
  SUSPENDIDO: "Suspendido",
  REVOCADO: "Revocado",
  ERROR: "Error",
};

const fmt = (n: number) => new Intl.NumberFormat("es-CO").format(n);
const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
const precio = (p: { precio: number; moneda: string }) => (p.moneda === "COP" ? formatCOP(Number(p.precio)) : `${fmt(Number(p.precio))} ${p.moneda}`);

function useAccion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void) {
    setError(null);
    setOk(false);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "No pudimos completar la acción.");
      setOk(true);
      alTerminar?.();
      router.refresh();
    });
  }
  return { pendiente, error, ok, ejecutar };
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">{children}</h2>;
}

export function VistaAdminWhatsApp({ resumen, errorInicial }: { resumen: ResumenAdminWhatsApp | null; errorInicial: string | null }) {
  if (!resumen) return <p className="text-[12.5px] font-semibold text-danger">{errorInicial ?? "No pudimos cargar la configuración de WhatsApp."}</p>;
  return (
    <div className="flex flex-col gap-8">
      <SeccionConexion resumen={resumen} />
      <SeccionReglas resumen={resumen} />
      <SeccionPaquetes paquetes={resumen.paquetes} />
      <SeccionCompras resumen={resumen} />
    </div>
  );
}

function SeccionConexion({ resumen }: { resumen: ResumenAdminWhatsApp }) {
  const { pendiente, error, ok, ejecutar } = useAccion();
  const actual = resumen.config.estado_conexion;
  const [estado, setEstado] = useState<EstadoConexionAdmin>("PENDIENTE_CREDENCIALES");
  const [motivo, setMotivo] = useState("");
  return (
    <section>
      <Titulo>Conexión con el proveedor</Titulo>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={envioHabilitado(actual) ? "success" : "danger"}>{ETIQUETA_CONEXION[actual] ?? actual}</Badge>
          <span className="text-[12px] text-text-muted">
            {envioHabilitado(actual) ? "El envío está habilitado." : "Envío bloqueado: ningún negocio puede enviar mensajes."}
          </span>
        </div>
        <p className="text-[11.5px] text-text-faint">
          Último cambio: {fecha(resumen.config.estado_conexion_at)} {resumen.config.estado_conexion_detalle ? `· ${resumen.config.estado_conexion_detalle}` : ""}
        </p>
        <p className="text-[11.5px] text-text-faint">
          Sandbox, Producción y Error solo los fija el sistema al verificar las credenciales con el proveedor real. Aquí puedes marcar estados
          administrativos.
        </p>
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">Nuevo estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoConexionAdmin)}
              className="min-h-12 border-2 border-border bg-bg px-3 text-[14px] text-text"
            >
              {ESTADOS_CONEXION_ADMIN.map((s) => (
                <option key={s} value={s}>
                  {ETIQUETA_CONEXION[s]}
                </option>
              ))}
            </select>
          </label>
          <Input label="Motivo (auditoría)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
        </div>
        {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
        {ok ? <p className="text-[12px] font-semibold text-text">Estado actualizado.</p> : null}
        <Button size="sm" className="self-start" loading={pendiente} onClick={() => ejecutar(() => cambiarEstadoConexion({ estado, motivo }), () => setMotivo(""))}>
          Cambiar estado
        </Button>
      </Card>
    </section>
  );
}

function SeccionReglas({ resumen }: { resumen: ResumenAdminWhatsApp }) {
  const { pendiente, error, ok, ejecutar } = useAccion();
  const c = resumen.config;
  const [pctPlan, setPctPlan] = useState(String(c.pct_marketing_plan));
  const [pctRecarga, setPctRecarga] = useState(String(c.pct_marketing_recarga));
  const [meses, setMeses] = useState(String(c.meses_vencimiento_recarga));
  const [umbrales, setUmbrales] = useState(c.umbrales_alerta.join(", "));
  const [proveedor, setProveedor] = useState<Proveedor | "">(c.proveedor ?? "");
  const [motivo, setMotivo] = useState("");

  function guardar() {
    ejecutar(
      () =>
        actualizarConfigWhatsApp({
          pctMarketingPlan: Number(pctPlan),
          pctMarketingRecarga: Number(pctRecarga),
          mesesVencimientoRecarga: Number(meses),
          umbralesAlerta: umbrales
            .split(",")
            .map((u) => u.trim())
            .filter(Boolean)
            .map(Number),
          proveedor: proveedor || null,
          motivo,
        }),
      () => setMotivo("")
    );
  }

  return (
    <section>
      <Titulo>Reglas de cuota</Titulo>
      <Card className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="% marketing de la cuota del plan" type="number" min={0} max={100} value={pctPlan} onChange={(e) => setPctPlan(e.target.value)} />
          <Input label="% marketing de cada recarga" type="number" min={0} max={100} value={pctRecarga} onChange={(e) => setPctRecarga(e.target.value)} />
          <Input label="Vencimiento recargas (meses)" type="number" min={1} max={36} value={meses} onChange={(e) => setMeses(e.target.value)} />
          <Input label="Umbrales de alerta (%)" value={umbrales} onChange={(e) => setUmbrales(e.target.value)} placeholder="80, 100" />
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.72px] text-text">Proveedor previsto</span>
            <select
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value as Proveedor | "")}
              className="min-h-12 border-2 border-border bg-bg px-3 text-[14px] text-text"
            >
              <option value="">Sin definir</option>
              {PROVEEDORES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <Input label="Motivo (auditoría)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
        </div>
        <p className="text-[11.5px] text-text-faint">
          Los cambios aplican a lotes y solicitudes nuevas; los lotes ya otorgados y las solicitudes ya creadas conservan sus valores. Cada cambio queda
          en la auditoría con el valor anterior, el nuevo y el motivo.
        </p>
        {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
        {ok ? <p className="text-[12px] font-semibold text-text">Reglas guardadas.</p> : null}
        <Button size="sm" className="self-start" loading={pendiente} onClick={guardar}>
          Guardar reglas
        </Button>
      </Card>
    </section>
  );
}

function SeccionPaquetes({ paquetes }: { paquetes: PaqueteAdmin[] }) {
  const { pendiente, error, ok, ejecutar } = useAccion();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [conversaciones, setConversaciones] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const ultimaVersion = new Map<string, number>();
  for (const p of paquetes) ultimaVersion.set(p.codigo, Math.max(ultimaVersion.get(p.codigo) ?? 0, p.version));

  return (
    <section>
      <Titulo>Paquetes de recarga</Titulo>
      <ul className="mb-4 flex flex-col gap-2.5">
        {paquetes.map((p) => (
          <FilaPaquete key={p.id} paquete={p} esUltima={ultimaVersion.get(p.codigo) === p.version} />
        ))}
      </ul>
      <Card className="flex flex-col gap-3">
        <p className="text-[12.5px] font-bold text-text">Nuevo paquete</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Código" placeholder="RECARGA_10000" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Conversaciones" type="number" min={1} value={conversaciones} onChange={(e) => setConversaciones(e.target.value)} />
          <Input label="Precio (COP)" type="number" min={1} value={valor} onChange={(e) => setValor(e.target.value)} />
          <Input label="Motivo (auditoría)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
        </div>
        {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
        {ok ? <p className="text-[12px] font-semibold text-text">Paquete creado.</p> : null}
        <Button
          size="sm"
          className="self-start"
          loading={pendiente}
          onClick={() =>
            ejecutar(
              () => crearPaqueteWhatsApp({ codigo, nombre, conversaciones: Number(conversaciones), precio: Number(valor), moneda: "COP", motivo }),
              () => {
                setCodigo("");
                setNombre("");
                setConversaciones("");
                setValor("");
                setMotivo("");
              }
            )
          }
        >
          Crear paquete
        </Button>
      </Card>
    </section>
  );
}

function FilaPaquete({ paquete, esUltima }: { paquete: PaqueteAdmin; esUltima: boolean }) {
  const { pendiente, error, ejecutar } = useAccion();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(paquete.nombre);
  const [conversaciones, setConversaciones] = useState(String(paquete.conversaciones));
  const [valor, setValor] = useState(String(paquete.precio));
  const [motivo, setMotivo] = useState("");

  return (
    <li className="border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-bold text-text">
            {paquete.nombre} <span className="font-normal text-text-faint">· {paquete.codigo} v{paquete.version}</span>
          </p>
          <p className="text-[12px] text-text-muted">
            {fmt(paquete.conversaciones)} conversaciones · {precio(paquete)}
          </p>
        </div>
        <Badge tone={paquete.activo ? "success" : "neutral"}>{paquete.activo ? "Activo" : "Inactivo"}</Badge>
      </div>
      {esUltima ? (
        <div className="mt-3 flex flex-col gap-3">
          {editando ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Conversaciones" type="number" min={1} value={conversaciones} onChange={(e) => setConversaciones(e.target.value)} />
              <Input label="Precio" type="number" min={1} value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          ) : null}
          <Input label="Motivo (auditoría)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {editando ? (
              <Button
                size="sm"
                loading={pendiente}
                onClick={() =>
                  ejecutar(
                    () => versionarPaqueteWhatsApp({ paqueteId: paquete.id, nombre, conversaciones: Number(conversaciones), precio: Number(valor), motivo }),
                    () => setEditando(false)
                  )
                }
              >
                Guardar como versión {paquete.version + 1}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                Cambiar precio o cantidad
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={pendiente}
              onClick={() => ejecutar(() => alternarPaqueteWhatsApp({ paqueteId: paquete.id, activo: !paquete.activo, motivo }))}
            >
              {paquete.activo ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function SeccionCompras({ resumen }: { resumen: ResumenAdminWhatsApp }) {
  return (
    <section>
      <Titulo>Solicitudes de recarga</Titulo>
      <p className="mb-3 text-[12px] text-text-faint">
        {fmt(resumen.compras_pendientes)} pendientes de pago. El cobro en línea todavía no está habilitado: las solicitudes se acreditan solo cuando el
        sistema de pagos confirma el pago.
      </p>
      {resumen.compras_recientes.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-text-faint">No hay solicitudes todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resumen.compras_recientes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border border-border-subtle bg-surface p-3">
              <div>
                <p className="text-[12.5px] font-bold text-text">
                  {c.negocio} · {fmt(c.conversaciones)} conversaciones · {precio(c)}
                </p>
                <p className="text-[11px] text-text-faint">{fecha(c.fecha)}</p>
              </div>
              <Badge tone={c.estado === "ACREDITADA" ? "success" : c.estado === "PENDIENTE_PAGO" ? "accent" : "neutral"}>{c.estado}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

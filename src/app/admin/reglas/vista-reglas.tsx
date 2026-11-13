"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  anularComisionProgramada,
  guardarComisionDefault,
  guardarConfigPrueba,
  guardarLimites,
  programarComision,
  reintentarReembolso,
  type DatosReglas,
} from "./actions";

type Aviso = { tipo: "ok" | "error"; texto: string } | null;

function Mensaje({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <p
      role={aviso.tipo === "error" ? "alert" : "status"}
      className={`border-2 p-3 text-[13px] font-bold ${aviso.tipo === "error" ? "border-danger text-danger" : "border-border"}`}
    >
      {aviso.texto}
    </p>
  );
}

function useAccion() {
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, iniciar] = useTransition();
  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return setAviso({ tipo: "error", texto: r.error ?? "Error" });
      setAviso({ tipo: "ok", texto: ok });
      router.refresh();
    });
  }
  return { aviso, pendiente, ejecutar };
}

const n = (v: string) => Number(v);

function SeccionLimites({ l }: { l: DatosReglas["limites"] }) {
  const [v, setV] = useState({
    totalMin: String(l.totalMin),
    totalMax: String(l.totalMax),
    parcialMin: String(l.parcialMin),
    pctMin: String(l.pctMin),
    pctMax: String(l.pctMax),
    maxIntentos: String(l.maxIntentos),
    motivo: "",
  });
  const { aviso, pendiente, ejecutar } = useAccion();
  const campo = (k: keyof typeof v, label: string) => (
    <Input label={label} type="number" required value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
  );
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Límites de la política de cancelación</h2>
      <p className="sn-meta">
        Cada negocio configura su política dentro de estos límites. Cambiarlos no reescribe políticas ya
        configuradas ni las aceptadas por clientes.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {campo("totalMin", "Ventana total mínima (h)")}
        {campo("totalMax", "Ventana total máxima (h)")}
        {campo("parcialMin", "Ventana parcial mínima (h)")}
        {campo("pctMin", "% parcial mínimo")}
        {campo("pctMax", "% parcial máximo")}
        {campo("maxIntentos", "Intentos de reembolso antes de revisión")}
      </div>
      <Input label="Motivo del cambio" required value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
      <Mensaje aviso={aviso} />
      <Button
        loading={pendiente}
        onClick={() =>
          ejecutar(
            () =>
              guardarLimites({
                totalMin: n(v.totalMin),
                totalMax: n(v.totalMax),
                parcialMin: n(v.parcialMin),
                pctMin: n(v.pctMin),
                pctMax: n(v.pctMax),
                maxIntentos: n(v.maxIntentos),
                motivo: v.motivo,
              }),
            "Límites guardados."
          )
        }
      >
        Guardar límites
      </Button>
    </Card>
  );
}

function SeccionPrueba({ p }: { p: DatosReglas["prueba"] }) {
  const [v, setV] = useState({
    dias: String(p.dias),
    modalidad: p.modalidad,
    graciaDias: String(p.graciaDias),
    aviso1: String(p.aviso1),
    aviso2: String(p.aviso2),
    motivo: "",
  });
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Prueba gratuita y suscripciones</h2>
      <p className="sn-meta">
        Sin tarjeta, la prueba no se cobra: al vencer, el negocio pasa a «requiere plan». Con tarjeta, se cobra al
        terminar solo si el país tiene cobro recurrente habilitado. Aplica a pruebas que se inicien desde ahora.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Duración (días)" type="number" value={v.dias} onChange={(e) => setV({ ...v, dias: e.target.value })} />
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Modalidad
          <select
            className="h-11 border-2 border-border bg-bg px-3"
            value={v.modalidad}
            onChange={(e) => setV({ ...v, modalidad: e.target.value as typeof v.modalidad })}
          >
            <option value="SIN_TARJETA">Sin tarjeta</option>
            <option value="CON_TARJETA">Con tarjeta obligatoria</option>
            <option value="AMBAS">El negocio elige</option>
          </select>
        </label>
        <Input label="Gracia por impago (días)" type="number" value={v.graciaDias} onChange={(e) => setV({ ...v, graciaDias: e.target.value })} />
        <Input label="Primer aviso (días antes)" type="number" value={v.aviso1} onChange={(e) => setV({ ...v, aviso1: e.target.value })} />
        <Input label="Segundo aviso (días antes, 0 = no)" type="number" value={v.aviso2} onChange={(e) => setV({ ...v, aviso2: e.target.value })} />
      </div>
      <Input label="Motivo del cambio" required value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
      <Mensaje aviso={aviso} />
      <Button
        loading={pendiente}
        onClick={() =>
          ejecutar(
            () =>
              guardarConfigPrueba({
                dias: n(v.dias),
                modalidad: v.modalidad,
                graciaDias: n(v.graciaDias),
                aviso1: n(v.aviso1),
                aviso2: n(v.aviso2),
                motivo: v.motivo,
              }),
            "Configuración de prueba guardada."
          )
        }
      >
        Guardar prueba
      </Button>
    </Card>
  );
}

function SeccionComision({ d }: { d: DatosReglas }) {
  const [def, setDef] = useState(String(d.comisionDefault));
  const [prog, setProg] = useState({ negocioId: "", pct: "0", desde: "", motivo: "" });
  const [motivoAnular, setMotivoAnular] = useState("");
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Comisión de StylerNow sobre reservas</h2>
      <p className="sn-meta">
        El default aplica solo a negocios nuevos. Para cambiar la comisión de negocios existentes, programa un
        cambio con fecha de vigencia: se aplica a pagos futuros y nunca reescribe pagos históricos.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Default para negocios nuevos (%)" type="number" step="0.01" value={def} onChange={(e) => setDef(e.target.value)} />
        <Button variant="secondary" loading={pendiente} onClick={() => ejecutar(() => guardarComisionDefault(n(def)), "Default guardado.")}>
          Guardar default
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Negocio (id; vacío = todos los existentes)"
          value={prog.negocioId}
          onChange={(e) => setProg({ ...prog, negocioId: e.target.value })}
        />
        <Input label="Nueva comisión (%)" type="number" step="0.01" value={prog.pct} onChange={(e) => setProg({ ...prog, pct: e.target.value })} />
        <Input label="Vigente desde" type="datetime-local" value={prog.desde} onChange={(e) => setProg({ ...prog, desde: e.target.value })} />
        <Input label="Motivo (acuerdo, comunicación al negocio)" value={prog.motivo} onChange={(e) => setProg({ ...prog, motivo: e.target.value })} />
      </div>
      <Button
        loading={pendiente}
        onClick={() =>
          ejecutar(
            () =>
              programarComision({
                negocioId: prog.negocioId.trim() || null,
                pct: n(prog.pct),
                efectivoDesde: prog.desde ? new Date(prog.desde).toISOString() : "",
                motivo: prog.motivo,
              }),
            "Cambio programado."
          )
        }
      >
        Programar cambio
      </Button>
      <Mensaje aviso={aviso} />
      {d.cambiosComision.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Input label="Motivo para anular" value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {d.cambiosComision.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 border-2 border-border p-3 text-[13px]">
                <Badge tone={c.aplicadoAt ? "success" : c.anuladoAt ? "neutral" : "accent"}>
                  {c.aplicadoAt ? "Aplicado" : c.anuladoAt ? "Anulado" : "Programado"}
                </Badge>
                <span className="min-w-0 break-words">
                  {c.pctNuevo} % · {c.negocioId ?? "todos"} · desde {new Date(c.efectivoDesde).toLocaleString("es-CO")} · {c.motivo}
                </span>
                {!c.aplicadoAt && !c.anuladoAt ? (
                  <Button size="sm" variant="ghost" onClick={() => ejecutar(() => anularComisionProgramada(c.id, motivoAnular), "Cambio anulado.")}>
                    Anular
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function SeccionReembolsos({ r }: { r: DatosReglas["reembolsosRevision"] }) {
  const [motivo, setMotivo] = useState("");
  const { aviso, pendiente, ejecutar } = useAccion();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="section">Reembolsos fallidos o en revisión</h2>
      <p className="sn-meta">
        Un reembolso solo figura como hecho cuando Mercado Pago lo confirma. Aquí quedan los que la pasarela rechazó
        (saldo insuficiente, conexión revocada, etc.) para resolverlos.
      </p>
      {r.length === 0 ? (
        <p className="text-[13px]">No hay reembolsos pendientes de revisión.</p>
      ) : (
        <>
          <Input label="Motivo del reintento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 border-2 border-border p-3 text-[13px]">
                <Badge tone={x.estado === "REQUIERE_REVISION" ? "danger" : "accent"}>{x.estado}</Badge>
                <span className="min-w-0 break-words">
                  {formatCOP(x.monto)} · intentos {x.intentos} · {x.ultimoError ?? "sin detalle"}
                </span>
                <Button size="sm" variant="secondary" loading={pendiente} onClick={() => ejecutar(() => reintentarReembolso(x.id, motivo), "Reembolso reencolado.")}>
                  Reintentar
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Mensaje aviso={aviso} />
    </Card>
  );
}

export function VistaReglas({ datos }: { datos: DatosReglas }) {
  return (
    <div className="flex flex-col gap-6">
      <SeccionReembolsos r={datos.reembolsosRevision} />
      <SeccionLimites l={datos.limites} />
      <SeccionPrueba p={datos.prueba} />
      <SeccionComision d={datos} />
    </div>
  );
}

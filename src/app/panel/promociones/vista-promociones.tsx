"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  actualizarPromocion,
  cambiarEstadoPromocion,
  crearPromocion,
  eliminarPromocion,
  type EventoPromocion,
  type Promocion,
  type TipoDescuento,
} from "./actions";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const TIPO_TEXTO: Record<TipoDescuento, string> = { PORCENTAJE: "Porcentaje (%)", MONTO: "Monto fijo ($)", DOS_POR_UNO: "2 por 1" };
const ACCION_TEXTO: Record<string, string> = {
  INSERT: "Creada",
  UPDATE: "Modificada",
  DELETE: "Eliminada",
  OFERTA_NEGOCIO_CREADO: "Creada",
  OFERTA_NEGOCIO_ACTUALIZADO: "Modificada",
  OFERTA_NEGOCIO_ELIMINADO: "Eliminada",
};

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function resumenValor(p: Promocion) {
  if (p.tipoDescuento === "DOS_POR_UNO") return "2 por 1";
  if (p.valor === null) return "—";
  return p.tipoDescuento === "PORCENTAJE" ? `${p.valor} % de descuento` : `${formatCOP(p.valor)} de descuento`;
}

function estadoDe(p: Promocion): { texto: string; vigente: boolean } {
  const h = hoy();
  if (!p.activa) return { texto: "Pausada", vigente: false };
  if (p.vigenteHasta && p.vigenteHasta < h) return { texto: "Vencida", vigente: false };
  if (p.vigenteDesde > h) return { texto: "Programada", vigente: false };
  return { texto: "Vigente", vigente: true };
}

interface Formulario {
  titulo: string;
  descripcion: string;
  tipo: TipoDescuento;
  valor: string;
  dias: number[];
  desde: string;
  hasta: string;
}

const VACIO: Formulario = { titulo: "", descripcion: "", tipo: "PORCENTAJE", valor: "", dias: [], desde: "", hasta: "" };

export function VistaPromociones({ promociones, historial }: { promociones: Promocion[]; historial: EventoPromocion[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | "nueva" | null>(null);
  const [f, setF] = useState<Formulario>(VACIO);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promoAEliminar, setPromoAEliminar] = useState<string | null>(null);

  function abrirNueva() {
    setF({ ...VACIO, desde: hoy() });
    setEditando("nueva");
    setMensaje(null);
  }

  function abrirEdicion(p: Promocion) {
    setF({
      titulo: p.titulo,
      descripcion: p.descripcion ?? "",
      tipo: p.tipoDescuento,
      valor: p.valor === null ? "" : String(p.valor),
      dias: p.diasSemana ?? [],
      desde: p.vigenteDesde,
      hasta: p.vigenteHasta ?? "",
    });
    setEditando(p.id);
    setMensaje(null);
  }

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string, alTerminar?: () => void) {
    setMensaje(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error ?? "No pudimos completar la acción." });
      setMensaje({ tipo: "ok", texto: exito });
      alTerminar?.();
      router.refresh();
    });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const datos = {
      titulo: f.titulo,
      descripcion: f.descripcion,
      tipoDescuento: f.tipo,
      valor: f.tipo === "DOS_POR_UNO" ? null : Number(f.valor),
      diasSemana: f.dias,
      vigenteDesde: f.desde,
      vigenteHasta: f.hasta || null,
    };
    if (editando === "nueva") ejecutar(() => crearPromocion(datos), "Promoción creada.", () => setEditando(null));
    else if (editando) ejecutar(() => actualizarPromocion(editando, datos), "Promoción actualizada.", () => setEditando(null));
  }

  function alternarDia(d: number) {
    setF((x) => ({ ...x, dias: x.dias.includes(d) ? x.dias.filter((y) => y !== d) : [...x.dias, d] }));
  }

  function handleConfirmarEliminar() {
    setConfirmOpen(false);
    if (promoAEliminar) {
      ejecutar(() => eliminarPromocion(promoAEliminar), "Promoción eliminada.");
    }
    setPromoAEliminar(null);
  }

  function handleCancelarEliminar() {
    setConfirmOpen(false);
    setPromoAEliminar(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="poster-3 break-words">Promociones</h1>
          <p className="sn-meta mt-2">
            Crea, pausa o retira las promociones de tu barbería. Tus clientes las ven en Ofertas mientras estén vigentes. Solo tú, como dueño,
            puedes administrarlas; StylerNow solo actúa sobre ellas si tú lo autorizas desde un ticket de soporte.
          </p>
        </div>
        {editando === null ? <Button onClick={abrirNueva}>Nueva promoción</Button> : null}
      </header>

      {mensaje ? (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={mensaje.tipo === "error" ? "border-2 border-danger p-3 text-[13px] font-bold text-danger" : "border-2 border-border p-3 text-[13px] font-bold"}
        >
          {mensaje.texto}
        </p>
      ) : null}

      {editando !== null ? (
        <Card className="p-4">
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <p className="sn-label">{editando === "nueva" ? "Nueva promoción" : "Editar promoción"}</p>
            <Input label="Título (3 a 80 caracteres)" required minLength={3} maxLength={80} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
            <Input label="Descripción (opcional, hasta 300)" maxLength={300} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />

            <div className="flex flex-col gap-2">
              <label htmlFor="tipo-promocion" className="font-mono text-xs font-bold tracking-[0.72px] uppercase">
                Tipo de descuento
              </label>
              <select
                id="tipo-promocion"
                className="min-h-12 w-full border-2 border-border bg-bg px-3 text-[15px] text-text"
                value={f.tipo}
                onChange={(e) => setF({ ...f, tipo: e.target.value as TipoDescuento, valor: "" })}
              >
                {(Object.keys(TIPO_TEXTO) as TipoDescuento[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_TEXTO[t]}
                  </option>
                ))}
              </select>
            </div>

            {f.tipo !== "DOS_POR_UNO" ? (
              <Input
                label={f.tipo === "PORCENTAJE" ? "Porcentaje (mayor que 0 y hasta 100)" : "Monto del descuento"}
                type="number"
                inputMode="decimal"
                min={0.01}
                max={f.tipo === "PORCENTAJE" ? 100 : undefined}
                step="0.01"
                required
                value={f.valor}
                onChange={(e) => setF({ ...f, valor: e.target.value })}
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Vigente desde" type="date" required value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
              <Input label="Vigente hasta (opcional)" type="date" min={f.desde || undefined} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="font-mono text-xs font-bold tracking-[0.72px] uppercase">Días de la semana (sin marcar = todos)</legend>
              <div className="flex flex-wrap gap-3">
                {DIAS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1.5 text-[13px]">
                    <input type="checkbox" checked={f.dias.includes(i)} onChange={() => alternarDia(i)} />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={pendiente} disabled={pendiente}>
                Guardar
              </Button>
              <Button type="button" variant="secondary" disabled={pendiente} onClick={() => setEditando(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {promociones.length === 0 && editando === null ? (
        <Card className="p-6">
          <p className="text-[14px]">Todavía no tienes promociones. Crea la primera para atraer clientes en una fecha o servicio que quieras mover.</p>
        </Card>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {promociones.map((p) => {
            const e = estadoDe(p);
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[16px] font-bold">{p.titulo}</h2>
                    <Badge>{e.texto}</Badge>
                  </div>
                  <p className="text-[13.5px] font-bold">{resumenValor(p)}</p>
                  {p.descripcion ? <p className="text-[13px] text-text-muted">{p.descripcion}</p> : null}
                  <p className="sn-meta">
                    Del {p.vigenteDesde}
                    {p.vigenteHasta ? ` al ${p.vigenteHasta}` : " sin fecha de fin"}
                    {p.diasSemana?.length ? ` · ${p.diasSemana.map((d) => DIAS[d]).join(", ")}` : " · todos los días"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={pendiente} onClick={() => abrirEdicion(p)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendiente}
                      onClick={() => ejecutar(() => cambiarEstadoPromocion(p.id, !p.activa), p.activa ? "Promoción pausada." : "Promoción activada.")}
                    >
                      {p.activa ? "Pausar" : "Activar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendiente}
                      onClick={() => {
                        setPromoAEliminar(p.id);
                        setConfirmOpen(true);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmarEliminar}
        onCancel={handleCancelarEliminar}
        title="Confirmar eliminación"
        description="¿Eliminar la promoción? Quedará registrada en tu historial."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
      />

      <section aria-labelledby="historial-promos">
        <h2 id="historial-promos" className="sn-label mb-2">
          Historial reciente
        </h2>
        {historial.length === 0 ? (
          <p className="sn-meta">Aún no hay movimientos.</p>
        ) : (
          <ul className="m-0 list-disc space-y-1 pl-5 text-[13px]">
            {historial.map((h) => (
              <li key={h.id}>
                {ACCION_TEXTO[h.accion] ?? h.accion}
                {h.titulo ? ` · ${h.titulo}` : ""} · {new Date(h.fecha).toLocaleString("es-CO")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
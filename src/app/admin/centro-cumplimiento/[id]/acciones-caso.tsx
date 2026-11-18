"use client";

import { Caja, TituloCaja } from "@/app/admin/_componentes/ui-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ejecutarAccion, urlAdjunto, type AccionCaso } from "../actions";

const campo = "min-h-10 w-full border-2 border-border bg-bg px-2 py-1.5 text-sm";
const btn = "border-2 border-ink bg-signal px-3 py-1.5 font-mono text-[11px] font-bold uppercase disabled:opacity-50";
const btnSec = "border-2 border-border px-3 py-1.5 font-mono text-[11px] font-bold uppercase hover:bg-text hover:text-bg disabled:opacity-50";

export function BotonAdjunto({ id, nombre }: { id: string; nombre: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="underline"
        onClick={async () => {
          setError(null);
          const r = await urlAdjunto(id);
          if (!r.ok) return setError(r.error);
          window.open(r.data, "_blank", "noopener,noreferrer");
        }}
      >
        {nombre}
      </button>
      {error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}
    </>
  );
}

/** Acciones del caso. Cada botón llama a una Server Action que exige SuperSU y a una RPC que lo vuelve a exigir en la base. */
export function AccionesCaso({ id, miId, estado, critico, sinProrroga }: { id: string; miId: string; estado: string; critico: boolean; sinProrroga: boolean }) {
  const router = useRouter();
  const [pend, iniciar] = useTransition();
  const [texto, setTexto] = useState("");
  const [extra, setExtra] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const cerrado = estado === "CERRADO" || estado === "DESISTIDO";
  const cerrable = ["RESUELTO", "DESISTIDO", "TRASLADADO"].includes(estado);
  const reabrible = ["CERRADO", "DESISTIDO", "RESUELTO", "TRASLADADO"].includes(estado);

  function correr(a: AccionCaso, limpiar = true) {
    setAviso(null);
    iniciar(async () => {
      const r = await ejecutarAccion(id, a);
      if (!r.ok) return setAviso(r.error);
      const c = "data" in r ? r.data.correo : undefined;
      setAviso(c === "enviado" ? "Hecho. Se envió el correo al solicitante." : c === "fallido" ? "Hecho, pero el correo al solicitante NO salió (revisa Notificaciones)." : c === "sin_correo" ? "Hecho. El caso no tiene correo de contacto." : "Hecho.");
      if (limpiar) { setTexto(""); setExtra(""); }
      router.refresh();
    });
  }

  return (
    <Caja className="mt-6" destacada>
      <TituloCaja>Acciones</TituloCaja>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <button className={btnSec} disabled={pend || cerrado} onClick={() => correr({ tipo: "asignar", responsable: miId }, false)}>Asignarme</button>
          <button className={btnSec} disabled={pend || cerrado} onClick={() => correr({ tipo: "asignar", responsable: null }, false)}>Dejar sin asignar</button>
          <button className={btnSec} disabled={pend || cerrado} onClick={() => correr({ tipo: "estado", estado: "EN_REVISION" }, false)}>En revisión</button>
          <button className={btnSec} disabled={pend || cerrado} onClick={() => correr({ tipo: "estado", estado: "EN_GESTION" }, false)}>En gestión</button>
          <button className={btnSec} disabled={pend || cerrado} onClick={() => correr({ tipo: "estado", estado: "ESPERANDO_TERCERO" }, false)}>Esperando a un tercero</button>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-[11px] font-bold uppercase" htmlFor="txt">Texto (respuesta, requerimiento, motivo o nota)</label>
          <textarea id="txt" className={campo} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <input className={campo} placeholder="Destino del traslado / resultado / nota de cierre (según la acción)" value={extra} onChange={(e) => setExtra(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={pend || cerrado || texto.trim().length < 5} onClick={() => correr({ tipo: "responder", mensaje: texto, sustantiva: true })}>Enviar respuesta de fondo</button>
            <button className={btnSec} disabled={pend || cerrado || texto.trim().length < 5} onClick={() => correr({ tipo: "responder", mensaje: texto, sustantiva: false })}>Enviar mensaje (no es la respuesta)</button>
            <button className={btnSec} disabled={pend || cerrado || texto.trim().length < 10} onClick={() => correr({ tipo: "subsanacion", mensaje: texto })}>Pedir información (incompleto)</button>
            <button className={btnSec} disabled={pend || cerrado || sinProrroga || texto.trim().length < 15} onClick={() => correr({ tipo: "prorroga", motivo: texto })} title={sinProrroga ? "Este tipo no tiene ampliación de plazo definida" : ""}>Ampliar plazo</button>
            <button className={btnSec} disabled={pend || cerrado || extra.trim().length < 3 || texto.trim().length < 10} onClick={() => correr({ tipo: "trasladar", destino: extra, motivo: texto })}>Trasladar</button>
            <button className={btnSec} disabled={pend || cerrado || texto.trim().length < 5} onClick={() => correr({ tipo: "escalar", motivo: texto })}>Escalar</button>
            <button className={btnSec} disabled={pend || texto.trim().length < 2} onClick={() => correr({ tipo: "nota", nota: texto })}>Añadir nota interna</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <button className={btn} disabled={pend || estado === "CERRADO" || extra.trim().length < 10} onClick={() => correr({ tipo: "resolver", resultado: extra })}>Resolver (usa el campo de resultado)</button>
          <button className={btn} disabled={pend || !cerrable} onClick={() => correr({ tipo: "cerrar", nota: extra || undefined })}>Cerrar{critico ? " (exige nota de cierre)" : ""}</button>
          <button className={btnSec} disabled={pend || !reabrible || texto.trim().length < 10} onClick={() => correr({ tipo: "reabrir", motivo: texto })}>Reabrir</button>
        </div>
        <p className="text-xs text-text-muted">Responder no es resolver ni cerrar: para resolver hace falta una respuesta de fondo previa; para cerrar, que el caso esté resuelto.</p>
        {aviso ? <p role="status" className="text-sm">{aviso}</p> : null}
      </div>
    </Caja>
  );
}

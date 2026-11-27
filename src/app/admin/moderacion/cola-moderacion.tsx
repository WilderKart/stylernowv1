"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useState } from "react";
import { moderarResena, type ResenaModeracion } from "../actions";

export function ColaModeracion({ resenasIniciales, errorInicial }: { resenasIniciales: ResenaModeracion[]; errorInicial: string | null }) {
  const [resenas, setResenas] = useState(resenasIniciales);
  const [error, setError] = useState(errorInicial);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ id: string; accion: "MANTENER" | "ELIMINAR"; motivo: string } | null>(null);

  function onModerar(resenaId: string, accion: "MANTENER" | "ELIMINAR") { setDialogo({ id: resenaId, accion, motivo: "" }); }
  async function confirmarModerar() {
    if (!dialogo) return;
    setAccionando(dialogo.id); setError(null);
    const res = await moderarResena(dialogo.id, dialogo.accion, dialogo.motivo.trim() || undefined);
    setAccionando(null);
    if (!res.ok) return setError(res.error);
    setResenas((prev) => prev.filter((r) => r.id !== dialogo.id));
    setDialogo(null);
  }

  if (error) {
    return <p className="text-[12.5px] font-semibold text-danger">{error}</p>;
  }

  if (resenas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
        No hay reseñas reportadas pendientes de moderar.
      </p>
    );
  }

  return (
    <>
    {dialogo ? (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5"><p className="text-[14px] font-bold text-text">{dialogo.accion==="ELIMINAR"?"Eliminar rese?a":"Mantener rese?a"}</p><label className="mt-3 block text-[11px] font-semibold text-text-faint">Motivo (opcional)<textarea value={dialogo.motivo} onChange={(e)=>setDialogo({...dialogo,motivo:e.target.value})} className="mt-1 min-h-[72px] w-full rounded-xl border border-border bg-bg p-2.5 text-[12.5px] text-text outline-none" maxLength={300}/></label><div className="mt-4 flex gap-2 justify-end"><Button size="sm" variant="ghost" onClick={()=>setDialogo(null)}>Cancelar</Button><Button size="sm" variant={dialogo.accion==="ELIMINAR"?"danger":"primary"} loading={accionando===dialogo.id} onClick={confirmarModerar}>Confirmar</Button></div></div></div>) : null}
    <ul className="flex flex-col gap-2.5">
      {resenas.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-text">
              {r.clienteNombre} → {r.negocioNombre}
            </p>
            <Badge tone="accent">{"★".repeat(r.calificacion)}</Badge>
          </div>
          {r.comentario ? <p className="mt-1.5 text-[12.5px] text-text-muted">{r.comentario}</p> : null}
          <p className="mt-1 text-[11px] text-text-faint">{new Date(r.createdAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" loading={accionando === r.id} onClick={() => onModerar(r.id, "MANTENER")}>
              Mantener
            </Button>
            <Button size="sm" variant="danger" loading={accionando === r.id} onClick={() => onModerar(r.id, "ELIMINAR")}>
              Eliminar
            </Button>
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}

"use client";

import { Ban, LogOut, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cerrarSesionesUsuario, reactivarUsuario, suspenderUsuario } from "../actions";

type Accion = "suspender" | "reactivar" | "sesiones";

const TEXTOS: Record<Accion, { titulo: string; ayuda: string; boton: string }> = {
  suspender: {
    titulo: "Suspender cuenta",
    ayuda: "La persona no podrá volver a entrar y se cierran sus sesiones. Sus datos no se borran y puedes reactivarla.",
    boton: "Confirmar suspensión",
  },
  reactivar: { titulo: "Reactivar cuenta", ayuda: "La persona podrá volver a entrar con su correo.", boton: "Confirmar reactivación" },
  sesiones: {
    titulo: "Cerrar todas sus sesiones",
    ayuda: "Se cierra la sesión en todos sus dispositivos; podrá volver a entrar normalmente.",
    boton: "Cerrar sesiones",
  },
};

/** Acciones sobre la cuenta con confirmación en línea (sin diálogos del navegador) y motivo obligatorio para la auditoría. */
export function AccionesUsuario({ usuarioId, suspendido, bloqueado }: { usuarioId: string; suspendido: boolean; bloqueado: string | null }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<Accion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (bloqueado) {
    return <p className="px-4 py-4 text-[13px] text-text-muted sm:px-5">{bloqueado}</p>;
  }

  const ejecutar = () =>
    iniciar(async () => {
      setError(null);
      const fn = abierta === "suspender" ? suspenderUsuario : abierta === "reactivar" ? reactivarUsuario : cerrarSesionesUsuario;
      const r = await fn(usuarioId, motivo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAviso(abierta === "suspender" ? "Cuenta suspendida." : abierta === "reactivar" ? "Cuenta reactivada." : "Sesiones cerradas.");
      setAbierta(null);
      setMotivo("");
      router.refresh();
    });

  const botones: { id: Accion; icono: typeof Ban; etiqueta: string; peligro?: boolean }[] = [
    suspendido
      ? { id: "reactivar", icono: RotateCcw, etiqueta: "Reactivar cuenta" }
      : { id: "suspender", icono: Ban, etiqueta: "Suspender cuenta", peligro: true },
    { id: "sesiones", icono: LogOut, etiqueta: "Cerrar sesiones" },
  ];

  return (
    <div className="px-4 pb-4 pt-3 sm:px-5">
      {aviso && <p className="mb-3 border-2 border-success bg-success-soft px-3 py-2 text-[13px] font-semibold text-text">{aviso}</p>}
      {!abierta ? (
        <div className="flex flex-wrap gap-2">
          {botones.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setAbierta(b.id);
                setAviso(null);
                setError(null);
              }}
              className={`flex min-h-11 items-center gap-2 border-2 px-3.5 py-2 text-[13px] font-semibold ${
                b.peligro ? "border-danger text-danger hover:bg-danger hover:text-white" : "border-border text-text hover:bg-text hover:text-bg"
              }`}
            >
              <b.icono className="size-4" aria-hidden />
              {b.etiqueta}
            </button>
          ))}
        </div>
      ) : (
        <div className="border-2 border-border p-3.5">
          <p className="text-[14px] font-bold text-text">{TEXTOS[abierta].titulo}</p>
          <p className="mt-1 text-[12.5px] text-text-muted">{TEXTOS[abierta].ayuda}</p>
          <label className="mt-3 block text-[12px] font-semibold text-text" htmlFor="motivo-accion">
            Motivo (queda en la auditoría)
          </label>
          <textarea
            id="motivo-accion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={300}
            className="mt-1 w-full border-2 border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:border-accent"
            placeholder="Ej.: reporte de suplantación verificado por soporte"
          />
          {error && <p className="mt-2 text-[12.5px] font-semibold text-danger">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pendiente || motivo.trim().length < 5}
              onClick={ejecutar}
              className={`min-h-11 px-4 font-mono text-[12px] font-bold uppercase text-white disabled:opacity-50 ${
                abierta === "suspender" ? "bg-danger" : "bg-accent"
              }`}
            >
              {pendiente ? "Aplicando…" : TEXTOS[abierta].boton}
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                setAbierta(null);
                setMotivo("");
                setError(null);
              }}
              className="min-h-11 border-2 border-border px-4 text-[13px] font-semibold text-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

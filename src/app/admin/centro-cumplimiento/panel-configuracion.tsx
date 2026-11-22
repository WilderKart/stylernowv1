"use client";

import { useState, useTransition } from "react";
import { guardarConfiguracion, type ConfigVista } from "./actions";

/**
 * Destinatarios y SMS editables desde el CRM (sin tocar código). La base valida cada valor y registra el cambio en auditoría.
 * El SMS no se puede encender sin proveedor y referencia de credenciales (el secreto vive en variables de entorno, nunca aquí).
 */
export function PanelConfiguracion({ config }: { config: ConfigVista }) {
  const [emails, setEmails] = useState((config.alertas_email_destinatarios ?? []).join(", "));
  const [atencion, setAtencion] = useState(config.correo_atencion ?? "");
  const [operativo, setOperativo] = useState(config.correo_operativo ?? "");
  const [remitente, setRemitente] = useState(config.correo_remitente ?? "");
  const [celular, setCelular] = useState(config.sms_numero ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pend, iniciar] = useTransition();

  function guardar(clave: string, valor: unknown) {
    setAviso(null);
    iniciar(async () => {
      const r = await guardarConfiguracion(clave, valor);
      setAviso(r.ok ? "Guardado." : r.error);
    });
  }
  const campo = "min-h-10 w-full border-2 border-border bg-bg px-2 text-sm";
  const fila = "flex flex-col gap-1";
  const btn = "self-start border-2 border-ink bg-signal px-3 py-1.5 font-mono text-[11px] font-bold uppercase disabled:opacity-50";

  return (
    <div className="space-y-4 p-4 text-sm">
      <div className={fila}>
        <label className="font-mono text-[11px] font-bold uppercase">Correos que reciben las alertas (separados por coma)</label>
        <input className={campo} value={emails} onChange={(e) => setEmails(e.target.value)} />
        <button className={btn} disabled={pend} onClick={() => guardar("alertas_email_destinatarios", emails.split(",").map((x) => x.trim()).filter(Boolean))}>Guardar destinatarios</button>
      </div>
      <div className={fila}>
        <label className="font-mono text-[11px] font-bold uppercase">Correo de atención al usuario</label>
        <input className={campo} value={atencion} onChange={(e) => setAtencion(e.target.value)} />
        <button className={btn} disabled={pend} onClick={() => guardar("correo_atencion", atencion.trim())}>Guardar</button>
      </div>
      <div className={fila}>
        <label className="font-mono text-[11px] font-bold uppercase">Correo de notificaciones operativas</label>
        <input className={campo} value={operativo} onChange={(e) => setOperativo(e.target.value)} />
        <button className={btn} disabled={pend} onClick={() => guardar("correo_operativo", operativo.trim())}>Guardar</button>
      </div>
      <div className={fila}>
        <label className="font-mono text-[11px] font-bold uppercase">Remitente de los correos</label>
        <input className={campo} value={remitente} onChange={(e) => setRemitente(e.target.value)} />
        <button className={btn} disabled={pend} onClick={() => guardar("correo_remitente", remitente.trim())}>Guardar remitente</button>
      </div>
      <div className={fila}>
        <label className="font-mono text-[11px] font-bold uppercase">Celular para SMS (con indicativo)</label>
        <input className={campo} value={celular} onChange={(e) => setCelular(e.target.value)} />
        <button className={btn} disabled={pend} onClick={() => guardar("sms_numero", celular.trim())}>Guardar celular</button>
        <p className="text-xs text-text-muted">
          Estado del SMS: <strong>{config.sms_habilitado ? "habilitado" : "deshabilitado"}</strong>
          {config.sms_proveedor ? ` · proveedor ${config.sms_proveedor}` : " · sin proveedor"}. Se habilita cuando exista un proveedor y sus credenciales (variable de entorno).
        </p>
      </div>
      {aviso ? <p role="status" className="text-xs">{aviso}</p> : null}
    </div>
  );
}

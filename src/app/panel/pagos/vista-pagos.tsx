"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmar } from "@/components/ui/confirmar";
import { comprimirADataUrl } from "@/lib/imagen/comprimir";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  anularCitaPorPago, guardarMediosPago, marcarPagoNoRecibido, quitarQrPago, subirQrPago, verificarPago,
  type MediosPago, type PagoPorRevisar,
} from "./actions";

const CAMPO = "h-10 w-full border-2 border-border bg-bg px-3 text-[14px] text-text outline-none focus:border-accent";

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function TarjetaPago({ pago, alCambiar }: { pago: PagoPorRevisar; alCambiar: () => void }) {
  const [modo, setModo] = useState<null | "anular" | "no_recibido">(null);
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const completada = pago.estadoReserva === "COMPLETADA";
  const confirmada = pago.estadoReserva === "CONFIRMADA";

  function verificar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await verificarPago(pago.id);
      if (!r.ok) return setMensaje(r.error);
      alCambiar();
    });
  }

  function ejecutarConMotivo() {
    setMensaje(null);
    if (motivo.trim().length < 10) return setMensaje("Escribe un motivo de al menos 10 caracteres.");
    iniciar(async () => {
      const texto =
        modo === "anular"
          ? "Vas a CANCELAR la cita por pago no verificado. El cliente será notificado y el cupo queda libre. ¿Continuar?"
          : "Vas a marcar el pago como NO RECIBIDO. El monto se sumará al saldo pendiente del cliente en tu negocio. ¿Continuar?";
      if (!(await confirmar(texto, { titulo: modo === "anular" ? "Anular cita" : "Marcar no recibido", confirmar: "Sí, continuar" }))) return;
      const r = modo === "anular" ? await anularCitaPorPago(pago.reservaId, motivo) : await marcarPagoNoRecibido(pago.id, motivo);
      if (!r.ok) return setMensaje(r.error);
      alCambiar();
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold">{pago.clienteNombre}</p>
          <p className="sn-meta">
            Cita: {fechaHora(pago.horaInicio)} · {completada ? "Ya completada" : confirmada ? "Confirmada" : pago.estadoReserva}
          </p>
        </div>
        <div className="text-right">
          <p className="sn-price">{formatCOP(pago.montoReportado)}</p>
          <p className="sn-meta">
            Esperado: {formatCOP(pago.montoEsperado)}
            {pago.referencia ? ` · ${pago.referencia}` : ""}
          </p>
        </div>
      </div>
      {pago.montoReportado !== pago.montoEsperado ? (
        <p className="border-l-4 border-accent bg-accent-soft px-3 py-1.5 text-[12.5px]">
          El monto reportado {pago.montoReportado < pago.montoEsperado ? "es menor" : "es distinto"} al anticipo esperado. Compáralo con tu extracto.
        </p>
      ) : null}
      {pago.comprobanteUrl ? (
        <a href={pago.comprobanteUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir comprobante en grande">
          {/* eslint-disable-next-line @next/next/no-img-element -- comprobante privado con URL firmada temporal */}
          <img src={pago.comprobanteUrl} alt={`Comprobante de ${pago.clienteNombre}`} className="max-h-[28rem] w-full border-2 border-border object-contain" />
        </a>
      ) : (
        <p className="text-[13px] text-text-muted">No pudimos cargar la imagen del comprobante.</p>
      )}

      {modo ? (
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold" htmlFor={`motivo-${pago.id}`}>
            {modo === "anular" ? "¿Por qué anulas la cita? (obligatorio)" : "¿Por qué marcas el pago como no recibido? (obligatorio)"}
          </label>
          <textarea
            id={`motivo-${pago.id}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={300}
            className="w-full border-2 border-border bg-bg p-3 text-[14px] text-text outline-none focus:border-accent"
            placeholder="Ej.: el dinero no aparece en mi cuenta de Nequi"
          />
          <div className="flex gap-2">
            <Button variant="secondary" disabled={pendiente} onClick={() => { setModo(null); setMotivo(""); setMensaje(null); }}>
              Cancelar
            </Button>
            <Button loading={pendiente} disabled={pendiente} onClick={ejecutarConMotivo}>
              {modo === "anular" ? "Anular cita" : "Marcar no recibido"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button loading={pendiente} disabled={pendiente} onClick={verificar}>Verificar (llegó el dinero)</Button>
          {confirmada ? <Button variant="secondary" disabled={pendiente} onClick={() => setModo("anular")}>Anular cita</Button> : null}
          {completada ? <Button variant="secondary" disabled={pendiente} onClick={() => setModo("no_recibido")}>Marcar no recibido</Button> : null}
        </div>
      )}
      {mensaje ? <p role="alert" className="text-[13px] font-semibold text-danger">{mensaje}</p> : null}
    </Card>
  );
}

function FormMedios({ medios }: { medios: MediosPago }) {
  const router = useRouter();
  const [f, setF] = useState({ ...medios });
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof MediosPago, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarMediosPago({ activo: f.activo, llaveBreb: f.llaveBreb, nequi: f.nequi, daviplata: f.daviplata, linkPago: f.linkPago, instrucciones: f.instrucciones });
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje({ tipo: "ok", texto: "Medios de pago guardados." });
      router.refresh();
    });
  }

  async function elegirQr(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje(null);
    const c = await comprimirADataUrl(archivo, "media");
    if (!c.ok) return setMensaje({ tipo: "error", texto: c.error });
    iniciar(async () => {
      const r = await subirQrPago(c.data);
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje({ tipo: "ok", texto: "QR actualizado." });
      router.refresh();
    });
  }

  function quitarQr() {
    iniciar(async () => {
      if (!(await confirmar("¿Quitar el código QR de pago?", { confirmar: "Quitar" }))) return;
      const r = await quitarQrPago();
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center gap-3 text-[14px] font-semibold">
        <input type="checkbox" className="size-5" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} />
        Recibir anticipos por transferencia directa
      </label>
      <p className="sn-meta">
        El cliente te paga directo a tu cuenta y sube el comprobante; su cita queda agendada al instante. StylerNow no custodia ni valida transferencias.
        El valor del anticipo lo defines en «Anticipo y cancelaciones».
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Llave Bre-B
          <input className={CAMPO} value={f.llaveBreb} maxLength={60} onChange={(e) => set("llaveBreb", e.target.value)} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Nequi
          <input className={CAMPO} value={f.nequi} maxLength={30} onChange={(e) => set("nequi", e.target.value)} inputMode="tel" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Daviplata
          <input className={CAMPO} value={f.daviplata} maxLength={30} onChange={(e) => set("daviplata", e.target.value)} inputMode="tel" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Link de pago (https://…)
          <input className={CAMPO} value={f.linkPago} maxLength={300} onChange={(e) => set("linkPago", e.target.value)} inputMode="url" autoComplete="off" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Instrucciones para el cliente (opcional)
        <textarea
          className="w-full border-2 border-border bg-bg p-3 text-[14px] text-text outline-none focus:border-accent"
          rows={2}
          maxLength={500}
          value={f.instrucciones}
          onChange={(e) => set("instrucciones", e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Código QR de pago</span>
        {f.qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- QR privado con URL firmada temporal
          <img src={f.qrUrl} alt="Tu código QR de pago" className="size-40 border-2 border-border object-contain" />
        ) : (
          <p className="text-[13px] text-text-muted">Aún no has cargado un QR.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center border-2 border-border px-3 py-2 font-mono text-[11px] font-bold uppercase hover:bg-text hover:text-bg">
            {f.qrUrl ? "Cambiar QR" : "Subir QR"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={pendiente}
              onChange={(e) => {
                void elegirQr(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {f.qrUrl ? <Button type="button" variant="secondary" disabled={pendiente} onClick={quitarQr}>Quitar QR</Button> : null}
        </div>
      </div>

      {mensaje ? (
        <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`text-[13px] font-semibold ${mensaje.tipo === "error" ? "text-danger" : "text-text"}`}>
          {mensaje.texto}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={pendiente} disabled={pendiente}>Guardar medios de pago</Button>
      </div>
    </form>
  );
}

export function VistaPagos({ medios, errorMedios, pagos, errorPagos }: {
  medios: MediosPago | null; errorMedios: string | null; pagos: PagoPorRevisar[]; errorPagos: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4" aria-labelledby="titulo-revisar">
        <header>
          <h1 id="titulo-revisar" className="section">Pagos por revisar ({pagos.length})</h1>
          <p className="sn-meta mt-1">
            Las citas ya están agendadas. Verifica que el dinero llegó a tu cuenta; si no, anula la cita (antes de que ocurra) o márcalo como no recibido
            (después): el monto queda como saldo pendiente del cliente solo en tu negocio.
          </p>
        </header>
        {errorPagos ? <p role="alert" className="text-danger">{errorPagos}</p> : null}
        {pagos.length === 0 && !errorPagos ? (
          <p className="border-2 border-dashed border-border p-6 text-center text-[13px] text-text-muted">No tienes pagos pendientes de revisar.</p>
        ) : null}
        {pagos.map((p) => (
          <TarjetaPago key={p.id} pago={p} alCambiar={() => router.refresh()} />
        ))}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="titulo-medios">
        <h2 id="titulo-medios" className="section">Tus medios de pago</h2>
        {errorMedios ? <p role="alert" className="text-danger">{errorMedios}</p> : null}
        {medios ? <FormMedios medios={medios} /> : null}
      </section>
    </div>
  );
}

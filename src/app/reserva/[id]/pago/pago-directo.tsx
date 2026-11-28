"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { comprimirComprobante, sha256Hex } from "@/lib/imagen/comprimir";
import { AVISO_PAGO_DIRECTO_SIN_REEMBOLSO } from "@/lib/pagos-directos/aviso";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Check, CircleDollarSign, Copy, ImageDown, Landmark, Layers, Link2, Paperclip, Smartphone, Tag, Wallet } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { registrarPagoDirecto } from "./actions";

export interface MediosDirectosVista {
  llaveBreb: string | null;
  nequi: string | null;
  daviplata: string | null;
  linkPago: string | null;
  instrucciones: string | null;
  referencia: string;
  qrUrl: string | null;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Celda compacta de «Datos de pago»: icono o logo + valor + botón de copiar en un toque. */
function CeldaCopiar({ etiqueta, valor, icono }: { etiqueta: string; valor: string; icono: React.ReactNode }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 border-2 border-ink px-2 py-2">
      <span className="flex h-7 min-w-7 flex-none items-center justify-center" aria-hidden="true">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="sn-meta m-0 text-[10px] uppercase">{etiqueta}</p>
        <p className="m-0 text-[14px] leading-tight font-bold tabular-nums break-all">{valor}</p>
      </div>
      <button
        type="button"
        className="grid size-9 flex-none place-items-center border-0 bg-transparent hover:bg-ink hover:text-paper"
        onClick={async () => {
          setCopiado(await copiar(valor));
          setTimeout(() => setCopiado(false), 2000);
        }}
        aria-label={`Copiar ${etiqueta}`}
      >
        {copiado ? <Check className="size-5 text-[#16a34a]" aria-hidden /> : <Copy className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

/** Tarjeta con título y icono naranja (misma estructura que el resto del paso de pago). */
function Tarjeta({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mx-4 mt-3 border-2 border-ink p-3">
      <div role="heading" aria-level={2} className="m-0 mb-2 flex items-center gap-2 font-mono text-[15px] font-bold text-signal">
        <span className="flex-none" aria-hidden="true">
          {icono}
        </span>
        {titulo}
      </div>
      {children}
    </section>
  );
}

/**
 * Pago directo a la cuenta del negocio: datos para transferir con copiado en un toque, QR descargable y subida del
 * comprobante (comprimido a <300 KB en el navegador y subido directo a Storage, sin pasar por una Server Action).
 * Al registrar el soporte, la cita queda agendada al instante.
 */
export function PagoDirecto({ reservaId, negocioId, montoSena, montoTotal, medios, acepta, onModoChange }: {
  reservaId: string; negocioId: string; montoSena: number; /** Total del servicio: permite pagar todo de una vez. */ montoTotal: number; medios: MediosDirectosVista; acepta: boolean;
  /** Avisa a la pantalla cuando el cliente elige pagar todo o solo el anticipo (para actualizar el resumen de arriba). */
  onModoChange?: (pagaTodo: boolean) => void;
}) {
  const router = useRouter();
  const puedePagarTodo = montoTotal > montoSena;
  const [modo, setModo] = useState<"ANTICIPO" | "TOTAL">("ANTICIPO");
  const aTransferir = Math.round(modo === "TOTAL" ? montoTotal : montoSena);
  const [monto, setMonto] = useState(String(Math.round(montoSena)));
  function elegirModo(m: "ANTICIPO" | "TOTAL") {
    setModo(m);
    setMonto(String(Math.round(m === "TOTAL" ? montoTotal : montoSena)));
    onModoChange?.(m === "TOTAL");
  }
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [estado, setEstado] = useState<"" | "preparando" | "enviando">("");
  const [error, setError] = useState<string | null>(null);

  async function guardarQr() {
    if (!medios.qrUrl) return;
    try {
      const resp = await fetch(medios.qrUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-pago.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      window.open(medios.qrUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function elegir(f: File | undefined) {
    setError(null);
    setArchivo(null);
    if (vista) URL.revokeObjectURL(vista);
    setVista(null);
    if (!f) return;
    setEstado("preparando");
    const c = await comprimirComprobante(f);
    setEstado("");
    if (!c.ok) return setError(c.error);
    setArchivo(c.data);
    setVista(URL.createObjectURL(c.data));
  }

  async function enviar() {
    setError(null);
    const valor = Number(monto.replace(/\D/g, ""));
    if (!archivo) return setError("Sube la captura de tu comprobante.");
    if (!valor || valor < Math.round(montoSena)) return setError(`El monto debe ser al menos ${formatCOP(montoSena)}.`);
    if (!acepta) return setError("Acepta la política de cancelación para continuar.");
    setEstado("enviando");
    try {
      const hash = await sha256Hex(archivo);
      const ext = archivo.type === "image/webp" ? "webp" : "jpg";
      const ruta = `${negocioId}/${reservaId}/${hash.slice(0, 12)}-${Date.now().toString(36)}.${ext}`;
      const { error: eSubida } = await createClient().storage.from("pagos-directos").upload(ruta, archivo, { contentType: archivo.type });
      if (eSubida) throw new Error("subida");
      const r = await registrarPagoDirecto({ reservaId, monto: valor, rutaComprobante: ruta, hashComprobante: hash, aceptaPolitica: acepta });
      if (!r.ok) {
        setEstado("");
        return setError(r.mensaje);
      }
      router.replace(`/reserva/${reservaId}`);
    } catch {
      setEstado("");
      setError("No pudimos subir tu comprobante. Revisa tu conexión e intenta de nuevo.");
    }
  }

  const ocupado = estado !== "";
  const opciones: { id: "ANTICIPO" | "TOTAL"; titulo: string; monto: number }[] = [
    { id: "ANTICIPO" as const, titulo: "Solo anticipo", monto: montoSena },
    ...(puedePagarTodo ? [{ id: "TOTAL" as const, titulo: "Pago total", monto: montoTotal }] : []),
  ];
  return (
    <>
      {puedePagarTodo ? (
        <Tarjeta icono={<Wallet className="size-6" />} titulo="Método de pago">
          <div role="radiogroup" aria-label="¿Cuánto quieres pagar ahora?" className="flex flex-col gap-1.5">
            {opciones.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={modo === o.id}
                disabled={ocupado}
                onClick={() => elegirModo(o.id)}
                className={`flex min-h-12 items-center gap-3 border-2 px-3 text-left ${modo === o.id ? "border-ink bg-signal text-ink" : "border-border"}`}
              >
                <span className="grid size-5 flex-none place-items-center rounded-full border-2 border-current" aria-hidden="true">
                  {modo === o.id ? <span className="size-2.5 rounded-full bg-current" /> : null}
                </span>
                <span className="flex-1 text-[16px] font-bold">{o.titulo}</span>
                <span className="text-[16px] font-bold tabular-nums">{formatCOP(o.monto)}</span>
              </button>
            ))}
          </div>
          <p className="sn-meta m-0 mt-2">{modo === "TOTAL" ? "Sin saldo pendiente en el local." : "El resto lo pagas en el local."}</p>
        </Tarjeta>
      ) : null}

      <Tarjeta icono={<Layers className="size-6" />} titulo="Datos de pago">
        <p className="m-0 mb-2 text-[13px]">
          Transfiere <b>{formatCOP(aTransferir)}</b> a la cuenta del negocio y sube tu comprobante. Tu cita queda agendada al instante; el negocio confirma después que el dinero llegó.
        </p>
        <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
          {medios.llaveBreb ? (
            <CeldaCopiar etiqueta="Llave Bre-B" valor={medios.llaveBreb} icono={<Image src="/pagos/breb.webp" alt="" width={48} height={24} className="h-6 w-auto" />} />
          ) : null}
          {medios.nequi ? (
            <CeldaCopiar etiqueta="Nequi" valor={medios.nequi} icono={<Image src="/pagos/nequi.webp" alt="" width={28} height={28} className="size-7" />} />
          ) : null}
          {medios.daviplata ? <CeldaCopiar etiqueta="Daviplata" valor={medios.daviplata} icono={<Smartphone className="size-6" />} /> : null}
          <CeldaCopiar etiqueta="Monto exacto" valor={String(aTransferir)} icono={<CircleDollarSign className="size-6" />} />
          {medios.referencia ? <CeldaCopiar etiqueta="Referencia" valor={medios.referencia} icono={<Tag className="size-6" />} /> : null}
        </div>
        {medios.linkPago || medios.qrUrl ? (
          <div className="mt-3 flex items-stretch gap-3 border-t-2 border-border pt-3">
            {medios.linkPago ? (
              <a
                href={medios.linkPago}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 flex-1 items-center justify-center gap-2 self-center border-2 border-ink px-2 text-center text-[14px] font-bold"
              >
                <Link2 className="size-5 flex-none" aria-hidden />
                Abrir link de pago
              </a>
            ) : null}
            {medios.qrUrl ? (
              <div className="flex flex-1 items-center gap-2 border-l-2 border-border pl-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR privado con URL firmada temporal */}
                <img src={medios.qrUrl} alt="Código QR de pago del negocio" className="size-24 flex-none border-2 border-signal object-contain p-1" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="poster-5 text-[14px] leading-tight uppercase">Escanea el QR</span>
                  <button type="button" onClick={guardarQr} className="flex items-center gap-1.5 border-2 border-ink px-2 py-1.5 text-left text-[11px] leading-tight font-bold uppercase">
                    <ImageDown className="size-5 flex-none" aria-hidden />
                    Guardar en galería
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {medios.instrucciones ? <p className="m-0 mt-3 border-l-4 border-accent bg-accent-soft px-3 py-2 text-[13px]">{medios.instrucciones}</p> : null}
      </Tarjeta>

      <Tarjeta icono={<Landmark className="size-6" />} titulo="Confirma tu pago">
        <div className="grid grid-cols-2 items-end gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-[12px] font-bold">
            Monto transferido (COP)
            <input
              className="h-11 w-full border-2 border-ink bg-bg px-3 text-[16px] font-bold tabular-nums text-text outline-none focus:border-accent"
              inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} disabled={ocupado}
            />
          </label>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1 text-[12px] font-bold">
              <Paperclip className="size-4 flex-none text-signal" aria-hidden />
              Comprobante
            </span>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-1.5 border-2 border-ink px-2 text-[12px] font-bold">
              <ImageDown className="size-5 flex-none" aria-hidden />
              <span className="truncate">{archivo ? "Cambiar archivo" : "Seleccionar archivo"}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado} onChange={(e) => void elegir(e.target.files?.[0])} className="sr-only" />
            </label>
          </div>
        </div>
        {estado === "preparando" ? <p role="status" className="m-0 mt-2 text-[13px]">Preparando la imagen…</p> : null}
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local del comprobante
          <img src={vista} alt="Vista previa de tu comprobante" className="mt-2 max-h-60 w-full border-2 border-border object-contain" />
        ) : null}
        {error ? <div className="mt-2"><ErrorAviso>{error}</ErrorAviso></div> : null}
        <Button size="lg" className="mt-3 w-full" loading={estado === "enviando"} disabled={ocupado || !acepta || !archivo} onClick={enviar}>
          Ya pagué · agendar mi cita
        </Button>
        <p className="sn-meta m-0 mt-2">
          El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias.
        </p>
        <p className="sn-meta m-0 mt-1">{AVISO_PAGO_DIRECTO_SIN_REEMBOLSO}</p>
      </Tarjeta>
    </>
  );
}

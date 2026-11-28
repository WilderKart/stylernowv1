"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { comprimirComprobante, sha256Hex } from "@/lib/imagen/comprimir";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, CircleDollarSign, Coins, Copy, CreditCard, ImageDown, Layers, Link2, Paperclip, Smartphone, Tag } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { registrarPagoDirecto } from "./actions";
import estilos from "./pago.module.css";

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

/** Celda compacta de «Datos de pago»: logo o icono + valor + botón de copiar en un toque (la etiqueta queda para lectores de pantalla). */
function CeldaCopiar({ etiqueta, valor, icono, ancha }: { etiqueta: string; valor: string; icono: React.ReactNode; /** Ocupa las dos columnas (valores largos que deben verse en una línea). */ ancha?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className={`flex min-w-0 items-center gap-1.5 border-2 border-ink py-1.5 pr-0.5 pl-1.5 ${ancha ? "col-span-2" : ""} ${estilos.r12}`} title={etiqueta}>
      <span className="flex h-7 flex-none items-center justify-center" aria-hidden="true">
        {icono}
      </span>
      <span className="h-5 w-px flex-none bg-ink" aria-hidden="true" />
      <span className="sr-only">{etiqueta}</span>
      <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-tight font-bold tracking-tight whitespace-nowrap tabular-nums">{valor}</p>
      <button
        type="button"
        className="grid size-7 flex-none place-items-center border-0 bg-transparent"
        onClick={async () => {
          setCopiado(await copiar(valor));
          setTimeout(() => setCopiado(false), 2000);
        }}
        aria-label={`Copiar ${etiqueta}`}
      >
        {copiado ? <Check className="size-4 text-[#16a34a]" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** Tarjeta con título y icono naranja (misma estructura que el resto del paso de pago). */
function Tarjeta({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className={`mx-4 mt-3 border-2 border-ink p-3 ${estilos.r16}`}>
      <div role="heading" aria-level={2} className="m-0 mb-2 flex items-center gap-2 text-[18px] leading-tight font-bold text-signal">
        <span className="flex-none" aria-hidden="true">
          {icono}
        </span>
        {titulo}
      </div>
      {children}
    </section>
  );
}

/** «Método de pago»: el cliente elige pagar solo el anticipo o el servicio completo. El estado vive en la pantalla para que el resumen de abajo lo refleje. */
export function SelectorModoPago({ modo, onChange, montoSena, montoTotal, deshabilitado }: {
  modo: "ANTICIPO" | "TOTAL"; onChange: (m: "ANTICIPO" | "TOTAL") => void; montoSena: number; montoTotal: number; deshabilitado?: boolean;
}) {
  const opciones: { id: "ANTICIPO" | "TOTAL"; titulo: string; monto: number }[] = [
    { id: "ANTICIPO", titulo: "Solo anticipo", monto: montoSena },
    { id: "TOTAL", titulo: "Pago total", monto: montoTotal },
  ];
  return (
    <Tarjeta icono={<CreditCard className="size-7" />} titulo="Método de pago">
      <div role="radiogroup" aria-label="¿Cuánto quieres pagar ahora?" className="flex flex-col gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={modo === o.id}
            disabled={deshabilitado}
            onClick={() => onChange(o.id)}
            className={`flex min-h-11 items-center gap-3 border px-3 text-left ${estilos.r8} ${modo === o.id ? "border-signal bg-[#ffd9b8] text-ink" : "border-border bg-bg"}`}
          >
            <span className={`grid size-6 flex-none place-items-center rounded-full border-2 ${modo === o.id ? "border-signal" : "border-ink"}`} aria-hidden="true">
              {modo === o.id ? <span className="size-3 rounded-full bg-signal" /> : null}
            </span>
            <span className="flex-1 text-[17px] font-bold">{o.titulo}</span>
            <span className="font-mono text-[17px] font-bold tabular-nums">{formatCOP(o.monto)}</span>
          </button>
        ))}
      </div>
    </Tarjeta>
  );
}

/**
 * Pago directo a la cuenta del negocio: datos para transferir con copiado en un toque, QR escaneable y descargable y subida del
 * comprobante (comprimido a <300 KB en el navegador y subido directo a Storage, sin pasar por una Server Action).
 * Al registrar el soporte, la cita queda agendada al instante. El botón de agendar es lo último de la pantalla.
 */
export function PagoDirecto({ reservaId, negocioId, montoSena, montoTotal, medios, acepta, aceptaInfo, pagaTodo, onFaltaAceptar }: {
  reservaId: string; negocioId: string; montoSena: number; /** Total del servicio. */ montoTotal: number; medios: MediosDirectosVista; acepta: boolean; /** Chulo de la «Información importante». */ aceptaInfo: boolean;
  /** Modo elegido en «Método de pago»: define cuánto se transfiere. */
  pagaTodo: boolean;
  /** Se llama cuando intentan reservar sin los dos chulos: la pantalla abre las tarjetas y lleva hasta ellas. */
  onFaltaAceptar: () => void;
}) {
  const router = useRouter();
  const aTransferir = Math.round(pagaTodo ? montoTotal : montoSena);
  const [monto, setMonto] = useState(String(aTransferir));
  // Si el cliente cambia entre «solo anticipo» y «pago total», el monto sugerido se actualiza (ajuste de estado durante el render).
  const [previo, setPrevio] = useState(aTransferir);
  if (previo !== aTransferir) {
    setPrevio(aTransferir);
    setMonto(String(aTransferir));
  }
  const [qrGrande, setQrGrande] = useState(false);
  const [qrFallo, setQrFallo] = useState(false);
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
    if (!acepta || !aceptaInfo) return onFaltaAceptar();
    if (!archivo) return setError("Sube la captura de tu comprobante.");
    if (!valor || valor < Math.round(montoSena)) return setError(`El monto debe ser al menos ${formatCOP(montoSena)}.`);
    setEstado("enviando");
    try {
      const hash = await sha256Hex(archivo);
      const ext = archivo.type === "image/webp" ? "webp" : "jpg";
      const ruta = `${negocioId}/${reservaId}/${hash.slice(0, 12)}-${Date.now().toString(36)}.${ext}`;
      const { error: eSubida } = await createClient().storage.from("pagos-directos").upload(ruta, archivo, { contentType: archivo.type });
      if (eSubida) throw new Error("subida");
      const r = await registrarPagoDirecto({ reservaId, monto: valor, rutaComprobante: ruta, hashComprobante: hash, aceptaPolitica: acepta, aceptaInfoPagoDirecto: aceptaInfo });
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
  const deshabilitado = ocupado;
  return (
    <>
      <Tarjeta icono={<Layers className="size-7" />} titulo="Datos de pago">
        <div className="grid grid-cols-2 gap-2">
          {medios.llaveBreb ? (
            <CeldaCopiar ancha etiqueta="Llave Bre-B" valor={medios.llaveBreb} icono={<Image src="/pagos/breb.webp" alt="" width={40} height={20} className="h-5 w-auto" />} />
          ) : null}
          {medios.nequi ? (
            <CeldaCopiar etiqueta="Nequi" valor={medios.nequi} icono={<Image src="/pagos/nequi.webp" alt="" width={24} height={24} className="size-6" />} />
          ) : null}
          {medios.daviplata ? <CeldaCopiar etiqueta="Daviplata" valor={medios.daviplata} icono={<Smartphone className="size-6" />} /> : null}
          <CeldaCopiar etiqueta="Monto exacto" valor={String(aTransferir)} icono={<CircleDollarSign className="size-6" />} />
          {medios.referencia ? <CeldaCopiar etiqueta="Referencia" valor={medios.referencia} icono={<Tag className="size-6" />} /> : null}
        </div>
        {medios.linkPago ? (
          <a
            href={medios.linkPago}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 flex min-h-11 items-center justify-center gap-2 border-2 border-ink px-2 text-center text-[13px] leading-tight font-bold ${estilos.r12}`}
          >
            <Link2 className="size-5 flex-none" aria-hidden />
            Abrir link de pago
          </a>
        ) : null}
        {medios.qrUrl ? (
          <div className={`mt-2 flex items-center gap-3 border-2 border-ink p-2 ${estilos.r12}`}>
            {qrFallo ? (
              <div className={`grid size-32 flex-none place-items-center border-[3px] border-signal bg-white p-2 text-center text-[11px] leading-tight font-bold text-ink ${estilos.r12}`} role="img" aria-label="No se pudo cargar el QR">
                No se pudo cargar el QR. Paga con la llave o el link.
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- QR privado con URL firmada temporal
              <img
                src={medios.qrUrl}
                alt="Código QR de pago del negocio"
                onError={() => setQrFallo(true)}
                className={`size-32 flex-none border-[3px] border-signal bg-white object-contain p-1 ${estilos.r12}`}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-[15px] leading-tight font-black uppercase">Escanea el QR</span>
              {qrFallo ? null : (
                <button type="button" onClick={() => setQrGrande(true)} className="border-0 bg-transparent p-0 text-left text-[12px] font-bold underline">
                  Ampliar QR
                </button>
              )}
              <button
                type="button"
                onClick={guardarQr}
                className={`flex items-center gap-1.5 border-2 border-ink bg-transparent px-2 py-1.5 text-left text-[11px] leading-tight font-bold uppercase ${estilos.r8}`}
              >
                <ImageDown className="size-5 flex-none" aria-hidden />
                Guardar en galería
              </button>
            </div>
          </div>
        ) : null}
        {medios.instrucciones ? <p className="m-0 mt-3 border-l-4 border-accent bg-accent-soft px-3 py-2 text-[13px]">{medios.instrucciones}</p> : null}
      </Tarjeta>

      <Tarjeta icono={<Coins className="size-7" />} titulo="Confirma tu pago">
        <div className="grid grid-cols-2 gap-2">
          <label className={`flex min-w-0 flex-col gap-1 border border-border p-2 text-[12px] font-bold ${estilos.r12}`}>
            Monto a transferir (COP)
            <input
              className={`h-10 w-full border-2 border-ink bg-bg px-2 text-[16px] font-bold tabular-nums text-text outline-none focus:border-accent ${estilos.r8}`}
              inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} disabled={ocupado}
            />
          </label>
          <div className={`flex min-w-0 flex-col gap-1 border border-border p-2 ${estilos.r12}`}>
            <span className="flex items-center gap-1 text-[13px] font-bold">
              <Paperclip className="size-4 flex-none text-signal" aria-hidden />
              Comprobante
            </span>
            <label className={`flex h-10 cursor-pointer items-center justify-center gap-1 border-2 border-ink px-1 text-[11px] font-bold ${estilos.r8}`}>
              <ImageDown className="size-5 flex-none" aria-hidden />
              <span className="truncate">{archivo ? "Cambiar archivo" : "Seleccionar archivo"}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado} onChange={(e) => void elegir(e.target.files?.[0])} className="sr-only" />
            </label>
          </div>
        </div>
        {estado === "preparando" ? <p role="status" className="m-0 mt-2 text-[13px]">Preparando la imagen…</p> : null}
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local del comprobante
          <img src={vista} alt="Vista previa de tu comprobante" className={`mt-2 max-h-60 w-full border-2 border-border object-contain ${estilos.r8}`} />
        ) : null}
        {error ? <div className="mt-2"><ErrorAviso>{error}</ErrorAviso></div> : null}
        <p className="m-0 mt-2 font-sans text-[12px] leading-snug text-text-muted normal-case">
          Transfiere {formatCOP(aTransferir)} a la cuenta del negocio y sube tu comprobante. Tu cita queda agendada al instante; el negocio confirma después que el dinero llegó.
        </p>
      </Tarjeta>

      <div className="px-4 pt-3 pb-4">
        <button
          type="button"
          onClick={enviar}
          disabled={deshabilitado}
          aria-busy={estado === "enviando"}
          className={`flex h-14 w-full items-center justify-center gap-3 border-0 bg-signal px-3 poster-5 whitespace-nowrap [word-spacing:0.3em] text-[19px] text-paper uppercase shadow-none disabled:opacity-80 ${estilos.r16}`}
        >
          <CircleCheck className="size-7 flex-none" aria-hidden />
          {estado === "enviando" ? "Enviando…" : "Ya pagué · agendar mi cita"}
        </button>
      </div>
      {qrGrande && medios.qrUrl ? (
        <div role="dialog" aria-modal="true" aria-label="Código QR de pago ampliado" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setQrGrande(false)}>
          <div className="flex w-full max-w-[420px] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR privado con URL firmada temporal */}
            <img src={medios.qrUrl} alt="Código QR de pago del negocio, ampliado" className="w-full bg-white object-contain p-3" />
            <p className="m-0 text-center text-[13px] text-white">Apunta la cámara de otro celular al código. Sube el brillo si no lo lee.</p>
            <button type="button" onClick={() => setQrGrande(false)} className={`border-2 border-white bg-transparent px-6 py-2 text-[14px] font-bold text-white ${estilos.r8}`}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

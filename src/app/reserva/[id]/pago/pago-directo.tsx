"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { comprimirComprobante, sha256Hex } from "@/lib/imagen/comprimir";
import { AVISO_PAGO_DIRECTO_SIN_REEMBOLSO } from "@/lib/pagos-directos/aviso";
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
function CeldaCopiar({ etiqueta, valor, icono }: { etiqueta: string; valor: string; icono: React.ReactNode }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className={`flex min-w-0 items-center gap-1.5 border-2 border-ink py-1.5 pr-0.5 pl-1.5 ${estilos.r12}`} title={etiqueta}>
      <span className="flex h-7 flex-none items-center justify-center" aria-hidden="true">
        {icono}
      </span>
      <span className="h-5 w-px flex-none bg-ink" aria-hidden="true" />
      <span className="sr-only">{etiqueta}</span>
      <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-tight font-bold tracking-tight tabular-nums break-all">{valor}</p>
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
  const deshabilitado = ocupado || !acepta || !archivo;
  return (
    <>
      {puedePagarTodo ? (
        <Tarjeta icono={<CreditCard className="size-7" />} titulo="Método de pago">
          <div role="radiogroup" aria-label="¿Cuánto quieres pagar ahora?" className="flex flex-col gap-1.5">
            {opciones.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={modo === o.id}
                disabled={ocupado}
                onClick={() => elegirModo(o.id)}
                className={`flex min-h-11 items-center gap-3 border px-3 text-left ${estilos.r8} ${modo === o.id ? "border-signal bg-[#ffd9b8] text-ink" : "border-border bg-bg"}`}
              >
                <span
                  className={`grid size-6 flex-none place-items-center rounded-full border-2 ${modo === o.id ? "border-signal" : "border-ink"}`}
                  aria-hidden="true"
                >
                  {modo === o.id ? <span className="size-3 rounded-full bg-signal" /> : null}
                </span>
                <span className="flex-1 text-[17px] font-bold">{o.titulo}</span>
                <span className="font-mono text-[17px] font-bold tabular-nums">{formatCOP(o.monto)}</span>
              </button>
            ))}
          </div>
        </Tarjeta>
      ) : null}

      <Tarjeta icono={<Layers className="size-7" />} titulo="Datos de pago">
        <div className="grid grid-cols-2 gap-2">
          {medios.llaveBreb ? (
            <CeldaCopiar etiqueta="Llave Bre-B" valor={medios.llaveBreb} icono={<Image src="/pagos/breb.webp" alt="" width={40} height={20} className="h-5 w-auto" />} />
          ) : null}
          {medios.nequi ? (
            <CeldaCopiar etiqueta="Nequi" valor={medios.nequi} icono={<Image src="/pagos/nequi.webp" alt="" width={24} height={24} className="size-6" />} />
          ) : null}
          {medios.daviplata ? <CeldaCopiar etiqueta="Daviplata" valor={medios.daviplata} icono={<Smartphone className="size-6" />} /> : null}
          <CeldaCopiar etiqueta="Monto exacto" valor={String(aTransferir)} icono={<CircleDollarSign className="size-6" />} />
          {medios.referencia ? <CeldaCopiar etiqueta="Referencia" valor={medios.referencia} icono={<Tag className="size-6" />} /> : null}
        </div>
        {medios.linkPago || medios.qrUrl ? (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            {medios.linkPago ? (
              <a
                href={medios.linkPago}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex min-h-12 min-w-0 flex-[1.1] items-center justify-center gap-1.5 border-2 border-ink px-1.5 text-center text-[13px] leading-tight font-bold ${estilos.r12}`}
              >
                <Link2 className="size-5 flex-none" aria-hidden />
                Abrir link de pago
              </a>
            ) : null}
            {medios.qrUrl ? (
              <div className="flex min-w-0 flex-[1.4] items-center gap-2 border-l border-border pl-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR privado con URL firmada temporal */}
                <img src={medios.qrUrl} alt="Código QR de pago del negocio" className={`size-20 flex-none border-[3px] border-signal bg-white object-contain p-1 ${estilos.r12}`} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[14px] leading-tight font-black uppercase">Escanea el QR</span>
                  <button
                    type="button"
                    onClick={guardarQr}
                    className={`flex items-center gap-1 border-2 border-ink bg-transparent px-1.5 py-1 text-left text-[11px] leading-tight font-bold uppercase ${estilos.r8}`}
                  >
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
      </Tarjeta>

      <div className="px-4 pt-3">
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
        <div className="mt-3 flex flex-col gap-1.5 text-[11px] leading-snug text-text-muted normal-case">
          <p className="m-0 font-sans normal-case">
            Transfiere {formatCOP(aTransferir)} a la cuenta del negocio y sube tu comprobante. Tu cita queda agendada al instante; el negocio confirma después que el dinero llegó.
          </p>
          <p className="m-0 font-sans normal-case">
            El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias.
          </p>
          <p className="m-0 font-sans normal-case">{AVISO_PAGO_DIRECTO_SIN_REEMBOLSO}</p>
        </div>
      </div>
    </>
  );
}

"use client";

import { Bloque, ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { comprimirComprobante, sha256Hex } from "@/lib/imagen/comprimir";
import { AVISO_PAGO_DIRECTO_SIN_REEMBOLSO } from "@/lib/pagos-directos/aviso";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
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

function FilaCopiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-border p-3">
      <div className="min-w-0">
        <p className="sn-meta">{etiqueta}</p>
        <p className="break-all text-[15px] font-bold tabular-nums">{valor}</p>
      </div>
      <button
        type="button"
        className="shrink-0 border-2 border-border px-3 py-2 font-mono text-[11px] font-bold uppercase hover:bg-text hover:text-bg"
        onClick={async () => {
          setCopiado(await copiar(valor));
          setTimeout(() => setCopiado(false), 2000);
        }}
        aria-label={`Copiar ${etiqueta}`}
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/**
 * Pago directo a la cuenta del negocio: datos para transferir con copiado en un toque, QR descargable y subida del
 * comprobante (comprimido a <300 KB en el navegador y subido directo a Storage, sin pasar por una Server Action).
 * Al registrar el soporte, la cita queda agendada al instante.
 */
export function PagoDirecto({ reservaId, negocioId, montoSena, montoTotal, medios, acepta }: {
  reservaId: string; negocioId: string; montoSena: number; /** Total del servicio: permite pagar todo de una vez. */ montoTotal: number; medios: MediosDirectosVista; acepta: boolean;
}) {
  const router = useRouter();
  const puedePagarTodo = montoTotal > montoSena;
  const [modo, setModo] = useState<"ANTICIPO" | "TOTAL">("ANTICIPO");
  const aTransferir = Math.round(modo === "TOTAL" ? montoTotal : montoSena);
  const [monto, setMonto] = useState(String(Math.round(montoSena)));
  function elegirModo(m: "ANTICIPO" | "TOTAL") {
    setModo(m);
    setMonto(String(Math.round(m === "TOTAL" ? montoTotal : montoSena)));
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
  return (
    <Bloque etiqueta="Paga directo al negocio">
      <div className="flex flex-col gap-3">
        {puedePagarTodo ? (
          <div role="radiogroup" aria-label="¿Cuánto quieres pagar ahora?" className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "ANTICIPO", titulo: "Solo el anticipo", monto: montoSena, nota: "El resto lo pagas en el local" },
                { id: "TOTAL", titulo: "Pagar todo", monto: montoTotal, nota: "Sin saldo pendiente en el local" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={modo === o.id}
                disabled={ocupado}
                onClick={() => elegirModo(o.id)}
                className={`flex flex-col items-start gap-0.5 border-2 p-3 text-left ${modo === o.id ? "border-ink bg-signal text-ink" : "border-border"}`}
              >
                <span className="text-[12px] font-bold uppercase">{o.titulo}</span>
                <span className="text-[17px] font-bold tabular-nums">{formatCOP(o.monto)}</span>
                <span className="text-[11px] opacity-80">{o.nota}</span>
              </button>
            ))}
          </div>
        ) : null}
        <p className="m-0">
          Transfiere <b>{formatCOP(aTransferir)}</b> a la cuenta del negocio y sube tu comprobante. Tu cita queda agendada al instante; el negocio confirma después que el dinero llegó.
        </p>
        {medios.llaveBreb ? <FilaCopiar etiqueta="Llave Bre-B" valor={medios.llaveBreb} /> : null}
        {medios.nequi ? <FilaCopiar etiqueta="Nequi" valor={medios.nequi} /> : null}
        {medios.daviplata ? <FilaCopiar etiqueta="Daviplata" valor={medios.daviplata} /> : null}
        <FilaCopiar etiqueta="Monto exacto" valor={String(aTransferir)} />
        {medios.referencia ? <FilaCopiar etiqueta="Referencia sugerida" valor={medios.referencia} /> : null}
        {medios.linkPago ? (
          <a href={medios.linkPago} target="_blank" rel="noopener noreferrer" className="border-2 border-border p-3 text-center text-[13px] font-bold uppercase underline">
            Abrir link de pago
          </a>
        ) : null}
        {medios.qrUrl ? (
          <div className="flex flex-col items-center gap-2 border-2 border-border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR privado con URL firmada temporal */}
            <img src={medios.qrUrl} alt="Código QR de pago del negocio" className="size-48 object-contain" />
            <Button variant="secondary" onClick={guardarQr}>Guardar QR en galería</Button>
          </div>
        ) : null}
        {medios.instrucciones ? <p className="m-0 border-l-4 border-accent bg-accent-soft px-3 py-2 text-[13px]">{medios.instrucciones}</p> : null}

        <hr className="border-border" />
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Monto que transferiste (COP)
          <input
            className="h-11 w-full border-2 border-border bg-bg px-3 text-[16px] tabular-nums text-text outline-none focus:border-accent"
            inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} disabled={ocupado}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Captura de tu comprobante
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado} onChange={(e) => void elegir(e.target.files?.[0])}
            className="text-[13px] file:mr-3 file:border-2 file:border-border file:bg-bg file:px-3 file:py-2 file:font-mono file:text-[11px] file:font-bold file:uppercase" />
        </label>
        {estado === "preparando" ? <p role="status" className="m-0 text-[13px]">Preparando la imagen…</p> : null}
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local del comprobante
          <img src={vista} alt="Vista previa de tu comprobante" className="max-h-60 w-full border-2 border-border object-contain" />
        ) : null}
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        <Button size="lg" className="w-full" loading={estado === "enviando"} disabled={ocupado || !acepta || !archivo} onClick={enviar}>
          Ya pagué: agendar mi cita
        </Button>
        <p className="m-0 text-[12px] text-text-muted">
          El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias.
        </p>
        <p className="m-0 text-[12px] text-text-muted">{AVISO_PAGO_DIRECTO_SIN_REEMBOLSO}</p>
      </div>
    </Bloque>
  );
}

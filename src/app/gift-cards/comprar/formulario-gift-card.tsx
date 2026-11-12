"use client";

import { Pie } from "@/app/lealtad/ui-cliente";
import { Chip, ChipGroup, Segmented } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buscarNegociosParaGiftCard,
  consultarEstadoCompraGiftCard,
  iniciarCompraGiftCard,
  type NegocioBusqueda,
} from "./actions";
import { useT } from "@/lib/i18n/proveedor";

const MONTOS_RAPIDOS = [30000, 50000, 100000, 150000];
const INTERVALO_POLLING_MS = 4_000;

export function FormularioGiftCard({
  negocioPreseleccionado,
  pagoIdRetorno,
}: {
  negocioPreseleccionado: NegocioBusqueda | null;
  pagoIdRetorno: string | null;
}) {
  const tr = useT();
  const [negocio, setNegocio] = useState<NegocioBusqueda | null>(negocioPreseleccionado);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<NegocioBusqueda[]>([]);
  const [monto, setMonto] = useState<number | null>(50000);
  const [montoCustom, setMontoCustom] = useState("");
  const [paraOtro, setParaOtro] = useState(false);
  const [destinatarioNombre, setDestinatarioNombre] = useState("");
  const [destinatarioEmail, setDestinatarioEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [pin, setPin] = useState("");
  const [iniciando, setIniciando] = useState(false);
  const [pagoId, setPagoId] = useState<string | null>(pagoIdRetorno);
  const [esperando, setEsperando] = useState(!!pagoIdRetorno);
  const [comprada, setComprada] = useState(false);
  const [esperaLarga, setEsperaLarga] = useState(false);
  const yaRedirigido = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => buscarNegociosParaGiftCard(busqueda).then(setResultados), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!pagoId) return;
    const inicio = Date.now();
    const intervalo = setInterval(async () => {
      // Pasados 90 s sin respuesta se avisa al usuario (el pago puede estar aprobado y la tarjeta ya activa).
      if (Date.now() - inicio > 90_000) setEsperaLarga(true);
      let estado: Awaited<ReturnType<typeof consultarEstadoCompraGiftCard>>;
      try {
        estado = await consultarEstadoCompraGiftCard(pagoId);
      } catch {
        return; // un fallo de red puntual no detiene el sondeo; se reintenta en el siguiente ciclo
      }
      if (estado.pago === "APROBADO" && !yaRedirigido.current) {
        yaRedirigido.current = true;
        setEsperando(false);
        setComprada(true);
      } else if (estado.pago === "RECHAZADO") {
        setEsperando(false);
        toast.error(tr("gc.err_rechazado"));
      }
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [pagoId, tr]);

  const montoFinal = montoCustom ? Number(montoCustom) : monto;

  async function comprar() {
    if (!negocio) return toast.error(tr("gc.err_negocio"));
    if (!montoFinal || montoFinal <= 0) return toast.error(tr("gc.err_monto"));
    if (pin.length < 4) return toast.error(tr("gc.err_pin"));
    if (paraOtro && !destinatarioNombre.trim()) return toast.error(tr("gc.err_destinatario"));

    setIniciando(true);
    const r = await iniciarCompraGiftCard({
      negocioId: negocio.id,
      monto: montoFinal,
      pin,
      destinatarioNombre: paraOtro ? destinatarioNombre : undefined,
      destinatarioEmail: paraOtro ? destinatarioEmail || undefined : undefined,
      mensaje: mensaje || undefined,
    });
    setIniciando(false);
    if (!r.ok) return toast.error(r.mensaje);
    setPagoId(r.pagoId);
    setEsperando(true);
    window.location.href = r.url;
  }

  if (comprada) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="sn-block-signal !bg-signal !text-ink border-b-2 border-ink px-4 pt-5 pb-6">
          <span className="sn-num !text-ink">{tr("gc.listo")}</span>
          <h2 className="poster-2 mt-2.5 break-words">
            {tr("gc.comprada_1")}
            <br />
            {tr("gc.comprada_2")}
          </h2>
        </div>
        <p className="body-sm break-words p-4">
          {tr("gc.comparte", { quien: paraOtro ? destinatarioNombre || tr("gc.destinatario_def") : tr("gc.quien_usa") })}
        </p>
        <div className="flex-1" />
        <Pie>
          <Button asChild size="lg" className="w-full">
            <Link href="/gift-cards/mis">{tr("gc.ver_mis")}</Link>
          </Button>
        </Pie>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 p-4">
        <section className="flex flex-col gap-2">
          <span className="sn-num">{tr("gc.sec_negocio")}</span>
          {negocio ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-border p-3">
              <span className="section break-words">{negocio.nombre}</span>
              <Button variant="secondary" size="sm" onClick={() => setNegocio(null)}>
                {tr("gc.cambiar")}
              </Button>
            </div>
          ) : (
            <>
              <Input
                aria-label={tr("gc.buscar_aria")}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={tr("gc.buscar_ph")}
              />
              {resultados.length > 0 ? (
                <ul className="border-2 border-border">
                  {resultados.map((n) => (
                    <li key={n.id} className="border-b border-border-subtle last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setNegocio(n);
                          setBusqueda("");
                          setResultados([]);
                        }}
                        className="block min-h-12 w-full px-3 text-left text-[15px] font-bold text-text active:bg-text active:text-bg"
                      >
                        {n.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <span className="sn-num">{tr("gc.sec_monto")}</span>
          <ChipGroup>
            {MONTOS_RAPIDOS.map((m) => (
              <Chip
                key={m}
                selected={monto === m && !montoCustom}
                onClick={() => {
                  setMonto(m);
                  setMontoCustom("");
                }}
              >
                {formatCOP(m)}
              </Chip>
            ))}
          </ChipGroup>
          <Input
            aria-label={tr("gc.otro_monto")}
            type="number"
            min={1000}
            value={montoCustom}
            onChange={(e) => setMontoCustom(e.target.value)}
            placeholder={tr("gc.otro_monto")}
          />
        </section>

        <section className="flex flex-col gap-3">
          <span className="sn-num">{tr("gc.sec_para")}</span>
          <Segmented<"yo" | "otro">
            aria-label={tr("gc.destinatario")}
            className="flex [&>button]:min-w-0 [&>button]:flex-1"
            value={paraOtro ? "otro" : "yo"}
            onChange={(v) => setParaOtro(v === "otro")}
            options={[
              { value: "yo", label: tr("gc.para_mi") },
              { value: "otro", label: tr("gc.para_otra") },
            ]}
          />
          {paraOtro ? (
            <div className="flex flex-col gap-3">
              <Input
                label={tr("gc.nombre_dest")}
                value={destinatarioNombre}
                onChange={(e) => setDestinatarioNombre(e.target.value)}
              />
              <Input
                label={tr("gc.email_dest")}
                type="email"
                value={destinatarioEmail}
                onChange={(e) => setDestinatarioEmail(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="gc-mensaje" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] uppercase">
                  {tr("gc.mensaje")}
                </label>
                <textarea
                  id="gc-mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={2}
                  className="w-full border-2 border-border bg-bg p-3 text-[15px] leading-[22px] text-text outline-none focus:shadow-hard"
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <span className="sn-num">{tr("gc.sec_pin")}</span>
          <Input
            label={tr("gc.elige_pin")}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="••••"
          />
          <p className="sn-help">{tr("gc.pin_ayuda")}</p>
        </section>

        {esperando ? (
          <div role="status" className="flex items-center gap-3 border-2 border-border p-4">
            <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="section">{tr("gc.esperando")}</span>
          </div>
        ) : null}
        {esperando && esperaLarga ? (
          <p className="sn-help" role="status">
            {tr("gc.tardando")}{" "}
            <a className="underline" href="/gift-cards/mis">
              {tr("gc.mis")}
            </a>
            .
          </p>
        ) : null}
      </div>

      <div className="flex-1" />
      <Pie>
        <Button size="lg" className="w-full" loading={iniciando || esperando} disabled={iniciando || esperando} onClick={comprar}>
          {montoFinal ? tr("gc.pagar_monto", { monto: formatCOP(montoFinal) }) : tr("gc.pagar")}
        </Button>
      </Pie>
    </main>
  );
}

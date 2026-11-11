"use client";

import { ErrorAviso, Pantalla, Top } from "@/app/lealtad/ui-cliente";
import { Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import type { ResumenEliminacion } from "@/lib/cliente/cuenta";
import { formatCOP } from "@/lib/utils";
import { ArrowUpRight, Download, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelarEliminacionAccion, exportarDatosAccion, solicitarEliminacionAccion } from "./actions";

const BLOQUEOS: Record<string, string> = {
  ES_SUPERSU: "Tu cuenta tiene un rol de plataforma y no se puede eliminar desde aquí.",
  NEGOCIO_ACTIVO: "Eres dueño de un negocio activo. Cierra o transfiere tu negocio antes de eliminar tu cuenta.",
  STAFF_ACTIVO: "Tienes un rol activo en un negocio. Pide que te retiren del equipo antes de eliminar tu cuenta.",
};

function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fechaDia(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

const TIT = "font-display text-[28px] leading-[0.9] font-black [font-stretch:var(--stretch-condensed)] uppercase";

export function VistaCuenta({ resumen, error }: { resumen: ResumenEliminacion | null; error: string | null }) {
  const router = useRouter();
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const [texto, setTexto] = useState("");
  const [exportando, setExportando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [falloExport, setFalloExport] = useState<string | null>(null);
  const [exportado, setExportado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  const listo = texto.trim().toUpperCase() === "ELIMINAR";
  const citas = resumen?.citas_futuras ?? [];
  const saldo = Number(resumen?.saldo ?? 0);
  const bloqueado = resumen ? !resumen.puede_eliminar : false;

  useEffect(() => {
    if (paso === 0) return;
    hojaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paso]);

  function cerrar() {
    setPaso(0);
    setTexto("");
    setFallo(null);
  }

  async function exportar() {
    setExportando(true);
    setFalloExport(null);
    setExportado(false);
    const r = await exportarDatosAccion();
    setExportando(false);
    if (!r.ok) {
      setFalloExport(r.error);
      return;
    }
    try {
      const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `stylernow-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportado(true);
    } catch {
      setFalloExport("No pudimos preparar la descarga. Inténtalo de nuevo.");
    }
  }

  async function eliminar() {
    setEliminando(true);
    setFallo(null);
    const r = await solicitarEliminacionAccion(texto);
    setEliminando(false);
    if (!r.ok) {
      setFallo(r.error);
      return;
    }
    cerrar();
    router.refresh();
  }

  async function cancelar() {
    setCancelando(true);
    setFallo(null);
    const r = await cancelarEliminacionAccion();
    setCancelando(false);
    if (!r.ok) {
      setFallo(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <Pantalla className="pb-8">
      <Top titulo="/PERFIL/CUENTA" volverA="/perfil" />

      <div className="px-4 pt-3.5 pb-3.5">
        <Poster as="h1" size={2}>
          Datos y
          <br />
          <span className="sn-hot">Cuenta.</span>
        </Poster>
      </div>

      {error ? (
        <div className="px-4 pb-3">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <section className="mx-4 border-2 border-border">
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-2.5">
            <Download aria-hidden className="size-[22px]" strokeLinecap="square" />
            <h2 className="sn-num">01 / Exportar</h2>
          </div>
          <p className={TIT}>Descarga tus datos</p>
          <p className="body-sm break-words text-text-muted">
            Perfil, citas, reseñas, pagos, fotos de My Look y consentimientos, en un archivo JSON que se descarga al instante en tu dispositivo.
          </p>
          {falloExport ? <ErrorAviso>{falloExport}</ErrorAviso> : null}
          {exportado ? (
            <p role="status" className="sn-meta">
              DESCARGA LISTA · REVISA TU CARPETA DE DESCARGAS
            </p>
          ) : null}
        </div>
        <Button type="button" variant="ink" size="lg" loading={exportando} onClick={exportar} className="w-full justify-between border-0 border-t-2 !border-border">
          <span>Descargar mis datos</span>
          <ArrowUpRight aria-hidden className="size-[18px]" />
        </Button>
      </section>

      <section className="mx-4 mt-4 border-2 border-border">
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-2.5">
            <Trash2 aria-hidden className="size-[22px]" strokeLinecap="square" />
            <h2 className="sn-num">02 / Eliminar</h2>
          </div>
          <p className={TIT}>Elimina tu cuenta</p>
          <p className="body-sm break-words text-text-muted">
            Borramos tu perfil, reseñas, My Look y saldo. Los comprobantes de pago se conservan el tiempo que exige la ley. Tienes {resumen?.dias_gracia ?? 14} días para arrepentirte; pasado ese plazo no se puede deshacer.
          </p>

          {resumen?.pendiente ? (
            <p role="status" className="flex items-start gap-2 bg-warning px-2 py-1.5 font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] break-words text-ink uppercase">
              <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
              {`ELIMINACIÓN PROGRAMADA PARA EL ${fechaDia(resumen.pendiente.programada_para)}. HASTA ENTONCES PUEDES CANCELARLA.`}
            </p>
          ) : bloqueado ? (
            <ErrorAviso>{BLOQUEOS[resumen?.motivo_bloqueo ?? ""] ?? "Tu cuenta no se puede eliminar desde aquí."}</ErrorAviso>
          ) : citas.length > 0 || saldo > 0 ? (
            <p className="flex items-start gap-2 bg-warning px-2 py-1.5 font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] break-words text-ink uppercase">
              <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
              {`AVISO · TIENES ${citas.length} ${citas.length === 1 ? "CITA" : "CITAS"} Y ${formatCOP(saldo)} DE SALDO`}
            </p>
          ) : null}
          {fallo && paso === 0 ? <ErrorAviso>{fallo}</ErrorAviso> : null}
        </div>

        {resumen?.pendiente ? (
          <Button type="button" variant="secondary" size="lg" loading={cancelando} onClick={cancelar} className="w-full justify-between border-0 border-t-2 !border-border">
            <span>Cancelar eliminación</span>
          </Button>
        ) : (
          <button
            type="button"
            disabled={bloqueado || !resumen}
            onClick={() => setPaso(1)}
            className="sn-label flex min-h-[52px] w-full items-center border-t-2 border-border px-3.5 text-left text-danger disabled:cursor-not-allowed disabled:text-text-disabled"
          >
            Eliminar cuenta
          </button>
        )}
      </section>

      {paso !== 0 ? (
        <>
          <div className="fixed inset-0 z-50 bg-[var(--scrim)]" aria-hidden onClick={cerrar} />
          <div
            ref={hojaRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-label={`Confirmar eliminación, paso ${paso} de 2`}
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto border-t-4 bg-bg px-4 pt-2.5 pb-8 outline-none ${paso === 2 ? "border-danger" : "border-border"}`}
          >
            <span aria-hidden className="h-1.5 w-12 self-center bg-text" />
            <span className="sn-meta font-bold">{`CONFIRMACIÓN ${paso} DE 2`}</span>

            {paso === 1 ? (
              <>
                <p className="poster-3 break-words">
                  ¿Eliminar
                  <br />
                  tu cuenta?
                </p>
                <ul className="flex flex-col border-t border-border">
                  {citas.map((c) => (
                    <li key={c.reserva_id} className="body border-b border-border-subtle py-2 break-words">
                      {`Se cancela tu cita del ${fechaLarga(c.hora_inicio)} en ${c.negocio}.`}
                    </li>
                  ))}
                  {saldo > 0 ? (
                    <li className="body border-b border-border-subtle py-2 break-words">
                      {`Tu saldo de ${formatCOP(saldo)} vuelve a ti: creamos la solicitud de devolución.`}
                    </li>
                  ) : null}
                  <li className="body border-b border-border-subtle py-2 break-words">Tus reseñas quedan como «Cliente anónimo».</li>
                  <li className="body border-b border-border-subtle py-2 break-words">{`Tienes ${resumen?.dias_gracia ?? 14} días para cancelar la eliminación antes de que sea definitiva.`}</li>
                </ul>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button type="button" variant="ink" size="lg" onClick={cerrar} className="min-h-14">
                    No, volver
                  </Button>
                  <Button type="button" variant="danger" size="lg" onClick={() => setPaso(2)} className="min-h-14 !bg-danger !text-ink">
                    Sí, continuar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="poster-3 break-words">
                  Escribe
                  <br />
                  <span className="bg-danger px-1.5 text-ink">ELIMINAR</span>
                </p>
                <p className="body-sm text-text-muted">Para confirmar que eres tú y que entiendes que no se puede deshacer.</p>
                <label htmlFor="confirmacion" className="sn-label">
                  Confirmación
                </label>
                <input
                  id="confirmacion"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="min-h-[52px] w-full border-2 border-border bg-surface px-3.5 font-mono text-[15px] font-bold tracking-[2px] text-text outline-none focus:shadow-hard"
                />
                {fallo ? <ErrorAviso>{fallo}</ErrorAviso> : null}
                <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
                  <Button type="button" variant="secondary" size="lg" onClick={cerrar} className="min-h-14">
                    Cancelar
                  </Button>
                  <Button type="button" variant="danger" size="lg" loading={eliminando} disabled={!listo} onClick={eliminar} className="min-h-14 !bg-danger !text-ink disabled:!bg-surface disabled:!text-text-disabled">
                    Eliminar para siempre
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </Pantalla>
  );
}

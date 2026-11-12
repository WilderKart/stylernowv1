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
import { useIdioma, useT } from "@/lib/i18n/proveedor";

const BLOQUEOS = {
  ES_SUPERSU: "cta.bl_supersu",
  NEGOCIO_ACTIVO: "cta.bl_negocio",
  STAFF_ACTIVO: "cta.bl_staff",
} as const;

function fechaLarga(iso: string, loc: string) {
  return new Intl.DateTimeFormat(loc, { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fechaDia(iso: string, loc: string) {
  return new Intl.DateTimeFormat(loc, { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

const TIT = "font-display text-[28px] leading-[0.9] font-black [font-stretch:var(--stretch-condensed)] uppercase";

export function VistaCuenta({ resumen, error }: { resumen: ResumenEliminacion | null; error: string | null }) {
  const router = useRouter();
  const t = useT();
  const loc = useIdioma() === "en" ? "en-US" : "es-CO";
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
      setFalloExport(t("cta.err_descarga"));
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
      <Top titulo={t("cta.top")} volverA="/perfil" />

      <div className="px-4 pt-3.5 pb-3.5">
        <Poster as="h1" size={2}>
          {t("cta.t1")}
          <br />
          <span className="sn-hot">{t("cta.t2")}</span>
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
            <h2 className="sn-num">{t("cta.sec_exportar")}</h2>
          </div>
          <p className={TIT}>{t("cta.descarga_titulo")}</p>
          <p className="body-sm break-words text-text-muted">
            {t("cta.descarga_txt")}
          </p>
          {falloExport ? <ErrorAviso>{falloExport}</ErrorAviso> : null}
          {exportado ? (
            <p role="status" className="sn-meta">
              {t("cta.descarga_lista")}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="ink" size="lg" loading={exportando} onClick={exportar} className="w-full justify-between border-0 border-t-2 !border-border">
          <span>{t("cta.descargar")}</span>
          <ArrowUpRight aria-hidden className="size-[18px]" />
        </Button>
      </section>

      <section className="mx-4 mt-4 border-2 border-border">
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-2.5">
            <Trash2 aria-hidden className="size-[22px]" strokeLinecap="square" />
            <h2 className="sn-num">{t("cta.sec_eliminar")}</h2>
          </div>
          <p className={TIT}>{t("cta.elimina_titulo")}</p>
          <p className="body-sm break-words text-text-muted">
            {t("cta.elimina_txt", { dias: resumen?.dias_gracia ?? 14 })}
          </p>

          {resumen?.pendiente ? (
            <p role="status" className="flex items-start gap-2 bg-warning px-2 py-1.5 font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] break-words text-ink uppercase">
              <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
              {t("cta.programada", { fecha: fechaDia(resumen.pendiente.programada_para, loc) })}
            </p>
          ) : bloqueado ? (
            <ErrorAviso>{resumen?.motivo_bloqueo && resumen.motivo_bloqueo in BLOQUEOS ? t(BLOQUEOS[resumen.motivo_bloqueo as keyof typeof BLOQUEOS]) : t("cta.bl_generico")}</ErrorAviso>
          ) : citas.length > 0 || saldo > 0 ? (
            <p className="flex items-start gap-2 bg-warning px-2 py-1.5 font-mono text-[11px] leading-[14px] font-bold tracking-[0.66px] break-words text-ink uppercase">
              <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
              {citas.length === 1 ? t("cta.aviso_cita", { n: citas.length, saldo: formatCOP(saldo) }) : t("cta.aviso_citas", { n: citas.length, saldo: formatCOP(saldo) })}
            </p>
          ) : null}
          {fallo && paso === 0 ? <ErrorAviso>{fallo}</ErrorAviso> : null}
        </div>

        {resumen?.pendiente ? (
          <Button type="button" variant="secondary" size="lg" loading={cancelando} onClick={cancelar} className="w-full justify-between border-0 border-t-2 !border-border">
            <span>{t("cta.cancelar_elim")}</span>
          </Button>
        ) : (
          <button
            type="button"
            disabled={bloqueado || !resumen}
            onClick={() => setPaso(1)}
            className="sn-label flex min-h-[52px] w-full items-center border-t-2 border-border px-3.5 text-left text-danger disabled:cursor-not-allowed disabled:text-text-disabled"
          >
            {t("cta.eliminar_cuenta")}
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
            aria-label={t("cta.aria_confirmar", { paso })}
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto border-t-4 bg-bg px-4 pt-2.5 pb-8 outline-none ${paso === 2 ? "border-danger" : "border-border"}`}
          >
            <span aria-hidden className="h-1.5 w-12 self-center bg-text" />
            <span className="sn-meta font-bold">{t("cta.confirmacion_n", { paso })}</span>

            {paso === 1 ? (
              <>
                <p className="poster-3 break-words">
                  {t("cta.q1")}
                  <br />
                  {t("cta.q2")}
                </p>
                <ul className="flex flex-col border-t border-border">
                  {citas.map((c) => (
                    <li key={c.reserva_id} className="body border-b border-border-subtle py-2 break-words">
                      {t("cta.se_cancela", { fecha: fechaLarga(c.hora_inicio, loc), negocio: c.negocio })}
                    </li>
                  ))}
                  {saldo > 0 ? (
                    <li className="body border-b border-border-subtle py-2 break-words">
                      {t("cta.saldo_vuelve", { saldo: formatCOP(saldo) })}
                    </li>
                  ) : null}
                  <li className="body border-b border-border-subtle py-2 break-words">{t("cta.resenas_anonimo")}</li>
                  <li className="body border-b border-border-subtle py-2 break-words">{t("cta.dias_cancelar", { dias: resumen?.dias_gracia ?? 14 })}</li>
                </ul>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button type="button" variant="ink" size="lg" onClick={cerrar} className="min-h-14">
                    {t("cta.no_volver")}
                  </Button>
                  <Button type="button" variant="danger" size="lg" onClick={() => setPaso(2)} className="min-h-14 !bg-danger !text-ink">
                    {t("cta.si_continuar")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="poster-3 break-words">
                  {t("cta.escribe")}
                  <br />
                  <span className="bg-danger px-1.5 text-ink">ELIMINAR</span>
                </p>
                <p className="body-sm text-text-muted">{t("cta.para_confirmar")}</p>
                <label htmlFor="confirmacion" className="sn-label">
                  {t("cta.confirmacion")}
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
                    {t("comun.cancelar")}
                  </Button>
                  <Button type="button" variant="danger" size="lg" loading={eliminando} disabled={!listo} onClick={eliminar} className="min-h-14 !bg-danger !text-ink disabled:!bg-surface disabled:!text-text-disabled">
                    {t("cta.eliminar_siempre")}
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

"use client";

import { Barra, ErrorAviso, Fila, Filas, Sec } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Check, Gift, Store, Stamp, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { crearGrupoFamiliar, registrarReferido, type ResumenLealtad } from "./actions";
import { useIdioma, useT } from "@/lib/i18n/proveedor";

const MEMBRESIA_ESTADO_TONO: Record<string, "ok" | "warn" | "info"> = {
  ACTIVA: "ok",
  PROXIMA_A_VENCER: "warn",
  SUSPENDIDA: "info",
};

const TIPO_ETIQUETA = {
  GIFT_CARD: "ll.t_gift",
  REFERIDO: "ll.t_referido",
  CASHBACK: "ll.t_cashback",
  PROMOCION: "ll.t_promocion",
  SELLO_CONVERTIDO: "ll.t_sello",
  VIP_BONO: "ll.t_vip",
  CANJE: "ll.t_canje",
} as const;

const ESTADO_RAW = { DISPONIBLE: "ll.est_disponible", COMPLETADO: "ll.est_completado" } as const;

export function VistaLealtad({ resumenInicial, errorInicial }: { resumenInicial: ResumenLealtad; errorInicial: string | null }) {
  const t = useT();
  const loc = useIdioma() === "en" ? "en-US" : "es-CO";
  const [resumen] = useState(resumenInicial);
  const error = errorInicial;

  return (
    <>
      <div className="sn-block-ink !bg-ink !text-paper px-4 py-5">
        <span className="sn-num !text-signal">{t("ll.wallet")}</span>
        <p className="poster-1 mt-1 break-words !text-paper">{formatCOP(resumen.walletSaldo)}</p>
        <span className="sn-meta !text-[#A3A3A3]">
          {t("ll.wallet_txt")}
        </span>
      </div>

      {error ? (
        <div className="p-4">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      {resumen.membresias.length > 0 ? (
        <>
          <Sec derecha={<Link href="/membresias" className="sn-label underline">{t("ll.ver_todas")}</Link>}>{t("ll.sec_membresias")}</Sec>
          <Filas>
            {resumen.membresias.slice(0, 3).map((m) => (
              <Fila
                key={m.id}
                icono={<Store aria-hidden className="size-5" />}
                titulo={m.planNombre}
                meta={m.negocioNombre}
                href={`/membresias/${m.id}`}
                derecha={
                  <Status tone={MEMBRESIA_ESTADO_TONO[m.estado] ?? "info"}>
                    {m.estado === "SUSPENDIDA" ? t("ll.congelada") : m.estado === "PROXIMA_A_VENCER" ? t("ll.por_vencer") : t("ll.activa")}
                  </Status>
                }
              />
            ))}
          </Filas>
        </>
      ) : null}

      <Sec>{t("ll.sec_gift")}</Sec>
      <Filas>
        {/* Por seguridad (ADR-014, Fase B: canje únicamente desde POS) el canje de una Gift Card
            no es autoservicio remoto: aquí el Cliente solo compra o consulta su saldo. */}
        <Fila
          icono={<Gift aria-hidden className="size-5" />}
          titulo={t("perfil.gift_cards")}
          meta={t("ll.gift_meta")}
          href="/gift-cards"
        />
      </Filas>

      {resumen.movimientos.length > 0 ? (
        <>
          <Sec>{t("ll.sec_mov")}</Sec>
          <Filas>
            {resumen.movimientos.slice(0, 8).map((m) => (
              <Fila
                key={m.id}
                icono={m.monto >= 0 ? <ArrowDownLeft aria-hidden className="size-5" /> : <ArrowUpRight aria-hidden className="size-5" />}
                titulo={TIPO_ETIQUETA[m.tipo as keyof typeof TIPO_ETIQUETA] ? t(TIPO_ETIQUETA[m.tipo as keyof typeof TIPO_ETIQUETA]) : m.tipo}
                meta={`${new Date(m.createdAt).toLocaleDateString(loc)}${m.motivo ? ` · ${m.motivo}` : ""}`}
                derecha={
                  <span className={m.monto >= 0 ? "sn-price" : "sn-price text-danger"}>
                    {m.monto >= 0 ? "+" : ""}
                    {formatCOP(m.monto)}
                  </span>
                }
              />
            ))}
          </Filas>
        </>
      ) : null}

      <SeccionReferidos codigoReferido={resumen.codigoReferido} referidos={resumen.referidos} />

      {resumen.sellos.length > 0 ? (
        <>
          <Sec>{t("ll.sec_sellos")}</Sec>
          <Filas>
            {resumen.sellos.map((s) => (
              <div key={s.campanaId} className="flex flex-col gap-2 border-b border-border-subtle px-4 py-3">
                <div className="flex items-center gap-2">
                  <Stamp aria-hidden className="size-5 shrink-0" />
                  <b className="break-words text-[15px]">
                    {s.negocioNombre} · {s.campanaNombre}
                  </b>
                </div>
                <Barra pct={(s.sellosActuales / s.sellosRequeridos) * 100} etiqueta={t("ll.progreso")} />
                <span className="sn-meta break-words">
                  {t("ll.sellos_de", { a: s.sellosActuales, b: s.sellosRequeridos, recompensa: s.recompensaDescripcion })}
                </span>
              </div>
            ))}
          </Filas>
        </>
      ) : null}

      {resumen.cashback.length > 0 ? (
        <>
          <Sec>{t("ll.sec_cashback")}</Sec>
          <Filas>
            {resumen.cashback.slice(0, 6).map((c) => (
              <Fila
                key={c.id}
                titulo={c.negocioNombre}
                derecha={
                  <>
                    <Status tone={c.estado === "DISPONIBLE" ? "ok" : "info"}>{ESTADO_RAW[c.estado as keyof typeof ESTADO_RAW] ? t(ESTADO_RAW[c.estado as keyof typeof ESTADO_RAW]) : c.estado}</Status>
                    <span className="sn-price">{formatCOP(c.monto)}</span>
                  </>
                }
              />
            ))}
          </Filas>
        </>
      ) : null}

      <SeccionFamilia familia={resumen.familia} onCreada={() => window.location.reload()} />
    </>
  );
}

function SeccionReferidos({ codigoReferido, referidos }: { codigoReferido: string | null; referidos: ResumenLealtad["referidos"] }) {
  const t = useT();
  const loc = useIdioma() === "en" ? "en-US" : "es-CO";
  const [codigoAUsar, setCodigoAUsar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function onUsarCodigo() {
    if (!codigoAUsar.trim()) return;
    setCargando(true);
    setMensaje(null);
    const res = await registrarReferido(codigoAUsar);
    setCargando(false);
    setMensaje(res.ok ? { tipo: "ok", texto: t("ll.listo") } : { tipo: "error", texto: res.error });
    if (res.ok) setCodigoAUsar("");
  }

  return (
    <>
      <Sec>{t("ll.sec_referidos")}{referidos.length ? ` · ${referidos.length}` : ""}</Sec>
      <div className="mx-4 border-2 border-border shadow-hard">
        <div className="border-b border-border-subtle p-3">
          <span className="sn-label">{t("ll.tu_codigo")}</span>
        </div>
        <p className="poster-3 break-all p-3">{codigoReferido ?? "—"}</p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="body-sm break-words">{t("ll.te_compartieron")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <Input
              aria-label={t("ll.codigo_ref")}
              placeholder={t("ll.codigo_ref")}
              value={codigoAUsar}
              onChange={(e) => setCodigoAUsar(e.target.value.toUpperCase())}
            />
          </div>
          <Button loading={cargando} onClick={onUsarCodigo} disabled={!codigoAUsar.trim()}>
            {t("ll.usar")}
          </Button>
        </div>
        {mensaje ? (
          mensaje.tipo === "ok" ? (
            <Status tone="ok" role="status" icon={<Check aria-hidden className="size-3.5" />} className="self-start">
              {mensaje.texto}
            </Status>
          ) : (
            <ErrorAviso>{mensaje.texto}</ErrorAviso>
          )
        ) : null}
      </div>

      {referidos.length > 0 ? (
        <Filas>
          {referidos.map((r) => (
            <Fila
              key={r.id}
              icono={<Users aria-hidden className="size-5" />}
              titulo={new Date(r.createdAt).toLocaleDateString(loc)}
              derecha={
                <>
                  <Status tone={r.estado === "COMPLETADO" ? "ok" : "info"}>{ESTADO_RAW[r.estado as keyof typeof ESTADO_RAW] ? t(ESTADO_RAW[r.estado as keyof typeof ESTADO_RAW]) : r.estado}</Status>
                  {r.montoRecompensa ? <span className="sn-price">{formatCOP(r.montoRecompensa)}</span> : null}
                </>
              }
            />
          ))}
        </Filas>
      ) : null}
    </>
  );
}

function SeccionFamilia({ familia, onCreada }: { familia: ResumenLealtad["familia"]; onCreada: () => void }) {
  const t = useT();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCrear() {
    setCreando(true);
    setError(null);
    const res = await crearGrupoFamiliar("Mi familia");
    setCreando(false);
    if (!res.ok) return setError(res.error);
    onCreada();
  }

  if (familia) {
    return (
      <>
        <Sec>{t("ll.sec_mi_familia")}</Sec>
        <Filas>
          <Fila icono={<Users aria-hidden className="size-5" />} titulo={familia.nombre} meta={familia.limiteMiembros != null ? t("ll.hasta_miembros", { n: familia.limiteMiembros }) : t("ll.sin_limite_miembros")} />
        </Filas>
      </>
    );
  }

  return (
    <>
      <Sec>{t("ll.sec_familiar")}</Sec>
      <div className="flex flex-col gap-3 px-4 pb-6">
        <p className="body-sm break-words">{t("ll.agrupa")}</p>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        <Button variant="secondary" size="lg" loading={creando} onClick={onCrear}>
          {t("ll.crear_grupo")}
        </Button>
      </div>
    </>
  );
}

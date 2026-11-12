"use client";

import { ErrorAviso, Fila } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { fechaCorta, hora, hoyISO, sumarDias } from "@/lib/formato";
import { CalendarCheck, MapPin, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/proveedor";
import { llegueAction, reprogramarAction, slotsReprogramarAction, type SlotLibre } from "./actions-cita";

/** «LLEGUÉ»: avisa al negocio. Intenta con GPS (validación ≤ 0,5 km); si no hay permiso, avisa sin coordenadas. */
export function BotonLlegue({ reservaId, checkinAt, tz }: { reservaId: string; checkinAt: string | null; tz: string }) {
  const router = useRouter();
  const t = useT();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (checkinAt) {
    return (
      <div role="status" className="border-2 border-border p-4">
        <span className="sn-label">{t("ac.ya_avisaste")}</span>
        <p className="sn-meta mt-1">{t("ac.registrada", { hora: hora(checkinAt, tz) })}</p>
      </div>
    );
  }

  async function llegue() {
    setCargando(true);
    setError(null);
    const coords = await new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(undefined),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
    try {
      const r = await llegueAction(reservaId, coords);
      if (!r.ok) return setError(r.error);
      router.refresh();
    } catch {
      setError(t("ac.err_avisar"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <Button size="lg" className="w-full justify-between text-left" loading={cargando} onClick={llegue}>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-base">{t("ac.llegue")}</span>
          <span className="sn-meta !text-ink">{t("ac.llegue_meta")}</span>
        </span>
        <MapPin aria-hidden className="size-6 shrink-0" />
      </Button>
      {error ? (
        <div className="mt-3">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}
    </div>
  );
}

/** Compartir con la Web Share API; si no existe, copia el texto al portapapeles. */
export function FilaCompartir({ texto }: { texto: string }) {
  const t = useT();
  const [aviso, setAviso] = useState<string | null>(null);

  async function compartir() {
    setAviso(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: t("ac.mi_cita"), text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setAviso(t("ac.copiado"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAviso(t("ac.err_compartir"));
    }
  }

  return (
    <Fila icono={<Share2 aria-hidden className="size-5" />} titulo={t("ac.compartir")} meta={aviso ?? t("ac.compartir_meta")} onClick={compartir} />
  );
}

const DIAS_VISIBLES = 14;

/** Reprogramar: día (14 días desde hoy) + horas reales del RPC slots_disponibles. */
export function Reprogramar({ reservaId, tz }: { reservaId: string; tz: string }) {
  const router = useRouter();
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotLibre[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peticion = useRef(0);

  const hoy = hoyISO(tz);
  const dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(hoy, i));

  function elegirDia(d: string) {
    const mia = ++peticion.current;
    setDia(d);
    setCargandoSlots(true);
    setSlots(null);
    setElegido(null);
    setError(null);
    slotsReprogramarAction(reservaId, d)
      .then((r) => {
        if (mia !== peticion.current) return;
        if (r.ok) setSlots(r.data);
        else setError(r.error);
      })
      .catch(() => {
        if (mia === peticion.current) setError(t("ac.err_horarios"));
      })
      .finally(() => {
        if (mia === peticion.current) setCargandoSlots(false);
      });
  }

  async function confirmar() {
    if (!elegido) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await reprogramarAction(reservaId, elegido);
      if (!r.ok) {
        setError(r.error);
        // El horario pudo ocuparse: se refresca la lista del día.
        if (r.codigo === "SLOT_NO_DISPONIBLE" && dia) {
          const n = await slotsReprogramarAction(reservaId, dia);
          if (n.ok) setSlots(n.data);
          setElegido(null);
        }
        return;
      }
      setAbierto(false);
      router.refresh();
    } catch {
      setError(t("ac.err_reprogramar"));
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <Fila
        icono={<CalendarCheck aria-hidden className="size-5" />}
        titulo={t("ac.reprogramar")}
        meta={t("ac.reprogramar_meta")}
        onClick={() => setAbierto(true)}
      />
    );
  }

  return (
    <div className="m-4 border-2 border-border p-4 shadow-hard">
      <h3 className="section">{t("ac.nuevo_horario")}</h3>

      <span className="sn-label mt-4 block">{t("ac.sec_dia")}</span>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("ac.dia")}>
        {dias.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={dia === d}
            className={`sn-chip ${dia === d ? "is-selected" : ""}`}
            onClick={() => elegirDia(d)}
          >
            {fechaCorta(d, tz)}
          </button>
        ))}
      </div>

      {dia ? (
        <>
          <span className="sn-label mt-4 block">{t("ac.sec_hora")}</span>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("ac.hora")}>
            {cargandoSlots ? Array.from({ length: 6 }).map((_, i) => <span key={i} className="sn-skel h-10 w-20" />) : null}
            {slots?.map((s) => (
              <button
                key={s.hora_inicio}
                type="button"
                role="radio"
                aria-checked={elegido === s.hora_inicio}
                className={`sn-chip ${elegido === s.hora_inicio ? "is-selected" : ""}`}
                onClick={() => setElegido(s.hora_inicio)}
              >
                {hora(s.hora_inicio, tz)}
              </button>
            ))}
          </div>
          {slots && slots.length === 0 ? <p className="sn-meta mt-2">{t("ac.no_horarios")}</p> : null}
        </>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" className="min-w-0 flex-1" onClick={() => setAbierto(false)} disabled={guardando}>
          {t("ac.volver")}
        </Button>
        <Button className="min-w-0 flex-1" disabled={!elegido} loading={guardando} onClick={confirmar}>
          {t("ac.confirmar_cambio")}
        </Button>
      </div>
    </div>
  );
}

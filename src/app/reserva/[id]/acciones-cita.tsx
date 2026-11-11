"use client";

import { ErrorAviso, Fila } from "@/app/lealtad/ui-cliente";
import { Button } from "@/components/ui/button";
import { fechaCorta, hora, hoyISO, sumarDias } from "@/lib/formato";
import { CalendarCheck, MapPin, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { llegueAction, reprogramarAction, slotsReprogramarAction, type SlotLibre } from "./actions-cita";

/** «LLEGUÉ»: avisa al negocio. Intenta con GPS (validación ≤ 0,5 km); si no hay permiso, avisa sin coordenadas. */
export function BotonLlegue({ reservaId, checkinAt, tz }: { reservaId: string; checkinAt: string | null; tz: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (checkinAt) {
    return (
      <div role="status" className="border-2 border-border p-4">
        <span className="sn-label">Ya avisaste tu llegada</span>
        <p className="sn-meta mt-1">Registrada a las {hora(checkinAt, tz)}. El negocio ya sabe que estás aquí.</p>
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
      setError("No pudimos avisar. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <Button size="lg" className="w-full justify-between text-left" loading={cargando} onClick={llegue}>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-base">Llegué</span>
          <span className="sn-meta !text-ink">Avisa al negocio que estás aquí</span>
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
  const [aviso, setAviso] = useState<string | null>(null);

  async function compartir() {
    setAviso(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi cita en StylerNow", text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setAviso("Copiado al portapapeles");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAviso("No pudimos compartir. Copia los datos manualmente.");
    }
  }

  return (
    <Fila icono={<Share2 aria-hidden className="size-5" />} titulo="Compartir" meta={aviso ?? "Envía los datos de tu cita"} onClick={compartir} />
  );
}

const DIAS_VISIBLES = 14;

/** Reprogramar: día (14 días desde hoy) + horas reales del RPC slots_disponibles. */
export function Reprogramar({ reservaId, tz }: { reservaId: string; tz: string }) {
  const router = useRouter();
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
        if (mia === peticion.current) setError("No pudimos cargar los horarios. Revisa tu conexión.");
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
      setError("No pudimos reprogramar. Revisa tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <Fila
        icono={<CalendarCheck aria-hidden className="size-5" />}
        titulo="Reprogramar"
        meta="Cambia el día u hora sin perder tu anticipo"
        onClick={() => setAbierto(true)}
      />
    );
  }

  return (
    <div className="m-4 border-2 border-border p-4 shadow-hard">
      <h3 className="section">Elige un nuevo horario</h3>

      <span className="sn-label mt-4 block">01 / Día</span>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Día">
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
          <span className="sn-label mt-4 block">02 / Hora</span>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Hora">
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
          {slots && slots.length === 0 ? <p className="sn-meta mt-2">No hay horarios libres ese día. Prueba con otro.</p> : null}
        </>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" className="min-w-0 flex-1" onClick={() => setAbierto(false)} disabled={guardando}>
          Volver
        </Button>
        <Button className="min-w-0 flex-1" disabled={!elegido} loading={guardando} onClick={confirmar}>
          Confirmar cambio
        </Button>
      </div>
    </div>
  );
}

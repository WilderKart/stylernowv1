"use client";

import { Bloque, diaYMes, ErrorAviso, horaCorta, Pantalla, Pie, TicketCita, Top } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { alternativasReserva, recuperarReserva, type HorarioAlternativo } from "./recuperar-actions";

export type SituacionRecuperacion =
  | "DISPONIBLE"
  | "NO_DISPONIBLE"
  | "PAGO_REPORTADO_DISPONIBLE"
  | "PAGO_REPORTADO_NO_DISPONIBLE"
  | "NO_RECUPERABLE";

export interface ResumenRecuperacion {
  reservaId: string;
  negocio: string;
  slug: string;
  servicios: string;
  profesional: string;
  horaInicio: string;
  zonaHoraria: string;
  montoTotal: number;
}

function etiquetaHorario(iso: string, zona: string) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: zona }).format(new Date(iso));
}

/**
 * Pantalla que reemplaza el callejón «la reserva expiró»: la expiración solo significa que se perdió el BLOQUEO temporal, no el turno. El
 * servidor ya comprobó la disponibilidad real; aquí se muestra el resultado y se ofrece la acción que corresponde. Un comprobante ya
 * reportado nunca se pierde ni se vuelve a pedir.
 */
export function RecuperarReserva({ situacion, motivo, resumen }: { situacion: SituacionRecuperacion; motivo: string | null; resumen: ResumenRecuperacion }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<HorarioAlternativo[] | null>(null);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);

  const dm = diaYMes(resumen.horaInicio, resumen.zonaHoraria);
  const hora = horaCorta(resumen.horaInicio, resumen.zonaHoraria);
  const conPago = situacion === "PAGO_REPORTADO_DISPONIBLE" || situacion === "PAGO_REPORTADO_NO_DISPONIBLE";

  async function continuar(nuevaHora?: string, nuevoStaff?: string | null) {
    setTrabajando(true);
    setError(null);
    const r = await recuperarReserva(resumen.reservaId, nuevaHora, nuevoStaff ?? undefined);
    if (r.ok) {
      // La pantalla se vuelve a evaluar en el servidor: pago pendiente con nuevo bloqueo, o reserva confirmada.
      router.refresh();
      return;
    }
    setTrabajando(false);
    setError(r.mensaje);
    // Si el turno se ocupó justo ahora, se pasa a la pantalla de otros horarios con la lista actualizada.
    if (r.codigo === "NO_DISPONIBLE") {
      setHorarios(null);
      void verOtros();
      router.refresh();
    }
  }

  async function verOtros() {
    setCargandoHorarios(true);
    setError(null);
    const r = await alternativasReserva(resumen.reservaId);
    setCargandoHorarios(false);
    if (!r.ok) return setError(r.mensaje);
    setHorarios(r.horarios);
  }

  const titulo: Record<SituacionRecuperacion, string> = {
    DISPONIBLE: "Tu tiempo de reserva terminó",
    NO_DISPONIBLE: "Este horario ya no está disponible",
    PAGO_REPORTADO_DISPONIBLE: "Recibimos tu comprobante",
    PAGO_REPORTADO_NO_DISPONIBLE: "Tu pago está registrado",
    NO_RECUPERABLE: "Esta reserva ya no está activa",
  };

  return (
    <Pantalla>
      <Top titulo="Reserva · Tiempo agotado" volverA={`/negocio/${resumen.slug}`} />
      <div className="p-4">
        <TicketCita
          dia={dm.dia}
          mes={dm.mes}
          estado={
            <Status tone="warn" icon={<Clock aria-hidden className="size-3.5" />}>
              {conPago ? "Pago registrado" : "Sin bloqueo"}
            </Status>
          }
          titulo={resumen.servicios}
          lineas={[`${resumen.profesional} · ${hora} · ${resumen.negocio}`]}
          pie={
            <>
              <span className="sn-label">Total</span>
              <span className="sn-fig text-[22px]">{formatCOP(resumen.montoTotal)}</span>
            </>
          }
        />
      </div>

      <Bloque>
        <h1 className="poster-3 mb-3 break-words">{titulo[situacion]}</h1>
        {situacion === "DISPONIBLE" ? (
          <>
            <p className="m-0">El bloqueo temporal de tu turno expiró, pero hemos verificado que el horario todavía está disponible.</p>
            <p className="mt-2 mb-0 font-bold">¡Puedes reservarlo nuevamente!</p>
          </>
        ) : null}
        {situacion === "NO_DISPONIBLE" ? (
          <p className="m-0">
            {motivo === "SERVICIO_NO_DISPONIBLE" || motivo === "PROFESIONAL_NO_DISPONIBLE" || motivo === "NEGOCIO_NO_OPERATIVO"
              ? "Ese turno ya no se puede reservar. No te preocupes, puedes elegir otro horario disponible."
              : "Mientras tu reserva temporal expiraba, otra persona confirmó este turno. No te preocupes, puedes elegir otro horario disponible."}
          </p>
        ) : null}
        {situacion === "PAGO_REPORTADO_DISPONIBLE" ? (
          <p className="m-0">
            Tu tiempo de reserva terminó, pero el horario sigue disponible y tu comprobante está guardado. <b>No tienes que pagar de nuevo.</b>
          </p>
        ) : null}
        {situacion === "PAGO_REPORTADO_NO_DISPONIBLE" ? (
          <p className="m-0">
            Guardamos tu comprobante, pero ese horario ya lo tomó otra persona. Elige otro horario y lo confirmamos con ese mismo pago:{" "}
            <b>no tienes que transferir otra vez.</b>
          </p>
        ) : null}
        {situacion === "NO_RECUPERABLE" ? <p className="m-0">Esta reserva fue cancelada o ya se completó. Puedes reservar de nuevo cuando quieras.</p> : null}
        {conPago && situacion === "PAGO_REPORTADO_NO_DISPONIBLE" ? (
          <p className="mt-3 mb-0 text-[12px] text-text-muted">El negocio verificará que el dinero haya llegado a su cuenta, como en cualquier pago directo.</p>
        ) : null}
      </Bloque>

      {/* Otros horarios (mismo servicio y sede) */}
      {horarios ? (
        <Bloque etiqueta="Horarios disponibles">
          {horarios.length === 0 ? (
            <p className="m-0">Por ahora no hay horarios libres en los próximos días.</p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {horarios.map((h) => (
                <li key={`${h.horaInicio}-${h.staffId}`}>
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => void continuar(h.horaInicio, h.staffId)}
                    className="flex min-h-14 w-full flex-col items-start justify-center border-2 border-border bg-bg px-3 py-2 text-left hover:border-ink disabled:opacity-60"
                  >
                    <span className="text-[13px] font-bold capitalize">{etiquetaHorario(h.horaInicio, resumen.zonaHoraria)}</span>
                    {h.staffNombre ? <span className="text-[11px] text-text-muted">{h.staffNombre}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Bloque>
      ) : null}

      {error ? (
        <div className="px-4 pt-4">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="flex-1" />
      <Pie>
        {situacion === "DISPONIBLE" ? (
          <>
            <Button size="lg" className="w-full" loading={trabajando} onClick={() => void continuar()}>
              CONTINUAR CON ESTE HORARIO
            </Button>
            <p className="m-0 text-center text-[12px] text-text-muted">Se generará un nuevo bloqueo temporal para completar tu reserva.</p>
            <Button variant="secondary" size="lg" className="w-full" loading={cargandoHorarios} disabled={trabajando} onClick={() => void verOtros()}>
              Prefiero otro horario
            </Button>
          </>
        ) : null}
        {situacion === "PAGO_REPORTADO_DISPONIBLE" ? (
          <>
            <Button size="lg" className="w-full" loading={trabajando} onClick={() => void continuar()}>
              RECUPERAR MI TURNO
            </Button>
            <Button variant="secondary" size="lg" className="w-full" loading={cargandoHorarios} disabled={trabajando} onClick={() => void verOtros()}>
              Prefiero otro horario
            </Button>
          </>
        ) : null}
        {(situacion === "NO_DISPONIBLE" || situacion === "PAGO_REPORTADO_NO_DISPONIBLE") && !horarios ? (
          <Button size="lg" className="w-full" loading={cargandoHorarios} onClick={() => void verOtros()}>
            VER OTROS HORARIOS
          </Button>
        ) : null}
        {situacion === "NO_RECUPERABLE" || (horarios && horarios.length === 0 && !conPago) ? (
          <Link href={`/negocio/${resumen.slug}/reservar`} className="sn-btn sn-btn--primary w-full text-center">
            <span>Reservar de nuevo</span>
          </Link>
        ) : null}
      </Pie>
    </Pantalla>
  );
}

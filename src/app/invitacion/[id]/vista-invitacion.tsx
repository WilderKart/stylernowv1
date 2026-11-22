"use client";

import { Button } from "@/components/ui/button";
import { Casilla } from "@/components/privacidad/casilla";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Aviso } from "../../login/_componentes/campos";
import { ErrorForm, Hot, PantallaAuth } from "../../login/_componentes/pantalla-auth";
import { continuarInvitacion, responderInvitacion, salirParaCambiarCuenta } from "./actions";

const ESTADO_TEXTO: Record<string, string> = {
  ACEPTADA: "Esta invitación ya fue aceptada.",
  RECHAZADA: "Esta invitación fue rechazada.",
  CANCELADA: "Quien te invitó canceló esta invitación.",
  EXPIRADA: "Esta invitación expiró. Pídele a quien te invitó que te envíe una nueva.",
};

type Props = {
  modo: "sin-sesion" | "otra-cuenta" | "responder";
  invitacionId: string;
  negocio: string;
  emailEnmascarado: string;
  estado: string;
  sede?: string | null;
  textoTratamiento?: string;
};

export function VistaInvitacion({ modo, invitacionId, negocio, emailEnmascarado, estado, sede, textoTratamiento }: Props) {
  const [cargando, setCargando] = useState<null | "continuar" | "aceptar" | "rechazar" | "salir">(null);
  const [error, setError] = useState<string | null>(null);
  const [autoriza, setAutoriza] = useState(false);
  const [rechazada, setRechazada] = useState(false);
  const pendiente = estado === "PENDIENTE" && !rechazada;

  async function onContinuar() {
    setCargando("continuar");
    setError(null);
    const res = await continuarInvitacion(invitacionId);
    if (!res.ok) {
      setCargando(null);
      setError(res.error);
      return;
    }
    window.location.assign(res.data.destino);
  }

  async function onResponder(aceptar: boolean) {
    if (aceptar && !autoriza) {
      setError("Para unirte al equipo marca la autorización de tratamiento de datos.");
      return;
    }
    setCargando(aceptar ? "aceptar" : "rechazar");
    setError(null);
    const res = await responderInvitacion(invitacionId, aceptar, autoriza);
    if (!res.ok) {
      setCargando(null);
      setError(res.error);
      return;
    }
    if (aceptar) {
      // Navegación completa: el contexto (rol Staff) cambió en el servidor.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navegación completa a propósito: cambió el rol
      window.location.assign("/staff/perfil?bienvenida=1");
      return;
    }
    setCargando(null);
    setRechazada(true);
  }

  async function onSalir() {
    setCargando("salir");
    await salirParaCambiarCuenta();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navegación completa a propósito: se cerró la sesión
    window.location.assign(`/invitacion/${invitacionId}`);
  }

  return (
    <PantallaAuth
      indice="Invitación"
      volver="/"
      titulo={
        <>
          {negocio}
          <br />
          <Hot>te invitó a su equipo.</Hot>
        </>
      }
      intro={`Invitación para ${emailEnmascarado}${sede ? ` · Sede ${sede}` : ""}. Te unes como profesional (Staff).`}
    >
      <div className="flex flex-col gap-4">
        {!pendiente ? (
          <Aviso>{rechazada ? "Rechazaste esta invitación." : (ESTADO_TEXTO[estado] ?? "Esta invitación ya no está disponible.")}</Aviso>
        ) : modo === "sin-sesion" ? (
          <>
            <p className="body m-0">
              Para unirte necesitas una cuenta de StylerNow con ese mismo correo. Si ya la tienes, solo ingresas; si no, la creas
              en un minuto.
            </p>
            {error ? <ErrorForm>{error}</ErrorForm> : null}
            <Button size="lg" className="w-full justify-between" loading={cargando === "continuar"} onClick={onContinuar}>
              <span>Continuar con mi invitación</span>
              <ArrowUpRight className="size-[18px]" aria-hidden />
            </Button>
          </>
        ) : modo === "otra-cuenta" ? (
          <>
            <Aviso>Estás usando una cuenta con otro correo. Esta invitación es para {emailEnmascarado}.</Aviso>
            {error ? <ErrorForm>{error}</ErrorForm> : null}
            <Button size="lg" className="w-full justify-between" loading={cargando === "salir"} onClick={onSalir}>
              <span>Cambiar de cuenta</span>
              <ArrowUpRight className="size-[18px]" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Casilla
              caja
              checked={autoriza}
              onChange={(v) => {
                setAutoriza(v);
                if (v) setError(null);
              }}
              etiqueta="Obligatoria para unirte"
              descripcion={
                <>
                  {textoTratamiento}{" "}
                  <Link href="/legal/politica-de-datos" target="_blank" className="font-bold underline underline-offset-2">
                    Ver Política de Tratamiento de Datos
                  </Link>
                </>
              }
            />
            <p className="sn-meta m-0">
              Después podrás decidir, aparte y cuando quieras, si tu perfil (nombre, foto, especialidad y descripción) se muestra
              a los clientes.
            </p>
            {error ? <ErrorForm>{error}</ErrorForm> : null}
            <Button size="lg" className="w-full justify-between" loading={cargando === "aceptar"} disabled={cargando !== null} onClick={() => onResponder(true)}>
              <span>Aceptar y unirme</span>
              <ArrowUpRight className="size-[18px]" aria-hidden />
            </Button>
            <Button variant="secondary" size="lg" className="w-full" loading={cargando === "rechazar"} disabled={cargando !== null} onClick={() => onResponder(false)}>
              Rechazar invitación
            </Button>
          </>
        )}
      </div>
    </PantallaAuth>
  );
}

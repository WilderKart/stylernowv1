"use client";

import { Button } from "@/components/ui/button";
import { Casilla } from "@/components/privacidad/casilla";
import { ArrowUpRight, ChevronLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { continuarInvitacion, responderInvitacion, salirParaCambiarCuenta } from "./actions";

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="pn-card m-0 bg-[var(--surface)] px-4 py-3 text-[13.5px] leading-snug text-[var(--text)]">{children}</p>;
}
function ErrorForm({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="pn-card m-0 bg-[var(--pn-rose-soft)] px-4 py-3 text-[13px] font-semibold leading-snug text-[var(--pn-rose)]">
      {children}
    </p>
  );
}

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
    <div data-vertical="salon" data-panel="suave" className="flex min-h-dvh flex-col bg-[var(--app-bg)] text-[var(--text)]">
      <header className="flex items-center gap-2 px-3 py-3 sm:px-6">
        <Link href="/" className="grid size-11 place-items-center rounded-full bg-[var(--bg)] text-[var(--text)] shadow-[var(--sn-shadow-hard-sm)]" aria-label="Volver al inicio">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <span className="text-[18px] font-extrabold">
          Styler<span className="text-[var(--accent-text)]">Now</span>
        </span>
      </header>
      <main className="flex flex-1 items-start justify-center px-3 pb-10 pt-2 sm:items-center sm:px-6">
        <section className="pn-card w-full max-w-[480px] bg-[var(--bg)] p-5 shadow-[var(--sn-shadow-hard)] ring-1 ring-[var(--line)] sm:p-8">
          <span className="pn-pill inline-flex items-center gap-2 bg-[var(--pn-violet-soft)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--pn-violet)]">
            <UserPlus className="size-4" aria-hidden /> Invitación al equipo
          </span>
          <h1 className="mt-4 break-words text-[clamp(26px,7vw,34px)] font-extrabold leading-tight">
            {negocio}
            <span className="block text-[var(--accent-text)]">te invitó a su equipo.</span>
          </h1>
          <p className="mt-3 break-words text-[14px] leading-relaxed text-[var(--text-muted)]">
            {`Invitación para ${emailEnmascarado}${sede ? ` · Sede ${sede}` : ""}. Te unes como profesional (Staff).`}
          </p>
          <div className="mt-6 flex flex-col gap-4">
        {!pendiente ? (
          <Aviso>{rechazada ? "Rechazaste esta invitación." : (ESTADO_TEXTO[estado] ?? "Esta invitación ya no está disponible.")}</Aviso>
        ) : modo === "sin-sesion" ? (
          <>
            <p className="m-0 text-[14px] leading-relaxed text-[var(--text-muted)]">
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
            <p className="m-0 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
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
        </section>
      </main>
    </div>
  );
}

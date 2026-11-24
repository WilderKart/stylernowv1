"use client";

import { cn } from "@/lib/utils";
import { BadgeCheck, ChevronRight, Scissors, UserCircle2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface DatosAsistente {
  servicios: number;
  equipo: number;
  /** Límite de profesionales del plan (null = sin tope definido). */
  equipoTope: number | null;
  planNombre: string;
  perfilCompleto: boolean;
  verificacion: string;
}

const CLAVE_OCULTO = "sn_asistente_oculto";
const CLAVE_SIN_EQUIPO = "sn_asistente_sin_equipo";

function leer(clave: string) {
  try {
    return window.localStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}
function escribir(clave: string) {
  try {
    window.localStorage.setItem(clave, "1");
  } catch {
    /* sin almacenamiento: es solo comodidad visual */
  }
}

/**
 * Asistente de bienvenida del panel: tareas posteriores al alta. Ninguna bloquea el uso del panel.
 * Las tareas se calculan en el servidor; ocultarlas aquí es solo una preferencia visual de este navegador.
 */
export function AsistenteBienvenida({ datos }: { datos: DatosAsistente }) {
  const [oculto, setOculto] = useState(false);
  const [sinEquipo, setSinEquipo] = useState(false);
  useEffect(() => {
    // Lee la preferencia del navegador tras montar (en el servidor no existe localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOculto(leer(CLAVE_OCULTO));
    setSinEquipo(leer(CLAVE_SIN_EQUIPO));
  }, []);

  const verificada = datos.verificacion === "VERIFICADA";
  const tareas = [
    {
      clave: "servicios",
      icono: Scissors,
      titulo: "Configura tus servicios",
      detalle: "Agrega tus primeros dos servicios para que tus clientes puedan reservar.",
      accion: "AGREGAR SERVICIOS",
      href: "/panel/servicios",
      hecha: datos.servicios >= 2,
      estado: datos.servicios + " de 2",
    },
    {
      clave: "equipo",
      icono: Users,
      titulo: "Invita a tu equipo",
      detalle:
        "Incorpora profesionales para organizar tus turnos y servicios." +
        (datos.equipoTope !== null
          ? " Tu plan " + datos.planNombre + " incluye hasta " + datos.equipoTope + (datos.equipoTope === 1 ? " profesional." : " profesionales.")
          : ""),
      accion: "INVITAR PROFESIONALES",
      href: "/panel/staff/nuevo",
      hecha: datos.equipo >= 1 || sinEquipo,
      estado: sinEquipo ? "Omitida" : datos.equipo + (datos.equipoTope !== null ? " de " + datos.equipoTope : ""),
      omitible: true,
    },
    {
      clave: "perfil",
      icono: UserCircle2,
      titulo: "Completa tu perfil público",
      detalle: "Descripción, fotografía principal, contacto, servicios y horarios.",
      accion: "COMPLETAR PERFIL",
      href: "/panel/perfil-publico",
      hecha: datos.perfilCompleto,
      estado: datos.perfilCompleto ? "Completo" : "Pendiente",
    },
    {
      clave: "verificacion",
      icono: BadgeCheck,
      titulo: "Verifica tu negocio",
      detalle: "Aumenta la confianza de tus clientes demostrando que tu establecimiento existe.",
      accion: datos.verificacion === "NO_INICIADA" ? "INICIAR VERIFICACIÓN" : "VER MI VERIFICACIÓN",
      href: "/panel/verificacion",
      hecha: verificada,
      estado: verificada ? "Verificado" : datos.verificacion === "EN_REVISION" ? "Documentos en revisión" : "Pendiente",
    },
  ];
  const hechas = tareas.filter((t) => t.hecha).length;

  if (oculto || hechas === tareas.length) return null;

  return (
    <section aria-labelledby="asistente-titulo" className="mb-8 border-2 border-ink bg-app shadow-hard dark:border-border">
      <div className="border-b-2 border-ink bg-signal px-4 py-3 text-ink dark:border-border">
        <h2 id="asistente-titulo" className="font-display text-[clamp(22px,7vw,30px)] font-bold uppercase leading-none">
          ¡Bienvenido a StylerNow!
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug">
          Tu negocio ya está creado. Ahora puedes preparar todo para comenzar a recibir reservas.
        </p>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-wide text-text">
          <span>Tu configuración</span>
          <span>{hechas} de {tareas.length} completadas</span>
        </div>
        <div className="mt-1.5 h-2 w-full border-2 border-border bg-app" role="progressbar" aria-valuemin={0} aria-valuemax={tareas.length} aria-valuenow={hechas}>
          <div className="h-full bg-signal" style={{ width: (hechas / tareas.length) * 100 + "%" }} />
        </div>
      </div>

      <ul className="flex flex-col gap-2 p-4">
        {tareas.map((t) => {
          const Icono = t.icono;
          return (
            <li key={t.clave} className={cn("border-2 border-border", t.hecha && "bg-surface")}>
              <Link href={t.href} className="flex items-start gap-3 p-3">
                <Icono className={cn("mt-0.5 !size-5 shrink-0", t.hecha ? "text-text-faint" : "text-accent")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("text-[14px] font-bold text-text", t.hecha && "line-through decoration-2")}>{t.titulo}</span>
                    <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-text-muted">{t.estado}</span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-text-muted">{t.detalle}</span>
                  {!t.hecha ? (
                    <span className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wide text-accent">
                      {t.accion} <ChevronRight className="!size-3.5" aria-hidden />
                    </span>
                  ) : null}
                </span>
              </Link>
              {t.omitible && !t.hecha ? (
                <button
                  type="button"
                  onClick={() => {
                    escribir(CLAVE_SIN_EQUIPO);
                    setSinEquipo(true);
                  }}
                  className="mx-3 mb-3 text-[12px] font-bold text-text underline underline-offset-4"
                >
                  Trabajo solo, omitir por ahora
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="border-t-2 border-border px-4 py-2.5 text-right">
        <button
          type="button"
          onClick={() => {
            escribir(CLAVE_OCULTO);
            setOculto(true);
          }}
          className="text-[12px] font-bold text-text-muted underline underline-offset-4"
        >
          Ocultar asistente
        </button>
      </div>
    </section>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarVentana, type ConfigVentana } from "./actions";

const MAXIMOS = [
  { dias: 7, texto: "1 semana" },
  { dias: 14, texto: "2 semanas" },
  { dias: 30, texto: "1 mes" },
  { dias: 60, texto: "2 meses (estándar)" },
  { dias: 90, texto: "3 meses" },
  { dias: 120, texto: "4 meses" },
  { dias: 180, texto: "6 meses" },
  { dias: 270, texto: "9 meses" },
  { dias: 365, texto: "1 año" },
];
const MINIMOS = [
  { min: 0, texto: "Sin mínimo (hasta el último minuto)" },
  { min: 30, texto: "30 minutos antes" },
  { min: 60, texto: "1 hora antes" },
  { min: 120, texto: "2 horas antes" },
  { min: 180, texto: "3 horas antes" },
  { min: 360, texto: "6 horas antes" },
  { min: 720, texto: "12 horas antes" },
  { min: 1440, texto: "1 día antes" },
  { min: 2880, texto: "2 días antes" },
];

/** Fecha límite de ejemplo ("hasta el 26 de enero de 2027"), solo para explicar el valor elegido. */
function fechaLimite(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

const textoMinimo = (min: number) =>
  min === 0
    ? "Tus clientes pueden reservar incluso para dentro de unos minutos."
    : `Un cliente ya no puede reservar un turno que empiece en menos de ${MINIMOS.find((m) => m.min === min)?.texto.replace(" antes", "") ?? `${min} minutos`}. Ejemplo: si son las 3:00 p. m. y pides 2 horas, el primer turno que verá libre es el de las 5:00 p. m.`;

export function VistaVentana({ ventana }: { ventana: ConfigVentana }) {
  const router = useRouter();
  const [dias, setDias] = useState(ventana.maxDias);
  const [min, setMin] = useState(ventana.minMinutos);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Si el negocio ya tenía un valor fuera de las opciones (cargado a mano), se conserva como opción para no cambiarlo sin querer.
  const maximos = MAXIMOS.some((m) => m.dias === ventana.maxDias) ? MAXIMOS : [...MAXIMOS, { dias: ventana.maxDias, texto: `${ventana.maxDias} días (actual)` }].sort((a, b) => a.dias - b.dias);
  const minimos = MINIMOS.some((m) => m.min === ventana.minMinutos) ? MINIMOS : [...MINIMOS, { min: ventana.minMinutos, texto: `${ventana.minMinutos} minutos antes (actual)` }].sort((a, b) => a.min - b.min);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarVentana({ minMinutos: min, maxDias: dias });
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje({ tipo: "ok", texto: "Guardado. El calendario de tus clientes ya usa esta ventana; las reservas que ya existen no cambian." });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="section">Ventana de reservas</h2>
        <p className="sn-meta mt-1">
          Define cuándo pueden reservar tus clientes: qué tan lejos en el futuro y con cuánto tiempo mínimo antes de la cita. Se aplica a todas tus sedes y
          profesionales, y solo a reservas nuevas.
        </p>
      </header>

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2 p-4">
          <label htmlFor="max-dias" className="text-[13px] font-bold">
            ¿Hasta cuántos días adelante pueden reservar?
          </label>
          <select id="max-dias" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="h-11 border-2 border-ink bg-bg px-2 text-[14px]">
            {maximos.map((m) => (
              <option key={m.dias} value={m.dias}>
                {m.texto}
              </option>
            ))}
          </select>
          <p className="sn-meta m-0">
            Es el último día que el cliente puede elegir en el calendario. Con tu ajuste, hoy podrían reservar <b>hasta el {fechaLimite(dias)}</b>. Más allá de esa fecha el
            calendario no deja avanzar ni muestra horarios. Se mueve cada día: mañana el límite avanza un día.
          </p>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <label htmlFor="min-anticipacion" className="text-[13px] font-bold">
            ¿Con cuánto tiempo mínimo antes de la cita?
          </label>
          <select id="min-anticipacion" value={min} onChange={(e) => setMin(Number(e.target.value))} className="h-11 border-2 border-ink bg-bg px-2 text-[14px]">
            {minimos.map((m) => (
              <option key={m.min} value={m.min}>
                {m.texto}
              </option>
            ))}
          </select>
          <p className="sn-meta m-0">{textoMinimo(min)}</p>
        </Card>

        {mensaje ? (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={`border-2 p-3 text-[13px] font-bold ${mensaje.tipo === "error" ? "border-danger text-danger" : "border-border"}`}
          >
            {mensaje.texto}
          </p>
        ) : null}
        <Button type="submit" loading={pendiente} disabled={pendiente || (dias === ventana.maxDias && min === ventana.minMinutos)}>
          Guardar ventana de reservas
        </Button>
      </form>
    </section>
  );
}

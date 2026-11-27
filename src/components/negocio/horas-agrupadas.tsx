"use client";

import { Meta } from "@/components/brutal";
import { CloudSun, Moon, Sun } from "lucide-react";
import { hora } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface SlotHora {
  hora_inicio: string;
  disponible: boolean;
}

type FranjaHora = "Mañana" | "Tarde" | "Noche";
const ICONO = { Mañana: Sun, Tarde: CloudSun, Noche: Moon } as const;

/** Corte por hora local de la Sede: <12 Mañana, 12–17:59 Tarde, ≥18 Noche. */
function franjaDe(instante: string, tz?: string): FranjaHora {
  const h = parseInt(hora(instante, tz).slice(0, 2), 10) % 24;
  return h < 12 ? "Mañana" : h < 18 ? "Tarde" : "Noche";
}

function agruparSlots<T extends SlotHora>(slots: T[], tz?: string) {
  const orden: FranjaHora[] = ["Mañana", "Tarde", "Noche"];
  return orden
    .map((franja) => ({ franja, items: slots.filter((s) => franjaDe(s.hora_inicio, tz) === franja) }))
    .filter((g) => g.items.length > 0);
}

/** Horarios agrupados en Mañana / Tarde / Noche; los ocupados se muestran tachados. */
export function SlotsPorFranja<T extends SlotHora>({
  slots,
  tz,
  elegido,
  onElegir,
}: {
  slots: T[];
  tz?: string;
  elegido: string | null;
  onElegir: (s: T) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {agruparSlots(slots, tz).map((g) => (
        <div key={g.franja}>
          <div className="flex items-center gap-2 pb-2">
            {(() => {
              const Icono = ICONO[g.franja];
              return <Icono className="size-6 flex-none text-signal" aria-hidden />;
            })()}
            <span className="font-mono text-[15px] font-bold tracking-wide text-signal uppercase">{g.franja}</span>
            <Meta>· {g.items.filter((x) => x.disponible).length} libres</Meta>
          </div>
          <div className="sn-slots">
            {g.items.map((s) => (
              <button
                key={s.hora_inicio}
                type="button"
                disabled={!s.disponible}
                onClick={() => onElegir(s)}
                aria-pressed={elegido === s.hora_inicio}
                className={cn("sn-slot", elegido === s.hora_inicio && "is-selected")}
              >
                {hora(s.hora_inicio, tz)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


"use client";

import { Meta, Num } from "@/components/brutal";
import { hora } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface SlotHora {
  hora_inicio: string;
  disponible: boolean;
}

type FranjaHora = "Mañana" | "Tarde" | "Noche";

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
          <div className="sn-row pb-2">
            <Num>{g.franja}</Num>
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


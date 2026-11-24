import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import { requireSuperSU } from "@/lib/auth/require-supersu";
import { MuestraTema } from "./muestra-tema";

export const metadata = { title: "Temas por categoría", robots: { index: false, follow: false } };

const TEMAS = [
  { clave: "barberia", nombre: "Barbería y tattoo (diseño original)", nota: "Sin cambios: así se ven hoy." },
  { clave: "spa", nombre: "Spa", nota: "Salvia, arena, perla y durazno. Serif suave." },
  { clave: "salon", nombre: "Salón de belleza", nota: "Rosa empolvado, greige y orquídea." },
  { clave: "unas", nombre: "Estudio de uñas", nota: "Durazno cálido y terracota; distinto del spa." },
] as const;

/** Vista previa interna de los temas por categoría, en claro y oscuro, con los componentes reales. Solo SuperSU. */
export default async function TemasPage() {
  await requireSuperSU();
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoAdmin
        seccion="Diseño"
        titulo="Temas por"
        resaltado="categoría"
        descripcion="Vista previa de cada tema en modo claro y oscuro. Barbería y tattoo no cambian; spa, salón y uñas usan un diseño más suave."
      />
      {TEMAS.map((t) => (
        <section key={t.clave} aria-labelledby={`tema-${t.clave}`} className="flex flex-col gap-3">
          <div>
            <h2 id={`tema-${t.clave}`} className="font-display text-[18px] font-bold uppercase text-text">
              {t.nombre}
            </h2>
            <p className="text-[12.5px] text-text-muted">{t.nota}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <MuestraTema tema={t.clave} modo="light" />
            <MuestraTema tema={t.clave} modo="dark" />
          </div>
        </section>
      ))}
    </div>
  );
}

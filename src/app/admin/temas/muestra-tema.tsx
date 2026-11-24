import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarDays, Compass, Heart, Scissors, Sparkles, Ticket, User } from "lucide-react";

type Tema = "barberia" | "spa" | "salon" | "unas";

const COPIA: Record<Tema, { eyebrow: string; titulo: string; acento: string; bajada: string; servicio: string; negocio: string; categorias: string[] }> = {
  barberia: { eyebrow: "01 / Barbería", titulo: "Tu estilo. Tu hora.", acento: "Sin fila.", bajada: "Reserva con los mejores barberos de tu ciudad.", servicio: "Corte clásico", negocio: "Barbería Kevin", categorias: ["Corte", "Barba", "Afeitado"] },
  spa: { eyebrow: "01 / Spa", titulo: "Respira. Desconecta.", acento: "Vuelve.", bajada: "Relaja tu cuerpo, renueva tu energía y cuida tu bienestar.", servicio: "Masaje relajante", negocio: "Oasis Urbano Spa", categorias: ["Masajes", "Faciales", "Bienestar"] },
  salon: { eyebrow: "01 / Salón", titulo: "Tu look. Tu momento.", acento: "Tu brillo.", bajada: "Corte, color y tratamientos para resaltar tu belleza.", servicio: "Corte y peinado", negocio: "Salón Aurora", categorias: ["Corte", "Color", "Tratamientos"] },
  unas: { eyebrow: "01 / Uñas", titulo: "Tus uñas. Tu estilo.", acento: "Tu arte.", bajada: "Diseños únicos y cuidado profesional para tus uñas.", servicio: "Manicura en gel", negocio: "Glow Nails Studio", categorias: ["Manicura", "Diseños", "Escultura"] },
};

/**
 * Muestra de un tema (claro u oscuro) con los componentes reales de la app. Barbería no lleva tema suave: usa data-theme
 * para mostrar el diseño original; los demás usan data-tema-vista (+ data-modo="dark").
 */
export function MuestraTema({ tema, modo }: { tema: Tema; modo: "light" | "dark" }) {
  const c = COPIA[tema];
  const atributos =
    tema === "barberia" ? { "data-theme": modo } : ({ "data-tema-vista": tema, ...(modo === "dark" ? { "data-modo": "dark" } : {}) } as Record<string, string>);

  return (
    <div
      {...atributos}
      aria-label={`Muestra ${tema} ${modo === "dark" ? "oscuro" : "claro"}`}
      className="flex flex-col gap-4 overflow-hidden border-2 border-border bg-app p-4 text-text"
      style={tema === "barberia" ? undefined : { borderRadius: "var(--r-card)", background: "var(--app-bg)", color: "var(--text)" }}
    >
      <p className="sn-label text-text-muted">{modo === "dark" ? "Modo oscuro" : "Modo claro"}</p>

      {/* Encabezado del perfil */}
      <div className="flex flex-col gap-1.5">
        <span className="sn-num">{c.eyebrow}</span>
        <h3 className="font-display text-[32px] font-black uppercase leading-[0.95] text-text">
          {c.titulo} <span className="text-accent">{c.acento}</span>
        </h3>
        <p className="text-[14px] leading-relaxed text-text-muted">{c.bajada}</p>
      </div>

      {/* Búsqueda y chips */}
      <Input label="Buscar" placeholder="Busca un negocio, servicio o ciudad" readOnly />
      <div className="flex flex-wrap gap-2">
        {c.categorias.map((cat, i) => (
          <span key={cat} className={i === 0 ? "sn-chip is-selected !bg-signal !text-ink" : "sn-chip"}>
            {cat}
          </span>
        ))}
      </div>

      {/* Tarjeta de negocio */}
      <Card className="flex flex-col gap-3 shadow-hard">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[20px] font-bold text-text">{c.negocio}</p>
            <p className="text-[12.5px] text-text-muted">Cali · Desde $ 45.000</p>
          </div>
          <Badge tone="success">Abierto</Badge>
        </div>
        <ul className="flex flex-col gap-2 text-[13px]">
          <li className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="flex items-center gap-2 text-text">
              <Scissors aria-hidden className="size-4 text-accent" /> {c.servicio}
            </span>
            <span className="text-text-muted">45 min · $ 45.000</span>
          </li>
          <li className="flex items-center justify-between text-text-muted">
            <span className="flex items-center gap-2">
              <CalendarDays aria-hidden className="size-4 text-accent" /> Próximo horario libre
            </span>
            <span className="text-text">Hoy 4:30 p. m.</span>
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="md">Reservar turno</Button>
          <Button size="md" variant="ink">
            Ver perfil
          </Button>
          <Button size="md" variant="secondary">
            Compartir
          </Button>
        </div>
      </Card>

      {/* Estados y campos */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="accent">Acento</Badge>
        <Badge tone="success">Confirmada</Badge>
        <Badge tone="danger">Cancelada</Badge>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted">
          <Sparkles aria-hidden className="size-4 text-accent" /> Texto secundario legible
        </span>
      </div>
      <Input label="Nombre" defaultValue="Laura Gómez" readOnly />

      {/* Barra de pestañas */}
      <nav className="sn-tabbar" aria-label="Muestra de pestañas" style={{ height: 56 }}>
        {[
          { n: "Explorar", I: Compass, a: true },
          { n: "Citas", I: Ticket, a: false },
          { n: "Favoritos", I: Heart, a: false },
          { n: "Perfil", I: User, a: false },
        ].map(({ n, I, a }) => (
          <span key={n} className={a ? "sn-tab is-active" : "sn-tab"}>
            <I aria-hidden />
            {n}
          </span>
        ))}
      </nav>
    </div>
  );
}

"use client";

import { Chip, ChipGroup } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATALOGO_SERVICIOS, CATEGORIAS_CATALOGO, categoriaDe, normalizar, type ServicioCatalogo } from "@/lib/servicios/catalogo";
import { formatCOP } from "@/lib/utils";
import { Check, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { agregarDesdeCatalogo } from "./actions";

interface Opcion {
  id: string;
  nombre: string;
}

const PAGINA = 24;
const DURACIONES = [15, 30, 45, 60, 90];

export function CatalogoServicios({
  negocioId,
  agregadosIniciales,
  sedes,
  equipo,
}: {
  negocioId: string;
  /** Claves del catálogo que el negocio ya tiene ACTIVAS. */
  agregadosIniciales: string[];
  sedes: Opcion[];
  equipo: Opcion[];
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("todas");
  const [visibles, setVisibles] = useState(PAGINA);
  const [agregados, setAgregados] = useState(() => new Set(agregadosIniciales));
  const [elegido, setElegido] = useState<ServicioCatalogo | null>(null);

  const lista = useMemo(() => {
    const n = normalizar(q);
    return CATALOGO_SERVICIOS.filter((s) => (cat === "todas" || s.categoria === cat) && (!n || normalizar(s.nombre).includes(n)));
  }, [q, cat]);

  return (
    <>
      <div className="mb-4">
        <Input
          aria-label="Buscar en el catálogo"
          placeholder="Busca un servicio: fade, barba, manicura…"
          leadingIcon={<Search className="size-4" aria-hidden />}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setVisibles(PAGINA);
          }}
        />
      </div>
      <ChipGroup className="mb-5 flex-wrap">
        <Chip selected={cat === "todas"} onClick={() => { setCat("todas"); setVisibles(PAGINA); }}>
          Todos · {CATALOGO_SERVICIOS.length}
        </Chip>
        {CATEGORIAS_CATALOGO.map((c) => (
          <Chip key={c.id} selected={cat === c.id} onClick={() => { setCat(c.id); setVisibles(PAGINA); }}>
            {c.etiqueta} · {CATALOGO_SERVICIOS.filter((s) => s.categoria === c.id).length}
          </Chip>
        ))}
      </ChipGroup>

      {lista.length === 0 ? (
        <p className="border-2 border-dashed border-border p-8 text-center text-[13px] text-text-muted">
          No encontramos ese servicio en el catálogo. Puedes crearlo tú con{" "}
          <Link href="/panel/servicios/nuevo" className="font-bold underline">
            «Crear servicio propio»
          </Link>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.slice(0, visibles).map((s) => {
            const ya = agregados.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={ya}
                  onClick={() => setElegido(s)}
                  aria-label={ya ? `${s.nombre}: ya está en tu menú` : `Agregar ${s.nombre}`}
                  className="group relative block w-full border-2 border-border bg-surface text-left transition-transform enabled:hover:-translate-y-0.5 enabled:hover:shadow-hard-sm disabled:opacity-70"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imagen} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full border-b-2 border-border object-cover" />
                  <span className="block p-2.5">
                    <span className="block truncate text-[13px] font-bold text-text">{s.nombre}</span>
                    <span className="mt-0.5 block text-[11px] text-text-muted">{categoriaDe(s.categoria).etiqueta}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`absolute right-2 top-2 flex size-8 items-center justify-center border-2 border-ink ${ya ? "bg-success text-ink" : "bg-signal text-ink"}`}
                  >
                    {ya ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lista.length > visibles ? (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={() => setVisibles((v) => v + PAGINA)}>
            Ver más ({lista.length - visibles})
          </Button>
        </div>
      ) : null}

      {agregados.size > agregadosIniciales.length ? (
        <div className="sticky bottom-4 mt-6 flex justify-center">
          <Link href="/panel/servicios" className="border-2 border-ink bg-signal px-4 py-3 text-[12.5px] font-bold uppercase text-ink shadow-hard">
            Listo · ver mis servicios
          </Link>
        </div>
      ) : null}

      <Dialog open={elegido !== null} onOpenChange={(abierto) => !abierto && setElegido(null)}>
        {elegido ? (
          <ModalAgregar
            key={elegido.id}
            item={elegido}
            negocioId={negocioId}
            sedes={sedes}
            equipo={equipo}
            alAgregar={() => {
              setAgregados((prev) => new Set(prev).add(elegido.id));
              setElegido(null);
              toast.success(`«${elegido.nombre}» ya está en tu menú.`);
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function ModalAgregar({
  item,
  negocioId,
  sedes,
  equipo,
  alAgregar,
}: {
  item: ServicioCatalogo;
  negocioId: string;
  sedes: Opcion[];
  equipo: Opcion[];
  alAgregar: () => void;
}) {
  const cat = categoriaDe(item.categoria);
  const [precio, setPrecio] = useState("");
  const [duracion, setDuracion] = useState(String(cat.duracionSugerida));
  const [descripcion, setDescripcion] = useState("");
  const [sedesSel, setSedesSel] = useState<Set<string>>(() => new Set(sedes.map((s) => s.id)));
  const [equipoSel, setEquipoSel] = useState<Set<string>>(() => new Set(equipo.map((e) => e.id)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternar = (set: Set<string>, id: string, aplicar: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    aplicar(n);
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = Number(precio);
    const d = Number(duracion);
    if (!precio.trim() || !Number.isFinite(p) || p < 0) return setError("Escribe el precio del servicio.");
    if (!Number.isInteger(d) || d < 5 || d > 480) return setError("La duración debe estar entre 5 y 480 minutos.");
    if (sedesSel.size === 0) return setError("Elige al menos una sede.");
    setGuardando(true);
    const r = await agregarDesdeCatalogo({
      negocioId,
      catalogoId: item.id,
      precio: p,
      duracion: d,
      descripcion: descripcion || undefined,
      sedes: [...sedesSel],
      staff: [...equipoSel],
    });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    alAgregar();
  }

  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.imagen} alt={item.nombre} className="aspect-[16/9] w-full border-b-2 border-border object-cover" />
      <form onSubmit={enviar} className="grid gap-4 p-5 pt-1">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px] uppercase">{item.nombre}</DialogTitle>
          <DialogDescription>
            {cat.etiqueta}. Define cuánto cobras y cuánto dura; la imagen ya viene incluida.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Precio (COP)" type="number" inputMode="numeric" min={0} required value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus />
          <Input label="Duración (min)" type="number" inputMode="numeric" min={5} max={480} required value={duracion} onChange={(e) => setDuracion(e.target.value)} />
        </div>
        {Number(precio) > 0 ? <p className="-mt-2 text-[11.5px] text-text-muted">Se mostrará como {formatCOP(Number(precio))}.</p> : null}
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {DURACIONES.map((d) => (
            <button key={d} type="button" onClick={() => setDuracion(String(d))} className={`border-2 px-2.5 py-1 text-[11.5px] font-bold ${Number(duracion) === d ? "border-ink bg-signal text-ink" : "border-border text-text-muted"}`}>
              {d} min
            </button>
          ))}
        </div>

        <Input label="Descripción (opcional)" maxLength={300} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

        <fieldset>
          <legend className="sn-label mb-1.5">¿En qué sedes lo ofreces?</legend>
          <div className="grid gap-1.5">
            {sedes.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 border-2 border-border px-3 text-[13px]">
                <input type="checkbox" checked={sedesSel.has(s.id)} onChange={() => alternar(sedesSel, s.id, setSedesSel)} />
                {s.nombre}
              </label>
            ))}
          </div>
        </fieldset>

        {equipo.length > 0 ? (
          <fieldset>
            <legend className="sn-label mb-1.5">¿Quién lo hace?</legend>
            <div className="grid gap-1.5">
              {equipo.map((e) => (
                <label key={e.id} className="flex min-h-11 items-center gap-2 border-2 border-border px-3 text-[13px]">
                  <input type="checkbox" checked={equipoSel.has(e.id)} onChange={() => alternar(equipoSel, e.id, setEquipoSel)} />
                  {e.nombre}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Sin nadie asignado, los clientes no podrán reservarlo. Lo puedes cambiar después.</p>
          </fieldset>
        ) : null}

        {error ? (
          <p role="alert" className="text-[12.5px] font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={guardando} className="w-full">
          Agregar a mi menú
        </Button>
      </form>
    </DialogContent>
  );
}

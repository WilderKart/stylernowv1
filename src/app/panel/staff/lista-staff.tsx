"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PermisosPanel } from "@/lib/auth/resolver-contexto";
import { useEnLinea } from "@/lib/hooks/use-en-linea";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelarInvitacion,
  listarStaff,
  reenviarInvitacion,
  type FiltroStaff,
  type StaffItem,
} from "./actions";

interface InvitacionPendiente {
  id: string;
  email: string;
  sedeId: string | null;
  expiraAt: string;
  reenviosCount: number;
}

const LIMITE_PAGINA = 20;

const ESTADO_TONO: Record<StaffItem["estado"], "success" | "danger" | "neutral"> = {
  ACTIVO: "success",
  SUSPENDIDO: "danger",
  RETIRADO: "neutral",
  INVITADO: "neutral",
};

export function ListaStaff({
  negocioId,
  sedeIdFijo,
  sedes,
  permisos,
  itemsIniciales,
  totalInicial,
  invitacionesIniciales,
  errorInicial,
}: {
  negocioId: string;
  /** Guardian: su única sede — el filtro de sede no aplica, siempre queda fijo. */
  sedeIdFijo: string | null;
  sedes: { id: string; nombre: string }[];
  permisos: PermisosPanel;
  itemsIniciales: StaffItem[];
  totalInicial: number;
  invitacionesIniciales: InvitacionPendiente[];
  errorInicial: string | null;
}) {
  const enLinea = useEnLinea();
  const [items, setItems] = useState(itemsIniciales);
  const [total, setTotal] = useState(totalInicial);
  const [invitaciones, setInvitaciones] = useState(invitacionesIniciales);
  const [error, setError] = useState<string | null>(errorInicial);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<NonNullable<FiltroStaff["estado"]>>("TODOS");
  const [esGuardian, setEsGuardian] = useState<"TODOS" | "SI" | "NO">("TODOS");
  const [sedeId, setSedeId] = useState<string>(sedeIdFijo ?? "");
  const [orden, setOrden] = useState<NonNullable<FiltroStaff["orden"]>>("nombre_asc");

  const primerRender = useRef(true);

  const cargar = useCallback(
    async (offset: number, reemplazar: boolean) => {
      if (reemplazar) setCargando(true);
      else setCargandoMas(true);
      setError(null);

      const res = await listarStaff({
        negocioId,
        busqueda: busqueda || undefined,
        estado,
        esGuardian: esGuardian === "TODOS" ? undefined : esGuardian === "SI",
        sedeId: sedeIdFijo ?? (sedeId || undefined),
        orden,
        offset,
        limite: LIMITE_PAGINA,
      });

      setCargando(false);
      setCargandoMas(false);

      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTotal(res.data.total);
      setItems((prev) => (reemplazar ? res.data.items : [...prev, ...res.data.items]));
    },
    [negocioId, busqueda, estado, esGuardian, sedeId, sedeIdFijo, orden]
  );

  // Recarga desde cero cada vez que cambia un filtro — con un pequeño debounce
  // en la búsqueda de texto para no disparar una consulta por cada letra.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const t = setTimeout(() => cargar(0, true), busqueda ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, estado, esGuardian, sedeId, orden]);

  async function onReenviar(id: string) {
    const res = await reenviarInvitacion(id);
    if (!res.ok) return setError(res.error);
    setInvitaciones((prev) =>
      prev.map((i) => (i.id === id ? { ...i, reenviosCount: i.reenviosCount + 1 } : i))
    );
  }

  async function onCancelar(id: string) {
    if (!confirm("¿Cancelar esta invitación?")) return;
    const anterior = invitaciones;
    setInvitaciones((prev) => prev.filter((i) => i.id !== id));
    const res = await cancelarInvitacion(id);
    if (!res.ok) {
      setInvitaciones(anterior);
      setError(res.error);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold uppercase text-text">Staff</h1>
          <p className="mt-1 text-[12.5px] text-text-muted">
            {total} persona{total === 1 ? "" : "s"} en el equipo
          </p>
        </div>
        {permisos.invitarStaff ? (
          <Link
            href="/panel/staff/nuevo"
            className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-[12.5px] font-bold text-bg hover:bg-accent-hover"
          >
            + INVITAR STAFF
          </Link>
        ) : null}
      </div>

      {!enLinea ? (
        <Card className="mb-4 border-danger/30 bg-danger-soft">
          <p className="text-[12.5px] font-semibold text-danger">
            Sin conexión — los cambios y la búsqueda no se van a actualizar hasta que vuelva
            la señal.
          </p>
        </Card>
      ) : null}

      {permisos.invitarStaff && invitaciones.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-text-muted">
            Invitaciones pendientes
          </h2>
          <ul className="flex flex-col gap-2">
            {invitaciones.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border-subtle bg-surface p-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-text">{inv.email}</p>
                  <p className="text-[11px] text-text-faint">
                    Expira el{" "}
                    {new Date(inv.expiraAt).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                    })}
                    {inv.reenviosCount > 0 ? ` · reenviada ${inv.reenviosCount}x` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => onReenviar(inv.id)}>
                    Reenviar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => onCancelar(inv.id)}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3.5">
        <Input
          placeholder="Buscar por nombre, profesión o correo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
            className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none focus:border-accent/60"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="RETIRADO">Retirado</option>
          </select>
          <select
            value={esGuardian}
            onChange={(e) => setEsGuardian(e.target.value as typeof esGuardian)}
            className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none focus:border-accent/60"
          >
            <option value="TODOS">Guardian y no Guardian</option>
            <option value="SI">Solo Guardian</option>
            <option value="NO">Sin perfil Guardian</option>
          </select>
          {!sedeIdFijo && sedes.length > 0 ? (
            <select
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none focus:border-accent/60"
            >
              <option value="">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as typeof orden)}
            className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none focus:border-accent/60"
          >
            <option value="nombre_asc">Nombre A-Z</option>
            <option value="nombre_desc">Nombre Z-A</option>
            <option value="reciente">Más reciente</option>
            <option value="antiguo">Más antiguo</option>
          </select>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {cargando ? (
        <ul className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[72px] animate-pulse rounded-2xl border border-border-subtle bg-surface" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          {busqueda || estado !== "TODOS" || esGuardian !== "TODOS" || sedeId
            ? "Ningún Staff coincide con esos filtros."
            : "Todavía no tenés Staff en el equipo."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {items.map((s) => (
              <li key={s.vinculoId}>
                <Link
                  href={`/panel/staff/${s.vinculoId}`}
                  className="block rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-bold text-text">{s.nombre}</p>
                        {s.esGuardian ? <Badge tone="accent">GUARDIAN</Badge> : null}
                        {s.nivel ? <Badge tone="neutral">{s.nivel}</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-[12px] text-text-faint">
                        {s.especialidad ?? "Sin profesión definida"}
                        {s.sedeNombre ? ` · ${s.sedeNombre}` : ""}
                      </p>
                    </div>
                    <Badge tone={ESTADO_TONO[s.estado]}>{s.estado}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {items.length < total ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" loading={cargandoMas} onClick={() => cargar(items.length, false)}>
                Cargar más ({total - items.length} restantes)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

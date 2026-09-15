"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEnLinea } from "@/lib/hooks/use-en-linea";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listarClientesCRM, type ClienteCRM, type FiltroCRM } from "./actions";

const LIMITE_PAGINA = 20;

export function ListaCRM({
  negocioId,
  sedeIdFijo,
  puedeExportar,
  itemsIniciales,
  totalInicial,
  errorInicial,
}: {
  negocioId: string;
  sedeIdFijo: string | null;
  puedeExportar: boolean;
  itemsIniciales: ClienteCRM[];
  totalInicial: number;
  errorInicial: string | null;
}) {
  const enLinea = useEnLinea();
  const [items, setItems] = useState(itemsIniciales);
  const [total, setTotal] = useState(totalInicial);
  const [error, setError] = useState<string | null>(errorInicial);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [exportando, setExportando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<NonNullable<FiltroCRM["orden"]>>("nombre");
  const [soloVip, setSoloVip] = useState(false);

  const primerRender = useRef(true);

  const cargar = useCallback(
    async (offset: number, reemplazar: boolean) => {
      if (reemplazar) setCargando(true);
      else setCargandoMas(true);
      setError(null);
      const res = await listarClientesCRM({
        negocioId,
        sedeId: sedeIdFijo ?? undefined,
        busqueda: busqueda || undefined,
        orden,
        soloVip: soloVip || undefined,
        offset,
        limite: LIMITE_PAGINA,
      });
      setCargando(false);
      setCargandoMas(false);
      if (!res.ok) return setError(res.error);
      setTotal(res.data.total);
      setItems((prev) => (reemplazar ? res.data.items : [...prev, ...res.data.items]));
    },
    [negocioId, sedeIdFijo, busqueda, orden, soloVip]
  );

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const t = setTimeout(() => cargar(0, true), busqueda ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden, soloVip]);

  async function onExportar() {
    setExportando(true);
    const res = await listarClientesCRM({ negocioId, sedeId: sedeIdFijo ?? undefined, limite: 5000 });
    setExportando(false);
    if (!res.ok) return setError(res.error);
    const filas = [
      ["Nombre", "Teléfono", "Visitas", "LTV", "Última visita", "Etiquetas"],
      ...res.data.items.map((c) => [
        c.nombre,
        c.telefono ?? "",
        String(c.visitas),
        String(c.ltv),
        c.ultimaVisita ? new Date(c.ultimaVisita).toISOString().slice(0, 10) : "",
        c.etiquetas.join(" | "),
      ]),
    ];
    const csv = filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold uppercase text-text">Clientes</h1>
          <p className="mt-1 text-[12.5px] text-text-muted">
            {total} cliente{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/panel/crm/segmentos"
            className="rounded-full border border-border px-4 py-2.5 text-[12.5px] font-bold text-text-muted hover:border-accent/40"
          >
            Segmentos
          </Link>
          {puedeExportar ? (
            <Button size="sm" variant="secondary" loading={exportando} onClick={onExportar}>
              Exportar CSV
            </Button>
          ) : null}
        </div>
      </div>

      {!enLinea ? (
        <Card className="mb-4 border-danger/30 bg-danger-soft">
          <p className="text-[12.5px] font-semibold text-danger">Sin conexión — el listado no se va a actualizar.</p>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3.5">
        <Input placeholder="Buscar por nombre o teléfono..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as typeof orden)}
            className="h-9 rounded-lg border border-border bg-bg px-2 text-[12px] text-text outline-none"
          >
            <option value="nombre">Nombre A-Z</option>
            <option value="visitas_desc">Más visitas</option>
            <option value="ltv_desc">Mayor LTV</option>
            <option value="ultima_visita_desc">Visita más reciente</option>
          </select>
          <button
            type="button"
            onClick={() => setSoloVip((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
              soloVip ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"
            }`}
          >
            Solo VIP
          </button>
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
            <li key={i} className="h-[68px] animate-pulse rounded-2xl border border-border-subtle bg-surface" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-text-faint">
          {busqueda || soloVip ? "Ningún cliente coincide con esos filtros." : "Todavía no tenés clientes."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {items.map((c) => (
              <li key={c.clienteId}>
                <Link
                  href={`/panel/crm/${c.clienteId}`}
                  className="block rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-bold text-text">{c.nombre}</p>
                        {c.esVip ? <Badge tone="accent">VIP</Badge> : null}
                        {c.etiquetas.filter((e) => e !== "VIP").map((e) => (
                          <Badge key={e} tone="neutral">
                            {e}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 truncate text-[12px] text-text-faint">
                        {c.visitas} visita{c.visitas === 1 ? "" : "s"} ·{" "}
                        {c.ultimaVisita ? `última ${new Date(c.ultimaVisita).toLocaleDateString("es-CO")}` : "sin visitas completadas"}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-bold text-text">{formatCOP(c.ltv)}</p>
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

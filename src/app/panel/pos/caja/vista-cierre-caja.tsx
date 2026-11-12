"use client";

import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { useState } from "react";
import { anularEgresoCaja, obtenerCierreCaja, registrarEgresoCaja, type CierreCaja } from "../actions";

const CAMPO = "h-11 w-full border-2 border-border bg-bg px-3 text-[14px] text-text";

export function VistaCierreCaja({
  negocioId,
  sedeId,
  sedes,
  cierreInicial,
  errorInicial,
}: {
  negocioId: string;
  sedeId: string | null;
  sedes: { id: string; nombre: string }[];
  cierreInicial: CierreCaja | null;
  errorInicial: string | null;
}) {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [fecha, setFecha] = useState(hoy);
  const [cierre, setCierre] = useState(cierreInicial);
  const [error, setError] = useState(errorInicial);
  const [cargando, setCargando] = useState(false);

  // Caja menor
  const [sedeEgreso, setSedeEgreso] = useState(sedeId ?? sedes[0]?.id ?? "");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("OTRO");
  const [guardando, setGuardando] = useState(false);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [fondo, setFondo] = useState("");
  const [contado, setContado] = useState("");

  async function onCambiarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    setCargando(true);
    setError(null);
    const res = await obtenerCierreCaja(negocioId, sedeId, nuevaFecha);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setCierre(res.data);
  }

  async function recargar() {
    const res = await obtenerCierreCaja(negocioId, sedeId, fecha);
    if (res.ok) setCierre(res.data);
  }

  async function onRegistrarEgreso(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const res = await registrarEgresoCaja({ negocioId, sedeId: sedeEgreso, monto: Number(monto), concepto, categoria });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    setConcepto("");
    setMonto("");
    await recargar();
  }

  async function onAnular(id: string) {
    setError(null);
    const res = await anularEgresoCaja(id, motivo);
    if (!res.ok) return setError(res.error);
    setAnulando(null);
    setMotivo("");
    await recargar();
  }

  // Efectivo esperado = efectivo cobrado − egresos (lo calcula la BD) + fondo inicial (lo escribe quien cierra).
  const esperado = (cierre?.efectivoEsperado ?? 0) + (Number(fondo) || 0);
  const diferencia = contado === "" ? null : Number(contado) - esperado;

  return (
    <div>
      <input
        type="date"
        value={fecha}
        max={hoy}
        onChange={(e) => onCambiarFecha(e.target.value)}
        className="mb-5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-[13.5px] text-text"
      />

      {error ? <p className="mb-4 text-[12.5px] font-semibold text-danger">{error}</p> : null}

      {cargando ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : cierre ? (
        <div className="flex flex-col gap-3">
          <Card>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Efectivo</p>
            <p className="mt-1 text-[20px] font-bold text-text">{formatCOP(cierre.efectivo)}</p>
          </Card>
          <Card>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Digital (datáfono + Mercado Pago)</p>
            <p className="mt-1 text-[20px] font-bold text-text">{formatCOP(cierre.digital)}</p>
          </Card>
          <Card className="border-accent/30 bg-accent-soft">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-accent">Total del día</p>
            <p className="mt-1 text-[22px] font-bold text-text">{formatCOP(cierre.total)}</p>
          </Card>

          <Card>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Caja menor — egresos del día</p>
            <p className="mt-1 text-[20px] font-bold text-text">− {formatCOP(cierre.egresos)}</p>
            {cierre.egresosLista.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-text-muted">Sin egresos registrados este día.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {cierre.egresosLista.map((e) => (
                  <li key={e.id} className="border-t border-border-subtle pt-2 text-[13px]">
                    <div className="flex items-start justify-between gap-2">
                      <span className={e.anulado ? "text-text-muted line-through" : "text-text"}>
                        {e.concepto} <span className="text-text-faint">· {e.categoria.toLowerCase()}</span>
                      </span>
                      <span className={e.anulado ? "text-text-muted line-through" : "font-bold text-text"}>{formatCOP(e.monto)}</span>
                    </div>
                    {e.anulado ? (
                      <p className="text-[11.5px] text-text-faint">Anulado: {e.anuladoMotivo}</p>
                    ) : anulando === e.id ? (
                      <div className="mt-2 flex gap-2">
                        <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Motivo de la anulación" className={CAMPO} />
                        <button type="button" onClick={() => onAnular(e.id)} className="border-2 border-border px-3 text-[12px] font-bold uppercase">
                          Anular
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAnulando(null);
                            setMotivo("");
                          }}
                          className="px-2 text-[12px] text-text-muted"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setAnulando(e.id)} className="mt-1 text-[11.5px] font-semibold text-danger underline">
                        Anular
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {fecha === hoy ? (
              <form onSubmit={onRegistrarEgreso} className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">Registrar egreso</p>
                {sedeId === null && sedes.length > 1 ? (
                  <select value={sedeEgreso} onChange={(ev) => setSedeEgreso(ev.target.value)} aria-label="Sede" className={CAMPO}>
                    {sedes.map((sd) => (
                      <option key={sd.id} value={sd.id}>
                        {sd.nombre}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  value={concepto}
                  onChange={(ev) => setConcepto(ev.target.value)}
                  placeholder="¿En qué se gastó? (escoba, tintos…)"
                  required
                  minLength={2}
                  maxLength={120}
                  className={CAMPO}
                />
                <div className="flex gap-2">
                  <input value={monto} onChange={(ev) => setMonto(ev.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Monto" required className={CAMPO} />
                  <select value={categoria} onChange={(ev) => setCategoria(ev.target.value)} aria-label="Categoría" className={CAMPO}>
                    <option value="ASEO">Aseo</option>
                    <option value="CAFETERIA">Cafetería</option>
                    <option value="INSUMOS">Insumos</option>
                    <option value="TRANSPORTE">Transporte</option>
                    <option value="PROPINA_STAFF">Propina staff</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={guardando || !monto || !concepto}
                  className="h-11 border-2 border-border bg-accent text-[13px] font-bold uppercase text-ink disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Registrar egreso"}
                </button>
              </form>
            ) : null}
          </Card>

          <Card className="border-accent/30 bg-accent-soft">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-accent">Efectivo esperado en caja</p>
            <p className="mt-1 text-[22px] font-bold text-text">{formatCOP(esperado)}</p>
            <p className="text-[11.5px] text-text-muted">Efectivo cobrado − egresos + fondo inicial. Tarjeta y datáfono no cuentan.</p>
            <div className="mt-3 flex gap-2">
              <input value={fondo} onChange={(ev) => setFondo(ev.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Fondo inicial" className={CAMPO} />
              <input value={contado} onChange={(ev) => setContado(ev.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Efectivo contado" className={CAMPO} />
            </div>
            {diferencia !== null ? (
              <p className={`mt-2 text-[13px] font-bold ${diferencia === 0 ? "text-text" : "text-danger"}`}>
                {diferencia === 0 ? "Cuadra al peso." : diferencia > 0 ? `Sobran ${formatCOP(diferencia)}.` : `Faltan ${formatCOP(-diferencia)}.`}
              </p>
            ) : null}
          </Card>

          <p className="text-[11px] text-text-faint">
            Incluye Anticipos, Saldos y Propinas cobrados y aprobados ese día — nunca ajusta discrepancias
            automáticamente, solo muestra lo que quedó registrado. Los egresos no se borran: se anulan con motivo.
          </p>
        </div>
      ) : null}
    </div>
  );
}

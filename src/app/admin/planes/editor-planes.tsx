"use client";

import { Chip, ChipGroup, Label, Meta, Panel, SectionTitle, Status, Switch } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatearMoneda } from "@/lib/planes/moneda";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  guardarAjustesPais,
  guardarCaracteristica,
  guardarPrecioAddon,
  guardarPrecioPlan,
  type AjustesPais,
  type Caracteristica,
  type DatosPlanes,
  type PaisPlanes,
  type PlanBase,
  type PrecioPlan,
} from "./actions";

type Res = { ok: true } | { ok: false; error: string };

const PASARELAS = ["MERCADOPAGO", "STRIPE", "PAYONEER", "MANUAL"];

const aTexto = (n: number | null) => (n === null ? "" : String(n));
const aNumero = (s: string): number | null => (s.trim() === "" ? null : Number(s.replace(",", ".")));

/** Ejecuta una acción, muestra toast de éxito o error traducido y refresca los datos del servidor. */
function useGuardar() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  function guardar(accion: () => Promise<Res>, exito: string) {
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(exito);
      router.refresh();
    });
  }
  return { guardar, pendiente };
}

export function EditorPlanes({ datos }: { datos: DatosPlanes }) {
  const [codigo, setCodigo] = useState(datos.paises[0].codigo);
  const pais = datos.paises.find((p) => p.codigo === codigo) ?? datos.paises[0];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <ChipGroup aria-label="País">
        {datos.paises.map((p) => (
          <Chip key={p.codigo} selected={p.codigo === pais.codigo} onClick={() => setCodigo(p.codigo)}>
            {p.codigo} · {p.nombre}
          </Chip>
        ))}
      </ChipGroup>

      <AjustesPaisForm key={`aj-${pais.codigo}-${JSON.stringify(pais)}`} pais={pais} />

      <section className="flex flex-col gap-3">
        <SectionTitle>Precios por plan ({pais.moneda})</SectionTitle>
        <Meta>Un precio vacío se muestra como PENDIENTE (a cotizar) y no se puede contratar.</Meta>
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          {datos.planes.map((plan) => {
            const fila = datos.precios.find((x) => x.plan === plan.codigo && x.pais === pais.codigo);
            return <PrecioPlanForm key={`${pais.codigo}-${plan.codigo}-${JSON.stringify(fila)}`} pais={pais} plan={plan} fila={fila} />;
          })}
        </div>
      </section>

      <AddonForm
        key={`ad-${pais.codigo}-${datos.addons.find((a) => a.pais === pais.codigo)?.precioMensual ?? "n"}`}
        pais={pais}
        precio={datos.addons.find((a) => a.pais === pais.codigo)?.precioMensual ?? null}
      />

      <MatrizCaracteristicas planes={datos.planes} caracteristicas={datos.caracteristicas} />
    </div>
  );
}

// ── Ajustes del país ────────────────────────────────────────────────────

function AjustesPaisForm({ pais }: { pais: PaisPlanes }) {
  const { guardar, pendiente } = useGuardar();
  const [activo, setActivo] = useState(pais.activo);
  const [pasarela, setPasarela] = useState(pais.pasarela);
  const [recurrente, setRecurrente] = useState(pais.cobroRecurrente);
  const [descuento, setDescuento] = useState(String(pais.fundadorDescuentoPct));
  const [cupos, setCupos] = useState(String(pais.fundadorCupos));
  const [meses, setMeses] = useState(String(pais.fundadorMeses));
  const [impuesto, setImpuesto] = useState(aTexto(pais.impuestoPct));
  const [masImpuesto, setMasImpuesto] = useState(pais.precioMasImpuesto);
  const [confirmar, setConfirmar] = useState<string[] | null>(null);

  function armar(): AjustesPais {
    return {
      codigo: pais.codigo,
      activo,
      pasarela,
      cobroRecurrente: recurrente,
      fundadorDescuentoPct: Number(descuento),
      fundadorCupos: Number(cupos),
      fundadorMeses: Number(meses),
      impuestoPct: aNumero(impuesto),
      precioMasImpuesto: masImpuesto,
    };
  }

  function ejecutar() {
    setConfirmar(null);
    guardar(() => guardarAjustesPais(armar()), `Ajustes de ${pais.nombre} guardados.`);
  }

  function intentar() {
    const a = armar();
    const cambios: string[] = [];
    if (a.pasarela !== pais.pasarela) cambios.push(`Pasarela de pago: ${pais.pasarela} → ${a.pasarela}.`);
    if (a.cobroRecurrente !== pais.cobroRecurrente)
      cambios.push(a.cobroRecurrente ? "Se habilitará el cobro recurrente automático." : "Se deshabilitará el cobro recurrente.");
    if (a.fundadorCupos !== pais.fundadorCupos) cambios.push(`Cupos fundador: ${pais.fundadorCupos} → ${a.fundadorCupos}.`);
    if (a.fundadorDescuentoPct !== pais.fundadorDescuentoPct || a.fundadorMeses !== pais.fundadorMeses)
      cambios.push("Cambia el descuento o la duración del precio fundador para nuevas suscripciones.");
    if (cambios.length) setConfirmar(cambios);
    else ejecutar();
  }

  return (
    <Panel className="min-w-0">
      <div className="p-card__h flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Ajustes de {pais.nombre}</SectionTitle>
        <Status>{pais.moneda}</Status>
      </div>
      <div className="p-card__b grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <Fila etiqueta="País activo" ayuda="Si lo apagas, no se ofrece a negocios nuevos.">
          <Switch checked={activo} onCheckedChange={setActivo} aria-label="País activo" />
        </Fila>
        <Fila etiqueta="Cobro recurrente" ayuda="Habilita el cobro automático con la pasarela.">
          <Switch checked={recurrente} onCheckedChange={setRecurrente} aria-label="Cobro recurrente habilitado" />
        </Fila>
        <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <Label>Pasarela</Label>
          <ChipGroup aria-label="Pasarela">
            {PASARELAS.map((p) => (
              <Chip key={p} selected={pasarela === p} onClick={() => setPasarela(p)}>
                {p}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        <Input label="Descuento fundador (%)" type="number" inputMode="decimal" min={0} max={100} step="any" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
        <Input label="Meses de precio fundador" type="number" inputMode="numeric" min={1} step={1} value={meses} onChange={(e) => setMeses(e.target.value)} />
        <div className="flex min-w-0 flex-col gap-1">
          <Input label="Cupos fundador" type="number" inputMode="numeric" min={0} step={1} value={cupos} onChange={(e) => setCupos(e.target.value)} />
          <Meta>Quedan {pais.cuposRestantes ?? "—"} de {pais.fundadorCupos}.</Meta>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Input label="Meses pagados en plan anual" value={String(pais.anualMesesPagados)} disabled readOnly />
          <Meta>Solo lectura: no hay control para este valor todavía.</Meta>
        </div>
        <Input label="Impuesto (%)" type="number" inputMode="decimal" min={0} max={100} step="any" placeholder="Sin impuesto" value={impuesto} onChange={(e) => setImpuesto(e.target.value)} />
        <Fila etiqueta="Precio + impuesto" ayuda="Activo: el impuesto se suma al precio. Apagado: ya está incluido.">
          <Switch checked={masImpuesto} onCheckedChange={setMasImpuesto} aria-label="Precio más impuesto" />
        </Fila>
        <div className="sm:col-span-2">
          <Button onClick={intentar} loading={pendiente}>
            Guardar ajustes
          </Button>
        </div>
      </div>

      <Dialog open={confirmar !== null} onOpenChange={(o) => !o && setConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambios que afectan cobros</DialogTitle>
            <DialogDescription>Revisa antes de aplicar en {pais.nombre}.</DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text">
            {confirmar?.map((c) => (
              <li key={c} className="break-words">
                {c}
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
            <Button onClick={ejecutar}>Confirmar y guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function Fila({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-2 border-border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Label>{etiqueta}</Label>
        {ayuda ? <Meta className="break-words">{ayuda}</Meta> : null}
      </div>
      {children}
    </div>
  );
}

// ── Precio de un plan en un país ─────────────────────────────────────────

function PrecioPlanForm({ pais, plan, fila }: { pais: PaisPlanes; plan: PlanBase; fila?: PrecioPlan }) {
  const { guardar, pendiente } = useGuardar();
  const [mensual, setMensual] = useState(aTexto(fila?.precioMensual ?? null));
  const [staff, setStaff] = useState(aTexto(fila?.precioStaffExtra ?? null));
  const [sede, setSede] = useState(aTexto(fila?.precioSedeExtra ?? null));
  const [desde, setDesde] = useState(fila?.esDesde ?? false);
  const [activo, setActivo] = useState(fila?.activo ?? true);

  const vista = aNumero(mensual);
  const actual = fila?.precioMensual ?? null;

  function enviar() {
    guardar(
      () =>
        guardarPrecioPlan({
          plan: plan.codigo,
          pais: pais.codigo,
          precioMensual: aNumero(mensual),
          esDesde: desde,
          precioStaffExtra: aNumero(staff),
          precioSedeExtra: aNumero(sede),
          activo,
        }),
      `${plan.nombre} en ${pais.codigo} guardado.`
    );
  }

  return (
    <Panel className="min-w-0">
      <div className="p-card__h flex flex-wrap items-center justify-between gap-2">
        <SectionTitle className="break-words">{plan.nombre}</SectionTitle>
        <Status>{actual === null ? "PENDIENTE" : formatearMoneda(actual, pais.moneda, pais.locale)}</Status>
      </div>
      <div className="p-card__b flex min-w-0 flex-col gap-3">
        <Input label={`Precio mensual (${pais.moneda})`} type="number" inputMode="decimal" min={0} step="any" placeholder="PENDIENTE" value={mensual} onChange={(e) => setMensual(e.target.value)} />
        {vista !== null && Number.isFinite(vista) ? <Meta>Vista previa: {formatearMoneda(vista, pais.moneda, pais.locale)}</Meta> : null}
        <Input label="Extra por staff" type="number" inputMode="decimal" min={0} step="any" placeholder="PENDIENTE" value={staff} onChange={(e) => setStaff(e.target.value)} />
        <Input label="Extra por sede" type="number" inputMode="decimal" min={0} step="any" placeholder="PENDIENTE" value={sede} onChange={(e) => setSede(e.target.value)} />
        <Fila etiqueta='Mostrar "desde"'>
          <Switch checked={desde} onCheckedChange={setDesde} aria-label="Mostrar precio como desde" />
        </Fila>
        <Fila etiqueta="Activo en este país">
          <Switch checked={activo} onCheckedChange={setActivo} aria-label="Plan activo" />
        </Fila>
        <Button onClick={enviar} loading={pendiente}>
          Guardar {plan.nombre}
        </Button>
      </div>
    </Panel>
  );
}

// ── Add-on Mi Marca ──────────────────────────────────────────────────────

function AddonForm({ pais, precio }: { pais: PaisPlanes; precio: number | null }) {
  const { guardar, pendiente } = useGuardar();
  const [valor, setValor] = useState(aTexto(precio));
  return (
    <Panel className="min-w-0">
      <div className="p-card__h flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Add-on Mi Marca</SectionTitle>
        <Status>{precio === null ? "PENDIENTE" : formatearMoneda(precio, pais.moneda, pais.locale)}</Status>
      </div>
      <div className="p-card__b flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input label={`Precio mensual (${pais.moneda})`} type="number" inputMode="decimal" min={0} step="any" placeholder="PENDIENTE" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <Button loading={pendiente} onClick={() => guardar(() => guardarPrecioAddon(pais.codigo, aNumero(valor)), `Mi Marca en ${pais.codigo} guardado.`)}>
          Guardar add-on
        </Button>
      </div>
    </Panel>
  );
}

// ── Matriz de características (plan × clave) ─────────────────────────────

function MatrizCaracteristicas({ planes, caracteristicas }: { planes: PlanBase[]; caracteristicas: Caracteristica[] }) {
  const claves = Array.from(new Set(caracteristicas.map((c) => c.clave))).sort();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Características por plan</SectionTitle>
      <Meta>Aplican a todos los países. Cada fila se guarda por separado.</Meta>
      {claves.length === 0 ? (
        <Meta>No hay características configuradas.</Meta>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          {claves.map((clave) => (
            <Panel key={clave} className="min-w-0">
              <div className="p-card__h">
                <SectionTitle className="break-words">{clave.replace(/_/g, " ")}</SectionTitle>
              </div>
              <div className="p-card__b flex flex-col gap-3">
                {planes.map((plan) => {
                  const c = caracteristicas.find((x) => x.plan === plan.codigo && x.clave === clave);
                  return <FilaCaracteristica key={`${plan.codigo}-${clave}-${c?.habilitado}-${c?.valor}`} plan={plan} clave={clave} c={c} />;
                })}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </section>
  );
}

function FilaCaracteristica({ plan, clave, c }: { plan: PlanBase; clave: string; c?: Caracteristica }) {
  const { guardar, pendiente } = useGuardar();
  const [habilitado, setHabilitado] = useState(c?.habilitado ?? false);
  const [valor, setValor] = useState(c?.valor ?? "");
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <div className="flex w-24 shrink-0 flex-col gap-2">
        <Label>{plan.codigo}</Label>
        <Switch checked={habilitado} onCheckedChange={setHabilitado} aria-label={`${plan.codigo} ${clave} habilitado`} />
      </div>
      <div className="min-w-32 flex-1">
        <Input aria-label={`Valor ${plan.codigo} ${clave}`} placeholder="Valor (opcional)" maxLength={120} value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <Button
        size="sm"
        variant="secondary"
        loading={pendiente}
        onClick={() => guardar(() => guardarCaracteristica({ plan: plan.codigo, clave, habilitado, valor: valor || null }), `${plan.codigo} · ${clave} guardado.`)}
      >
        Guardar
      </Button>
    </div>
  );
}

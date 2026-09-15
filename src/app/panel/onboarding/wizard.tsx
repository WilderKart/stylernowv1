"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormularioSede } from "@/components/negocio/formulario-sede";
import { CATEGORIAS_NEGOCIO as CATEGORIAS } from "@/lib/categorias-negocio";
import { duracion } from "@/lib/formato";
import { cn, formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelarInvitacion,
  crearOActualizarNegocio,
  crearServicio,
  eliminarServicio,
  elegirPlan,
  enviarAAprobacion,
  invitarStaff,
  subirLogo,
} from "./actions";

const PLANES = [
  { codigo: "RAVEN" as const, nombre: "Raven", precio: 69900, resumen: "1 sede · hasta 2 Staff" },
  { codigo: "JARL" as const, nombre: "Jarl", precio: 149900, resumen: "1 sede · 5 Staff + Guardian" },
  { codigo: "VALHALLA" as const, nombre: "Valhalla", precio: 349900, resumen: "Hasta 5 sedes · 10 Staff" },
];

const PASOS = ["Datos", "Sede", "Servicios", "Staff"];

interface NegocioData {
  id: string;
  nombre: string;
  categoria: string[];
  ciudad: string;
  descripcion: string | null;
  logo_url: string | null;
  telefono_contacto: string | null;
  email_contacto: string | null;
  plan_codigo: string;
  onboarding_completo: boolean;
  estado: string;
}
interface SedeData {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario_base: unknown;
  latitud: number | null;
  longitud: number | null;
}
interface ServicioData {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  precio_base: number;
}
interface InvitacionData {
  id: string;
  email: string;
  estado: string;
}

export function Wizard({
  perfilEmail,
  negocioInicial,
  sedeInicial,
  serviciosIniciales,
  planInicial,
  invitacionesIniciales,
}: {
  perfilEmail: string;
  negocioInicial: NegocioData | null;
  sedeInicial: SedeData | null;
  serviciosIniciales: ServicioData[];
  planInicial: string | null;
  invitacionesIniciales: InvitacionData[];
}) {
  const router = useRouter();

  const [negocio, setNegocio] = useState(negocioInicial);
  const [sede, setSede] = useState(sedeInicial);
  const [servicios, setServicios] = useState(serviciosIniciales);
  const [plan, setPlan] = useState(planInicial);
  const [invitaciones, setInvitaciones] = useState(invitacionesIniciales);

  const [paso, setPaso] = useState(() => {
    if (!negocioInicial || !planInicial) return 1;
    if (!sedeInicial) return 2;
    if (serviciosIniciales.length === 0) return 3;
    return 4;
  });

  const pasoMaximoAlcanzado =
    !negocio || !plan ? 1 : !sede ? 2 : servicios.length === 0 ? 3 : 4;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 pb-28 sm:px-10">
      <h1 className="font-display mb-1.5 text-[24px] font-bold uppercase text-text">
        Registrá tu negocio
      </h1>
      <p className="mb-6 text-[13px] text-text-muted">
        Guardamos tu progreso — podés cerrar y seguir después desde donde quedaste.
      </p>

      <ol className="mb-8 flex items-center gap-1.5">
        {PASOS.map((nombre, i) => {
          const numero = i + 1;
          const alcanzable = numero <= pasoMaximoAlcanzado;
          return (
            <li key={nombre} className="flex flex-1 flex-col gap-1.5">
              <button
                type="button"
                disabled={!alcanzable}
                onClick={() => alcanzable && setPaso(numero)}
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  numero <= paso ? "bg-accent" : alcanzable ? "bg-border-subtle" : "bg-border-subtle/40"
                )}
              />
              <span
                className={cn(
                  "text-[10.5px] font-bold uppercase tracking-wide",
                  numero === paso ? "text-accent" : "text-text-faint"
                )}
              >
                {nombre}
              </span>
            </li>
          );
        })}
      </ol>

      {paso === 1 ? (
        <PasoDatos
          negocio={negocio}
          planActual={plan}
          perfilEmail={perfilEmail}
          onGuardado={(n) => setNegocio(n)}
          onPlanElegido={(p) => setPlan(p)}
          onContinuar={() => setPaso(2)}
        />
      ) : null}

      {paso === 2 && negocio ? (
        <PasoSede sede={sede} negocioId={negocio.id} onGuardado={setSede} onContinuar={() => setPaso(3)} />
      ) : null}

      {paso === 3 && negocio ? (
        <PasoServicios
          negocioId={negocio.id}
          servicios={servicios}
          onCambio={setServicios}
          onContinuar={() => setPaso(4)}
        />
      ) : null}

      {paso === 4 && negocio ? (
        <PasoStaff
          negocioId={negocio.id}
          sedeId={sede?.id ?? null}
          invitaciones={invitaciones}
          onCambio={setInvitaciones}
          onEnviado={() => router.push("/panel")}
        />
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Paso 1 — Datos del negocio + Plan
// ════════════════════════════════════════════════════════════════════════

function PasoDatos({
  negocio,
  planActual,
  perfilEmail,
  onGuardado,
  onPlanElegido,
  onContinuar,
}: {
  negocio: NegocioData | null;
  planActual: string | null;
  perfilEmail: string;
  onGuardado: (n: NegocioData) => void;
  onPlanElegido: (p: string) => void;
  onContinuar: () => void;
}) {
  const [nombre, setNombre] = useState(negocio?.nombre ?? "");
  const [categoria, setCategoria] = useState<string[]>(negocio?.categoria ?? []);
  const [ciudad, setCiudad] = useState(negocio?.ciudad ?? "");
  const [descripcion, setDescripcion] = useState(negocio?.descripcion ?? "");
  const [telefono, setTelefono] = useState(negocio?.telefono_contacto ?? "");
  const [email, setEmail] = useState(negocio?.email_contacto ?? "");
  const [logoUrl, setLogoUrl] = useState(negocio?.logo_url ?? null);
  const [planSeleccionado, setPlanSeleccionado] = useState(planActual);

  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarCategoria(valor: string) {
    setCategoria((prev) => (prev.includes(valor) ? prev.filter((c) => c !== valor) : [...prev, valor]));
  }

  async function onCambiarLogo(archivo: File) {
    if (!negocio) {
      setError("Guardá primero los datos del negocio para poder subir un logo.");
      return;
    }
    setSubiendoLogo(true);
    setError(null);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = reject;
      lector.readAsDataURL(archivo);
    });
    const res = await subirLogo(negocio.id, dataUrl);
    setSubiendoLogo(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLogoUrl(res.data.url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const res = await crearOActualizarNegocio({
      negocioId: negocio?.id ?? null,
      nombre,
      categoria,
      ciudad,
      descripcion,
      telefonoContacto: telefono,
      emailContacto: email,
    });
    if (!res.ok) {
      setGuardando(false);
      setError(res.error);
      return;
    }

    if (!planSeleccionado) {
      setGuardando(false);
      setError("Elegí un plan para continuar.");
      return;
    }

    const negocioId = res.data.id;
    if (planSeleccionado !== planActual) {
      const resPlan = await elegirPlan(negocioId, planSeleccionado as "RAVEN" | "JARL" | "VALHALLA");
      if (!resPlan.ok) {
        setGuardando(false);
        setError(resPlan.error);
        return;
      }
      onPlanElegido(planSeleccionado);
    }

    setGuardando(false);
    onGuardado({
      id: negocioId,
      nombre,
      categoria,
      ciudad,
      descripcion,
      telefono_contacto: telefono,
      email_contacto: email,
      logo_url: logoUrl,
      plan_codigo: planSeleccionado,
      onboarding_completo: false,
      estado: negocio?.estado ?? "PENDIENTE_APROBACION",
    });
    onContinuar();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data recién subida, sin loader de Next configurado para esto
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-[10px] text-text-faint">Logo</span>
          )}
        </div>
        <label className="text-[12.5px] font-semibold text-accent">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={subiendoLogo}
            onChange={(e) => e.target.files?.[0] && onCambiarLogo(e.target.files[0])}
          />
          {subiendoLogo ? "Subiendo…" : "Subir logo"}
        </label>
      </div>

      <Input label="Nombre del negocio" required value={nombre} onChange={(e) => setNombre(e.target.value)} />

      <div>
        <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
          Categoría (elegí una o más)
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => {
            const activo = categoria.includes(c.valor);
            return (
              <button
                key={c.valor}
                type="button"
                onClick={() => alternarCategoria(c.valor)}
                aria-pressed={activo}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                  activo
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text-muted hover:border-accent/40"
                )}
              >
                {c.etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      <Input label="Ciudad" required value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
      <Input
        label="Descripción (opcional)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <Input
        label="Teléfono de contacto"
        type="tel"
        placeholder="+57 300 000 0000"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <Input
        label="Correo de contacto (opcional, si es distinto al tuyo)"
        type="email"
        placeholder={perfilEmail || "contacto@tunegocio.com"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div>
        <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
          Plan
        </label>
        <div className="flex flex-col gap-2">
          {PLANES.map((p) => {
            const activo = planSeleccionado === p.codigo;
            return (
              <button
                key={p.codigo}
                type="button"
                onClick={() => setPlanSeleccionado(p.codigo)}
                aria-pressed={activo}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-3.5 text-left transition-colors",
                  activo
                    ? "border-accent bg-accent-soft"
                    : "border-border-subtle bg-surface hover:border-accent/40"
                )}
              >
                <span>
                  <span className="block text-[14px] font-bold text-text">{p.nombre}</span>
                  <span className="block text-[12px] text-text-faint">{p.resumen}</span>
                </span>
                <span className="shrink-0 text-[13px] font-bold text-accent">
                  {formatCOP(p.precio)}/mes
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-text-faint">
          ¿Necesitás más de 5 sedes o condiciones a medida? Plan Allfather, cotizado por
          nuestro equipo — escribinos por soporte.
        </p>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <Button type="submit" size="lg" loading={guardando} className="w-full">
        CONTINUAR
      </Button>
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Paso 2 — Sede
// ════════════════════════════════════════════════════════════════════════

function PasoSede({
  sede,
  negocioId,
  onGuardado,
  onContinuar,
}: {
  sede: SedeData | null;
  negocioId: string;
  onGuardado: (s: SedeData) => void;
  onContinuar: () => void;
}) {
  return (
    <FormularioSede
      negocioId={negocioId}
      sedeExistente={sede}
      textoBoton="CONTINUAR"
      onGuardado={(guardada) => {
        onGuardado(guardada);
        onContinuar();
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════
// Paso 3 — Servicios
// ════════════════════════════════════════════════════════════════════════

function PasoServicios({
  negocioId,
  servicios,
  onCambio,
  onContinuar,
}: {
  negocioId: string;
  servicios: ServicioData[];
  onCambio: (s: ServicioData[]) => void;
  onContinuar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [duracionMinutos, setDuracionMinutos] = useState("30");
  const [precio, setPrecio] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAgregar(e: React.FormEvent) {
    e.preventDefault();
    setAgregando(true);
    setError(null);
    const res = await crearServicio({
      negocioId,
      nombre,
      duracionMinutos: Number(duracionMinutos),
      precioBase: Number(precio),
      descripcion: "",
    });
    setAgregando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCambio([
      ...servicios,
      {
        id: res.data.id,
        nombre,
        descripcion: null,
        duracion_minutos: Number(duracionMinutos),
        precio_base: Number(precio),
      },
    ]);
    setNombre("");
    setDuracionMinutos("30");
    setPrecio("");
  }

  async function onEliminar(id: string) {
    const anterior = servicios;
    onCambio(servicios.filter((s) => s.id !== id));
    const res = await eliminarServicio(id);
    if (!res.ok) onCambio(anterior);
  }

  return (
    <div className="flex flex-col gap-5">
      {servicios.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {servicios.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-text">{s.nombre}</p>
                <p className="text-[11.5px] text-text-faint">
                  {duracion(s.duracion_minutos)} · {formatCOP(s.precio_base)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEliminar(s.id)}
                className="shrink-0 text-[12px] font-semibold text-danger"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-faint">
          Todavía no agregaste ningún servicio. Necesitás al menos uno para poder enviar tu
          negocio a aprobación.
        </p>
      )}

      <form onSubmit={onAgregar} className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-text-muted">
          Agregar servicio
        </p>
        <Input label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Duración (min)"
            type="number"
            min={5}
            required
            value={duracionMinutos}
            onChange={(e) => setDuracionMinutos(e.target.value)}
          />
          <Input
            label="Precio (COP)"
            type="number"
            min={0}
            required
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button type="submit" variant="secondary" loading={agregando} className="w-full">
          AGREGAR SERVICIO
        </Button>
      </form>

      <Button size="lg" disabled={servicios.length === 0} onClick={onContinuar} className="w-full">
        CONTINUAR
      </Button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Paso 4 — Invitar Staff (opcional) + enviar a aprobación
// ════════════════════════════════════════════════════════════════════════

function PasoStaff({
  negocioId,
  sedeId,
  invitaciones,
  onCambio,
  onEnviado,
}: {
  negocioId: string;
  sedeId: string | null;
  invitaciones: InvitacionData[];
  onCambio: (i: InvitacionData[]) => void;
  onEnviado: () => void;
}) {
  const [email, setEmail] = useState("");
  const [invitando, setInvitando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onInvitar(e: React.FormEvent) {
    e.preventDefault();
    if (!sedeId) {
      setError("Agregá una sede antes de invitar Staff.");
      return;
    }
    setInvitando(true);
    setError(null);
    const res = await invitarStaff(negocioId, email, sedeId);
    setInvitando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCambio([...invitaciones, { id: crypto.randomUUID(), email: email.trim().toLowerCase(), estado: "PENDIENTE" }]);
    setEmail("");
  }

  async function onCancelar(id: string) {
    const anterior = invitaciones;
    onCambio(invitaciones.filter((i) => i.id !== id));
    const res = await cancelarInvitacion(id);
    if (!res.ok) onCambio(anterior);
  }

  async function onEnviarAprobacion() {
    setEnviando(true);
    setError(null);
    const res = await enviarAAprobacion(negocioId);
    setEnviando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onEnviado();
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-text-muted">
        Paso opcional — si trabajás solo, podés saltarlo y enviar tu negocio a aprobación
        igual.
      </p>

      {invitaciones.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {invitaciones.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5"
            >
              <span className="truncate text-[13px] text-text">{inv.email}</span>
              <div className="flex items-center gap-2">
                <Badge tone={inv.estado === "ACEPTADA" ? "success" : "neutral"}>{inv.estado}</Badge>
                {inv.estado === "PENDIENTE" ? (
                  <button
                    type="button"
                    onClick={() => onCancelar(inv.id)}
                    className="text-[11.5px] font-semibold text-danger"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onInvitar} className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
        <Input
          label="Correo del Staff a invitar"
          type="email"
          placeholder="colega@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={invitando} className="w-full">
          ENVIAR INVITACIÓN
        </Button>
      </form>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <Card className="border-accent/30 bg-accent-soft">
        <p className="text-[13px] font-bold text-text">Listo para enviar a aprobación</p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
          Un miembro del equipo de StylerNow revisa tu negocio y lo activa — normalmente
          en menos de 24 horas hábiles. Vas a poder seguir usando tu cuenta de Cliente
          mientras tanto.
        </p>
      </Card>

      <Button size="lg" loading={enviando} onClick={onEnviarAprobacion} className="w-full">
        ENVIAR A APROBACIÓN
      </Button>
    </div>
  );
}

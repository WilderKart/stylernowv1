"use client";

import { Chip } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormularioSede } from "@/components/negocio/formulario-sede";
import { SelectorPlanes } from "@/components/planes/selector-planes";
import { elegirPais } from "@/app/panel/suscripcion/prueba";
import type { CatalogoPais } from "@/lib/planes/catalogo";
import type { CicloFacturacion } from "@/lib/planes/precios";
import { CATEGORIAS_NEGOCIO as CATEGORIAS } from "@/lib/categorias-negocio";
import { duracion } from "@/lib/formato";
import { cn, formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelarInvitacion,
  crearOActualizarNegocio,
  elegirPlan,
  enviarAAprobacion,
  invitarStaff,
  subirLogo,
} from "./actions";
// Módulo 2.5: un solo lugar para crear/desactivar Servicios (validaciones
// de duración/precio/duplicados), compartido con el Panel de Servicios.
import { crearServicio, eliminarServicio, subirImagenServicio } from "@/app/panel/servicios/actions";
import { leerComoDataUrl } from "@/lib/imagen/leer-como-data-url";

const PASOS = ["Datos", "Sede", "Servicios", "Staff"];

interface NegocioData {
  pais_codigo?: string;
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
  imagen_url?: string | null;
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
  catalogos,
}: {
  catalogos: CatalogoPais[];
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

  // Tras enviar a aprobación se muestra una confirmación clara (antes se redirigía a /panel y,
  // con negocios duplicados, el usuario volvía al primer paso sin saber si se envió).
  const [enviado, setEnviado] = useState(false);
  if (enviado) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-12 sm:px-10" role="status" aria-live="polite">
        <span className="sn-label text-accent">Solicitud enviada</span>
        <h1 className="font-display text-[28px] font-bold uppercase leading-tight text-text">
          ¡Listo! Recibimos tu negocio
        </h1>
        <p className="text-[14px] leading-relaxed text-text-muted">
          {negocio?.nombre ? <b className="text-text">{negocio.nombre}</b> : "Tu negocio"} quedó en revisión. El equipo de
          StylerNow lo revisa normalmente en menos de 24 horas hábiles y te avisamos por correo y en la app cuando esté
          aprobado.
        </p>
        <Card>
          <p className="text-[13px] font-bold text-text">Mientras tanto</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[12.5px] text-text-muted">
            <li>Puedes entrar a tu panel para revisar el estado y completar tu perfil.</li>
            <li>Cuando te aprobemos, activa tu prueba gratis desde «Plan y facturación» (sin tarjeta).</li>
            <li>Sigues pudiendo usar tu cuenta de cliente para reservar.</li>
          </ul>
        </Card>
        <Button size="lg" className="w-full" onClick={() => router.push("/panel")}>
          IR A MI PANEL
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 pb-28 sm:px-10">
      <h1 className="font-display mb-1.5 text-[24px] font-bold uppercase text-text">
        Registra tu negocio
      </h1>
      <p className="mb-6 text-[13px] text-text-muted">
        Guardamos tu progreso — puedes cerrar y seguir después desde donde quedaste.
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
                  "h-1 w-full rounded-none transition-colors",
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
          catalogos={catalogos}
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
          onEnviado={() => {
            setEnviado(true);
            window.scrollTo({ top: 0 });
          }}
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
  catalogos,
  perfilEmail,
  onGuardado,
  onPlanElegido,
  onContinuar,
}: {
  negocio: NegocioData | null;
  planActual: string | null;
  catalogos: CatalogoPais[];
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
  const [paisCodigo, setPaisCodigo] = useState(negocio?.pais_codigo ?? catalogos[0]?.pais.codigo ?? "CO");
  const [ciclo, setCiclo] = useState<CicloFacturacion>("MENSUAL");
  const catalogo = catalogos.find((c) => c.pais.codigo === paisCodigo) ?? catalogos[0];

  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  // Logo elegido antes de que exista el negocio: se muestra al instante y se sube en cuanto se crea.
  const [logoPendiente, setLogoPendiente] = useState<string | null>(null);

  function alternarCategoria(valor: string) {
    setCategoria((prev) => (prev.includes(valor) ? prev.filter((c) => c !== valor) : [...prev, valor]));
  }

  async function subirLogoDe(negocioId: string, dataUrl: string) {
    setSubiendoLogo(true);
    setErrorLogo(null);
    const res = await subirLogo(negocioId, dataUrl);
    setSubiendoLogo(false);
    if (!res.ok) {
      setErrorLogo(res.error);
      return null;
    }
    setLogoUrl(res.data.url);
    setLogoPendiente(null);
    return res.data.url;
  }

  async function onCambiarLogo(archivo: File) {
    setErrorLogo(null);
    // Se comprime en el navegador: el original en base64 superaba el límite de 1 MB de las Server Actions.
    const leida = await leerComoDataUrl(archivo, 15, 800);
    if (!leida.ok) {
      setErrorLogo(leida.error);
      return;
    }
    const dataUrl = leida.dataUrl;
    // Antes exigía guardar primero el negocio (y el aviso quedaba al final del formulario).
    if (!negocio) {
      setLogoPendiente(dataUrl);
      return;
    }
    await subirLogoDe(negocio.id, dataUrl);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Validaciones ANTES de crear nada: antes el plan se validaba después del INSERT y cada reintento
    // creaba un negocio nuevo.
    if (categoria.length === 0) {
      setError("Elige al menos una categoría.");
      return;
    }
    if (!planSeleccionado) {
      setError("Elige un plan para continuar.");
      return;
    }
    setGuardando(true);

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

    const negocioId = res.data.id;
    const datosGuardados: NegocioData = {
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
    };
    // El negocio ya existe: se recuerda YA, para que si el país o el plan fallan, el reintento lo actualice.
    onGuardado(datosGuardados);

    if (logoPendiente) {
      const url = await subirLogoDe(negocioId, logoPendiente);
      if (url) datosGuardados.logo_url = url;
    }
    if (paisCodigo !== (negocio?.pais_codigo ?? "CO")) {
      const resPais = await elegirPais(negocioId, paisCodigo);
      if (!resPais.ok) {
        setGuardando(false);
        setError(resPais.error);
        return;
      }
    }
    if (planSeleccionado !== planActual) {
      const resPlan = await elegirPlan(negocioId, planSeleccionado as "ESSENTIAL" | "STUDIO" | "PRESTIGE");
      if (!resPlan.ok) {
        setGuardando(false);
        setError(resPlan.error);
        return;
      }
      onPlanElegido(planSeleccionado);
    }

    setGuardando(false);
    onGuardado(datosGuardados);
    onContinuar();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
          {logoPendiente || logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local o recién subida, sin loader de Next
            <img src={logoPendiente ?? logoUrl ?? ""} alt="Logo del negocio" className="size-full object-cover" />
          ) : (
            <span className="text-[10px] text-text-faint">Logo</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="cursor-pointer text-[12.5px] font-semibold text-accent">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={subiendoLogo}
              onChange={(e) => e.target.files?.[0] && onCambiarLogo(e.target.files[0])}
            />
            {subiendoLogo ? "Subiendo…" : logoPendiente || logoUrl ? "Cambiar logo" : "Subir logo"}
          </label>
          <span className="text-[11px] text-text-faint">
            {logoPendiente ? "Se guarda al continuar." : "PNG, JPG o WebP. La optimizamos automáticamente."}
          </span>
          {errorLogo ? <span className="text-[11.5px] text-danger">{errorLogo}</span> : null}
        </div>
      </div>

      <Input label="Nombre del negocio" required value={nombre} onChange={(e) => setNombre(e.target.value)} />

      <div>
        <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
          Categoría (elige una o más)
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
                  "rounded-none border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
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

      <div className="flex flex-col gap-3">
        <span className="sn-label">País y plan</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="País del negocio">
          {catalogos.map((c) => (
            <Chip
              key={c.pais.codigo}
              selected={c.pais.codigo === paisCodigo}
              onClick={() => {
                setPaisCodigo(c.pais.codigo);
                setCiclo("MENSUAL");
              }}
            >
              {c.pais.nombre} · {c.pais.moneda}
            </Chip>
          ))}
        </div>
        {catalogo ? (
          <SelectorPlanes
            catalogo={catalogo}
            value={planSeleccionado}
            onChange={(codigo) => setPlanSeleccionado(codigo)}
            ciclo={ciclo}
            onCicloChange={setCiclo}
            deshabilitadoCodigos={["SIGNATURE"]}
          />
        ) : null}
        <p className="sn-meta">
          Prueba gratis sin tarjeta: cuando aprobemos tu negocio la activas desde «Plan y facturación» y no se cobra nada
          automáticamente. ¿Cadena o franquicia (Signature)? Habla con ventas por soporte.
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
  const [imagen, setImagen] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onElegirImagen(archivo: File | undefined) {
    if (!archivo) return;
    const r = await leerComoDataUrl(archivo, 15);
    if (!r.ok) return setError(r.error);
    setError(null);
    setImagen(r.dataUrl);
  }

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
    if (!res.ok) {
      setAgregando(false);
      setError(res.error);
      return;
    }
    // Imagen opcional: el servicio ya existe; si la imagen falla, se avisa pero el servicio queda creado.
    let imagenUrl: string | null = null;
    if (imagen) {
      const ri = await subirImagenServicio(res.data.id, imagen);
      if (ri.ok) imagenUrl = ri.data.url;
      else setError(`El servicio se creó, pero la imagen no: ${ri.error}`);
    }
    setAgregando(false);
    onCambio([
      ...servicios,
      {
        id: res.data.id,
        nombre,
        descripcion: null,
        duracion_minutos: Number(duracionMinutos),
        precio_base: Number(precio),
        imagen_url: imagenUrl,
      },
    ]);
    setNombre("");
    setDuracionMinutos("30");
    setPrecio("");
    setImagen(null);
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
              {s.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura del bucket público
                <img src={s.imagen_url} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
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
          Todavía no agregaste ningún servicio. Necesitas al menos uno para poder enviar tu
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
        {/* Imagen guía opcional: ayuda al cliente a reconocer servicios cuyo nombre no conoce. */}
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg">
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local
              <img src={imagen} alt="Imagen del servicio" className="size-full object-cover" />
            ) : (
              <span className="text-[10px] text-text-faint">Foto</span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <label className="cursor-pointer text-[12.5px] font-semibold text-accent">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => onElegirImagen(e.target.files?.[0])}
              />
              {imagen ? "Cambiar imagen" : "Agregar imagen (opcional)"}
            </label>
            <span className="text-[11px] text-text-faint">Ayuda a tus clientes a reconocer el servicio. La optimizamos automáticamente.</span>
          </div>
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
      setError("Agrega una sede antes de invitar Staff.");
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
        Paso opcional — si trabajas solo, puedes saltarlo y enviar tu negocio a aprobación
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

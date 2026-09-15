"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIAS_NEGOCIO } from "@/lib/categorias-negocio";
import { CODIGOS_PAIS, separarTelefono } from "@/lib/codigos-pais";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { actualizarPerfil, cerrarSesion } from "./actions";

export function FormularioPerfil({
  nombreInicial,
  telefonoInicial,
  fechaNacimientoInicial,
  categoriasInicial,
  email,
  bienvenida,
}: {
  nombreInicial: string;
  telefonoInicial: string;
  fechaNacimientoInicial: string;
  categoriasInicial: string[];
  email: string;
  bienvenida: boolean;
}) {
  const router = useRouter();
  const telefonoSeparado = separarTelefono(telefonoInicial);

  const [nombre, setNombre] = useState(nombreInicial);
  const [codigoPais, setCodigoPais] = useState(telefonoSeparado.codigo);
  const [telefonoLocal, setTelefonoLocal] = useState(telefonoSeparado.local);
  const [fechaNacimiento, setFechaNacimiento] = useState(fechaNacimientoInicial);
  const [categorias, setCategorias] = useState<string[]>(categoriasInicial);

  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  // Solo el nombre es obligatorio para usar la app — el resto suma para
  // recordatorios, promociones relevantes y futuros beneficios de puntos,
  // nunca bloquea nada si se deja vacío.
  const faltantes = [
    !telefonoLocal && "celular",
    !fechaNacimiento && "fecha de nacimiento",
    categorias.length === 0 && "tus intereses",
  ].filter(Boolean) as string[];

  function alternarCategoria(valor: string) {
    setCategorias((prev) => (prev.includes(valor) ? prev.filter((c) => c !== valor) : [...prev, valor]));
  }

  async function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const res = await actualizarPerfil({
      nombre,
      codigoPais,
      telefonoLocal,
      fechaNacimiento,
      categoriasInteres: categorias,
    });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuardado(true);
    router.refresh();
  }

  async function onCerrarSesion() {
    setCerrando(true);
    await cerrarSesion();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {bienvenida ? (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <p className="text-[13.5px] font-bold text-text">¡Bienvenido a StylerNow!</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
            Contanos tu nombre y tu celular para que el negocio pueda avisarte de tu
            cita — solo te lo pedimos esta vez.
          </p>
        </div>
      ) : null}

      {faltantes.length > 0 ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold text-text">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="#e8a23c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
            </svg>
            Sumá puntos completando tu perfil
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
            Te falta: {faltantes.join(", ")}. Con estos datos te avisamos de tu cita a
            tiempo, te llegan promos de negocios que realmente te interesan, y quedás
            listo para sumar puntos apenas activemos fidelización.
          </p>
        </div>
      ) : null}

      <form onSubmit={onGuardar} className="flex flex-col gap-4">
        <Input
          label="Nombre completo"
          required
          minLength={2}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input label="Correo" value={email} disabled className="opacity-60" />

        <div>
          <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
            Celular (WhatsApp)
          </label>
          <div className="flex gap-2">
            <select
              value={codigoPais}
              onChange={(e) => setCodigoPais(e.target.value)}
              aria-label="Código de país"
              className="h-[52px] shrink-0 rounded-[13px] border border-border bg-surface px-2.5 text-[14px] text-text outline-none focus:border-accent/60"
            >
              {CODIGOS_PAIS.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.bandera} {c.codigo}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="300 000 0000"
              value={telefonoLocal}
              onChange={(e) => setTelefonoLocal(e.target.value.replace(/\D/g, ""))}
              className="h-[52px] w-full rounded-[13px] border border-border bg-surface px-4 text-[14.5px] text-text placeholder:text-text-faint outline-none focus:border-accent/60"
            />
          </div>
        </div>

        <Input
          label="Fecha de nacimiento"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={fechaNacimiento}
          onChange={(e) => setFechaNacimiento(e.target.value)}
        />

        <div>
          <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
            ¿Qué te interesa?
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS_NEGOCIO.map((c) => {
              const activo = categorias.includes(c.valor);
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
          <p className="mt-2 text-[11px] text-text-faint">
            Así te mostramos primero los negocios y promociones que más te sirven.
          </p>
        </div>

        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {guardado ? <p className="text-xs font-semibold text-success">Guardado.</p> : null}

        <Button type="submit" size="lg" loading={guardando} className="w-full">
          GUARDAR CAMBIOS
        </Button>
      </form>

      <Button
        variant="ghost"
        size="sm"
        loading={cerrando}
        onClick={onCerrarSesion}
        className="w-full"
      >
        Cerrar sesión
      </Button>
    </div>
  );
}

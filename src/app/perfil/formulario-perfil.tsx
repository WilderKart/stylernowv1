"use client";

import { ErrorAviso } from "@/app/lealtad/ui-cliente";
import { Chip, ChipGroup, Panel, Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIAS_NEGOCIO } from "@/lib/categorias-negocio";
import { CODIGOS_PAIS, separarTelefono } from "@/lib/codigos-pais";
import { Check, Star } from "lucide-react";
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
        <div className="border-2 border-border bg-signal p-4 text-ink shadow-hard">
          <h3 className="section">¡Bienvenido a StylerNow!</h3>
          <p className="body-sm mt-1.5 break-words">
            Cuéntanos tu nombre y tu celular para que el negocio pueda avisarte de tu cita. Solo te lo pedimos esta vez.
          </p>
        </div>
      ) : null}

      {faltantes.length > 0 ? (
        <Panel className="p-4">
          <p className="sn-label flex items-center gap-2">
            <Star aria-hidden className="size-4" />
            Suma puntos completando tu perfil
          </p>
          <p className="body-sm mt-2 break-words">
            Te falta: {faltantes.join(", ")}. Con estos datos te avisamos de tu cita a tiempo, te llegan promos de negocios
            que realmente te interesan y quedas listo para sumar puntos.
          </p>
        </Panel>
      ) : null}

      <form onSubmit={onGuardar} className="flex flex-col gap-4">
        <Input
          label="Nombre completo"
          required
          minLength={2}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input label="Correo" value={email} disabled />

        <div className="flex flex-col gap-2">
          <label htmlFor="perfil-telefono" className="sn-label">
            Celular (WhatsApp)
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={codigoPais}
              onChange={(e) => setCodigoPais(e.target.value)}
              aria-label="Código de país"
              className="min-h-12 shrink-0 border-2 border-border bg-bg px-2.5 text-[15px] text-text outline-none focus:shadow-hard"
            >
              {CODIGOS_PAIS.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.bandera} {c.codigo}
                </option>
              ))}
            </select>
            <input
              id="perfil-telefono"
              type="tel"
              inputMode="numeric"
              placeholder="300 000 0000"
              value={telefonoLocal}
              onChange={(e) => setTelefonoLocal(e.target.value.replace(/D/g, ""))}
              className="min-h-12 min-w-0 flex-1 basis-40 border-2 border-border bg-bg px-3 text-[15px] text-text outline-none placeholder:text-text-muted focus:shadow-hard"
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

        <div className="flex flex-col gap-2">
          <span className="sn-label">¿Qué te interesa?</span>
          <ChipGroup>
            {CATEGORIAS_NEGOCIO.map((c) => (
              <Chip key={c.valor} selected={categorias.includes(c.valor)} onClick={() => alternarCategoria(c.valor)}>
                {c.etiqueta}
              </Chip>
            ))}
          </ChipGroup>
          <p className="sn-help">Así te mostramos primero los negocios y promociones que más te sirven.</p>
        </div>

        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
        {guardado ? (
          <Status tone="ok" role="status" icon={<Check aria-hidden className="size-3.5" />}>
            Guardado
          </Status>
        ) : null}

        <Button type="submit" size="lg" loading={guardando} className="w-full">
          Guardar cambios
        </Button>
      </form>

      <Button variant="secondary" size="lg" loading={cerrando} onClick={onCerrarSesion} className="w-full">
        Cerrar sesión
      </Button>
    </div>
  );
}

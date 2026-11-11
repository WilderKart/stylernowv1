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
  // Cumpleaños: solo día y mes (se pide con calidez y no se exige el año). Si la persona ya tenía una fecha
  // completa guardada se conserva su año; si no, se guarda con un año de referencia (bisiesto, para admitir 29/02).
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimientoInicial);
  const anioGuardado = partes ? partes[1] : "2000";
  const [mes, setMes] = useState(partes ? String(Number(partes[2])) : "");
  const [dia, setDia] = useState(partes ? String(Number(partes[3])) : "");
  const [categorias, setCategorias] = useState<string[]>(categoriasInicial);
  const diasDelMes = mes ? new Date(2000, Number(mes), 0).getDate() : 31;
  const fechaNacimiento = mes && dia ? `${anioGuardado}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}` : "";

  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  // Solo el nombre es obligatorio para usar la app — el resto suma para
  // recordatorios, promociones relevantes y futuros beneficios de puntos,
  // nunca bloquea nada si se deja vacío.
  const faltantes = [
    !telefonoLocal && "celular",
    !fechaNacimiento && "tu cumpleaños",
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
              onChange={(e) => setTelefonoLocal(e.target.value.replace(/\D/g, ""))}
              className="min-h-12 min-w-0 flex-1 basis-40 border-2 border-border bg-bg px-3 text-[15px] text-text outline-none placeholder:text-text-muted focus:shadow-hard"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span id="perfil-cumple" className="sn-label">
            ¿Cuándo cumples años?
          </span>
          <div className="flex gap-2" role="group" aria-labelledby="perfil-cumple">
            <select
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              aria-label="Día de tu cumpleaños"
              className="min-h-12 min-w-0 flex-1 border-2 border-border bg-bg px-2.5 text-[15px] text-text outline-none focus:shadow-hard"
            >
              <option value="">Día</option>
              {Array.from({ length: diasDelMes }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={mes}
              onChange={(e) => {
                setMes(e.target.value);
                const max = e.target.value ? new Date(2000, Number(e.target.value), 0).getDate() : 31;
                if (Number(dia) > max) setDia(String(max)); // p. ej. 31 → 30 al elegir abril
              }}
              aria-label="Mes de tu cumpleaños"
              className="min-h-12 min-w-0 flex-[2] border-2 border-border bg-bg px-2.5 text-[15px] text-text outline-none focus:shadow-hard"
            >
              <option value="">Mes</option>
              {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <p className="sn-help">Solo día y mes: así te sorprendemos ese día. No te pedimos el año.</p>
        </div>

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

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIAS_ONBOARDING } from "@/lib/categorias-onboarding";
import { comprimirADataUrl } from "@/lib/imagen/comprimir";
import { cn } from "@/lib/utils";
import { ArrowRight, Flower2, Hand, PenTool, Scissors, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { crearOActualizarNegocio, subirFotoPrincipal, subirLogo } from "./actions";
import { TituloPaso } from "./encabezado-pasos";
import type { NegocioData } from "./tipos";

const ICONOS = { Scissors, Sparkles, Flower2, PenTool, Hand, UserRound } as const;

const NOTA_FOTO =
  "Esta será la fotografía principal que verán tus clientes en StylerNow. Sube una imagen actual de la fachada de tu negocio, que permita reconocer el establecimiento. Procura que esté bien iluminada y sea nítida.";

export function PasoDatos({
  negocio,
  perfilEmail,
  hayImagenes,
  categoriaSugerida,
  onGuardado,
  onContinuar,
}: {
  negocio: NegocioData | null;
  perfilEmail: string;
  hayImagenes: boolean;
  /** Tipo de negocio que la persona eligió al crear su cuenta (solo preselecciona; puede cambiarlo). */
  categoriaSugerida?: string[];
  onGuardado: (n: NegocioData) => void;
  onContinuar: () => void;
}) {
  const [nombre, setNombre] = useState(negocio?.nombre ?? "");
  const [categoria, setCategoria] = useState<string[]>(negocio?.categoria?.length ? negocio.categoria : (categoriaSugerida ?? []));
  const [ciudad, setCiudad] = useState(negocio?.ciudad ?? "");
  const [descripcion, setDescripcion] = useState(negocio?.descripcion ?? "");
  const [telefono, setTelefono] = useState(negocio?.telefono_contacto ?? "");
  const [email, setEmail] = useState(negocio?.email_contacto ?? "");
  const [logoUrl, setLogoUrl] = useState(negocio?.logo_url ?? null);
  const [logoPendiente, setLogoPendiente] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState(negocio?.foto_principal_url ?? null);
  const [fotoPendiente, setFotoPendiente] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);

  function alternar(valor: string) {
    setCategoria((prev) => (prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]));
  }

  async function elegirImagen(archivo: File | undefined, destino: "logo" | "foto") {
    if (!archivo) return;
    setErrorImagen(null);
    // Las Server Actions aceptan ~1 MB: se comprime en el navegador con la utilidad central.
    const r = await comprimirADataUrl(archivo, "media");
    if (!r.ok) return setErrorImagen(r.error);
    if (destino === "logo") setLogoPendiente(r.data);
    else setFotoPendiente(r.data);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (categoria.length === 0) return setError("Elige al menos una categoría.");
    if (telefono.replace(/\D/g, "").length < 7) return setError("Escribe un teléfono de contacto válido.");
    if (hayImagenes && !fotoUrl && !fotoPendiente) {
      return setError("Sube la fotografía de la fachada de tu negocio. Es la que verán tus clientes.");
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
      return setError(res.error);
    }

    const guardado: NegocioData = {
      pais_codigo: negocio?.pais_codigo,
      id: res.data.id,
      nombre,
      categoria,
      ciudad,
      descripcion,
      telefono_contacto: telefono,
      email_contacto: email,
      logo_url: logoUrl,
      foto_principal_url: fotoUrl,
      plan_codigo: negocio?.plan_codigo ?? "ESSENTIAL",
      onboarding_completo: false,
      estado: negocio?.estado ?? "PENDIENTE_APROBACION",
    };
    // El negocio ya existe: se recuerda YA, para que un fallo posterior no cree otro en el reintento.
    onGuardado(guardado);

    // Las imágenes se suben después de crear el negocio. Un fallo de imagen no pierde los datos ya guardados.
    if (logoPendiente) {
      const l = await subirLogo(res.data.id, logoPendiente);
      if (l.ok) {
        guardado.logo_url = l.data.url;
        setLogoUrl(l.data.url);
        setLogoPendiente(null);
      } else setErrorImagen(l.error);
    }
    if (fotoPendiente) {
      const f = await subirFotoPrincipal(res.data.id, fotoPendiente);
      if (f.ok) {
        guardado.foto_principal_url = f.data.url;
        setFotoUrl(f.data.url);
        setFotoPendiente(null);
      } else {
        setGuardando(false);
        setErrorImagen(f.error);
        onGuardado(guardado);
        return setError("No pudimos guardar la fotografía de la fachada. Inténtalo de nuevo.");
      }
    }
    onGuardado(guardado);
    setGuardando(false);
    onContinuar();
  }

  const previaFoto = fotoPendiente ?? fotoUrl;
  const previaLogo = logoPendiente ?? logoUrl;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <TituloPaso inicio="Empecemos por" acento="tu negocio." texto="Cuéntanos lo esencial para crear tu cuenta." />

      <div className="flex flex-col gap-2">
        <span className="sn-label">Fotografía principal del negocio</span>
        {hayImagenes ? (
          <>
            <label className="group relative flex aspect-[16/10] w-full cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-border bg-surface text-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => elegirImagen(e.target.files?.[0], "foto")}
              />
              {previaFoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa local o recién subida
                <img src={previaFoto} alt="Vista previa de la fachada" className="size-full object-cover" />
              ) : (
                <span className="px-4 font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
                  Toca para subir la fachada
                </span>
              )}
              {previaFoto ? (
                <span className="absolute bottom-0 right-0 bg-ink px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-paper">
                  Cambiar foto
                </span>
              ) : null}
            </label>
            <p className="border-l-4 border-accent bg-accent-soft px-3 py-2 text-[12.5px] leading-relaxed text-text">{NOTA_FOTO}</p>
            {fotoPendiente ? (
              <p className="text-[11.5px] text-text-faint">Se guarda al continuar. Podrás reemplazarla después desde tu panel.</p>
            ) : null}
          </>
        ) : (
          <p className="border-2 border-dashed border-border px-3 py-3 text-[12.5px] text-text-muted">
            La carga de fotografías no está disponible por ahora. Podrás subir la fachada de tu negocio desde tu panel apenas esté habilitada.
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-surface">
          {previaLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local o recién subida
            <img src={previaLogo} alt="Logotipo del negocio" className="size-full object-cover" />
          ) : (
            <span className="text-[10px] text-text-faint">Logo</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="cursor-pointer text-[12.5px] font-bold text-accent">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => elegirImagen(e.target.files?.[0], "logo")}
            />
            {previaLogo ? "Cambiar logo" : "Subir logo"}
          </label>
          <span className="text-[11px] text-text-faint">{logoPendiente ? "Se guarda al continuar." : "PNG, JPG o WebP."}</span>
        </div>
      </div>
      {errorImagen ? (
        <p role="alert" className="text-[12px] text-danger">
          {errorImagen}
        </p>
      ) : null}

      <Input label="Nombre del negocio" required value={nombre} onChange={(e) => setNombre(e.target.value)} />

      <div className="flex flex-col gap-2">
        <span className="sn-label">Tipo de negocio (elige uno o más)</span>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIAS_ONBOARDING.map((c) => {
            const activo = categoria.includes(c.valor);
            const Icono = ICONOS[c.icono];
            return (
              <button
                key={c.valor}
                type="button"
                onClick={() => alternar(c.valor)}
                aria-pressed={activo}
                className={cn(
                  "flex min-h-[72px] flex-col items-center justify-center gap-1.5 border-2 px-1.5 py-2 text-center font-mono text-[10.5px] font-bold uppercase leading-tight tracking-wide transition-colors",
                  activo ? "border-ink bg-signal text-ink shadow-hard-sm" : "border-border bg-bg text-text hover:border-text",
                )}
              >
                <Icono className="!size-5" aria-hidden />
                {c.etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      <Input label="Ciudad" required value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
      <Input label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      <Input
        label="Teléfono de contacto"
        type="tel"
        required
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

      {error ? (
        <p role="alert" className="border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <Button type="submit" size="lg" loading={guardando} className="w-full">
          CONTINUAR <ArrowRight className="!size-4" aria-hidden />
        </Button>
        <Link href="/" className="text-[12.5px] font-bold text-text underline underline-offset-4">
          Guardar y salir
        </Link>
      </div>
    </form>
  );
}

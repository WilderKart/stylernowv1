"use client";

import { subirFotoPrincipal } from "@/app/panel/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leerComoDataUrl } from "@/lib/imagen/leer-como-data-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarPerfilPublico } from "./actions";

interface NegocioPerfil {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  telefono_contacto: string | null;
  email_contacto: string | null;
  foto_principal_url: string | null;
  logo_url: string | null;
}

export function VistaPerfilPublico({ negocio, hayImagenes }: { negocio: NegocioPerfil; hayImagenes: boolean }) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(negocio.descripcion ?? "");
  const [telefono, setTelefono] = useState(negocio.telefono_contacto ?? "");
  const [email, setEmail] = useState(negocio.email_contacto ?? "");
  const [foto, setFoto] = useState(negocio.foto_principal_url);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    const r = await guardarPerfilPublico({ negocioId: negocio.id, descripcion, telefono, email });
    setGuardando(false);
    setAviso(r.ok ? { tipo: "ok", texto: "Cambios guardados." } : { tipo: "error", texto: r.error });
    if (r.ok) router.refresh();
  }

  async function cambiarFoto(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    setAviso(null);
    const leida = await leerComoDataUrl(archivo, 8, 1600);
    if (!leida.ok) {
      setSubiendo(false);
      return setAviso({ tipo: "error", texto: leida.error });
    }
    const r = await subirFotoPrincipal(negocio.id, leida.dataUrl);
    setSubiendo(false);
    if (r.ok) {
      setFoto(r.data.url);
      setAviso({ tipo: "ok", texto: "Fotografía actualizada." });
      router.refresh();
    } else setAviso({ tipo: "error", texto: r.error });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[clamp(26px,8vw,36px)] font-bold uppercase leading-none text-text">
        Perfil <span className="text-accent">público</span>
      </h1>
      <p className="text-[13.5px] leading-relaxed text-text-muted">
        Lo que ven tus clientes de {negocio.nombre}. Los servicios y los horarios se editan en{" "}
        <Link href="/panel/servicios" className="font-bold text-text underline underline-offset-4">
          Servicios
        </Link>{" "}
        y{" "}
        <Link href="/panel/sedes" className="font-bold text-text underline underline-offset-4">
          Sedes
        </Link>
        .
      </p>

      <div className="flex flex-col gap-2">
        <span className="sn-label">Fotografía principal (fachada)</span>
        <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden border-2 border-dashed border-border bg-surface">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- fotografía propia del negocio
            <img src={foto} alt="Fachada del negocio" className="size-full object-cover" />
          ) : (
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">Sin fotografía</span>
          )}
        </div>
        <p className="border-l-4 border-accent bg-accent-soft px-3 py-2 text-[12.5px] leading-relaxed text-text">
          Esta es la fotografía principal que verán tus clientes en StylerNow. Usa una imagen actual de la fachada, bien iluminada y nítida.
        </p>
        {hayImagenes ? (
          <label className="inline-flex w-fit cursor-pointer items-center border-2 border-border px-3 py-2 font-mono text-[11px] font-bold uppercase text-text hover:bg-text hover:text-bg">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => void cambiarFoto(e.target.files?.[0])}
            />
            {subiendo ? "Subiendo…" : foto ? "Reemplazar fotografía" : "Subir fotografía"}
          </label>
        ) : (
          <p className="text-[12.5px] text-text-muted">La carga de fotografías no está disponible por ahora.</p>
        )}
      </div>

      <form onSubmit={guardar} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="sn-label">Descripción</span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={600}
            rows={4}
            className="w-full border-2 border-border bg-bg px-3 py-2.5 text-[15px] leading-[22px] text-text outline-none focus:shadow-hard"
          />
          <span className="self-end text-[11px] text-text-faint">{descripcion.length}/600</span>
        </label>
        <Input label="Teléfono de contacto" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <Input label="Correo de contacto" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {aviso ? (
          <p
            role={aviso.tipo === "error" ? "alert" : "status"}
            className={
              aviso.tipo === "error"
                ? "border-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger"
                : "border-2 border-success px-3 py-2 text-[12.5px] font-semibold text-text"
            }
          >
            {aviso.texto}
          </p>
        ) : null}
        <Button type="submit" size="lg" loading={guardando}>
          GUARDAR CAMBIOS
        </Button>
      </form>
    </div>
  );
}

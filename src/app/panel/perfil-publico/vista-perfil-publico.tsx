"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GaleriaNegocio } from "./galeria-negocio";
import type { FotoGaleria } from "./galeria-actions";
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

export function VistaPerfilPublico({ negocio, hayImagenes, fotos }: { negocio: NegocioPerfil; hayImagenes: boolean; fotos: FotoGaleria[] | null }) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(negocio.descripcion ?? "");
  const [telefono, setTelefono] = useState(negocio.telefono_contacto ?? "");
  const [email, setEmail] = useState(negocio.email_contacto ?? "");
  const [guardando, setGuardando] = useState(false);
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

      {fotos === null ? (
        <div className="flex flex-col gap-2">
          <span className="sn-label">Fotografía principal (fachada)</span>
          {negocio.foto_principal_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- fotografía propia del negocio
            <img src={negocio.foto_principal_url} alt="Fachada del negocio" className="aspect-[16/10] w-full border-2 border-border object-cover" />
          ) : null}
          <p className="text-[12.5px] text-text-muted">Estamos activando la galería de fotos (hasta 5). Vuelve en unos minutos.</p>
        </div>
      ) : (
        <GaleriaNegocio negocioId={negocio.id} fotos={fotos} hayImagenes={hayImagenes} />
      )}

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

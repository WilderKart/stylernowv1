"use client";

import { autorizarPublicacion, retirarPublicacion, type EstadoPublicacion } from "@/app/panel/staff/publicacion-actions";
import { subirFotoPerfilStaff } from "@/app/staff/perfil/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { comprimirADataUrl } from "@/lib/imagen/comprimir";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Visibilidad pública del profesional. La foto PROFESIONAL y la autorización de publicación son distintas de la fachada/galería del negocio.
 * Se puede operar sin publicarse: sin foto o sin consentimiento el profesional usa su agenda privada y simplemente no aparece al público.
 * Las casillas llegan SIN marcar (nada premarcado); la regla real la aplica la base de datos (staff_es_publicable).
 */
export function TarjetaVisibilidadPublica({ estado }: { estado: EstadoPublicacion }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aceptaTratamiento, setAceptaTratamiento] = useState(false);
  const [aceptaPublicacion, setAceptaPublicacion] = useState(false);

  const tieneFoto = Boolean(estado.fotoUrl);
  const tratamientoOk = estado.tratamiento === "ACEPTA";
  const consentimientoOk = estado.publicacion === "ACEPTA";
  const puedeAutorizar = aceptaPublicacion && (tratamientoOk || aceptaTratamiento);

  async function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setTrabajando(true);
    setError(null);
    const r = await fn();
    setTrabajando(false);
    if (!r.ok) return setError(r.error ?? "No pudimos completar la acción.");
    router.refresh();
  }

  async function onFoto(archivo: File) {
    // Foto profesional: WebP 0.8, lado máx. 512 px (utilidad central).
    const comprimida = await comprimirADataUrl(archivo, "avatar");
    if (!comprimida.ok) return setError(comprimida.error);
    await ejecutar(async () => {
      const r = await subirFotoPerfilStaff(comprimida.data);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    });
  }

  return (
    <Card className="mb-6 border-accent bg-app shadow-[4px_4px_0_0_var(--color-ink,#111)]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[15px] font-bold uppercase text-text">Tu imagen pública</p>
        <span
          className={`shrink-0 border px-2 py-1 text-[11px] font-bold uppercase ${
            estado.publicable ? "border-ink bg-accent text-ink" : "border-border text-text-muted"
          }`}
        >
          {estado.publicable ? "Visible al público" : "No visible al público"}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
        Puedes administrar y atender sin publicar tu imagen. Para aparecer como profesional en el negocio y el marketplace hacen falta dos cosas:
        una foto profesional y tu autorización expresa. Tu agenda privada funciona igual con o sin ellas.
      </p>

      <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
        <li className="flex items-center justify-between gap-2 border border-border-subtle px-3 py-2">
          <span className="text-text">Foto profesional {tieneFoto ? "cargada" : "pendiente"}</span>
          <label className="cursor-pointer text-[12px] font-bold uppercase text-accent">
            {tieneFoto ? "Cambiar" : "Subir foto"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={trabajando}
              onChange={(e) => e.target.files?.[0] && onFoto(e.target.files[0])}
            />
          </label>
        </li>
        <li className="border border-border-subtle px-3 py-2 text-text">
          Autorización de publicación:{" "}
          {consentimientoOk
            ? `aceptada${estado.publicacionAt ? ` el ${new Date(estado.publicacionAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}` : ""}`
            : estado.publicacion === "REVOCA"
              ? "retirada"
              : "pendiente"}
        </li>
      </ul>

      {consentimientoOk ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" loading={trabajando} onClick={() => ejecutar(retirarPublicacion)}>
            Retirar mi autorización
          </Button>
          <p className="mt-1.5 text-[11.5px] text-text-faint">Al retirarla dejas de mostrarte al público de inmediato y queda constancia.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {tratamientoOk ? null : (
            <label className="flex items-start gap-2 text-[12.5px] text-text-muted">
              <input type="checkbox" checked={aceptaTratamiento} onChange={(e) => setAceptaTratamiento(e.target.checked)} className="mt-0.5" />
              <span>Autorizo el tratamiento de mis datos para gestionar mi vínculo profesional, mi agenda y mis turnos.</span>
            </label>
          )}
          <label className="flex items-start gap-2 text-[12.5px] text-text-muted">
            <input type="checkbox" checked={aceptaPublicacion} onChange={(e) => setAceptaPublicacion(e.target.checked)} className="mt-0.5" />
            <span>Autorizo publicar mi nombre, foto, especialidad y descripción en el perfil público del negocio. Puedo retirarlo cuando quiera.</span>
          </label>
          <div>
            <Button
              size="sm"
              loading={trabajando}
              disabled={!puedeAutorizar}
              onClick={() => ejecutar(() => autorizarPublicacion({ aceptaTratamiento, aceptaPublicacion }))}
            >
              AUTORIZAR PUBLICACIÓN
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

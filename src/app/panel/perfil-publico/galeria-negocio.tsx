"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { comprimirADataUrl } from "@/lib/imagen/comprimir";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { agregarFotoGaleria, eliminarFotoGaleria, marcarFotoPrincipal, reemplazarFotoGaleria, type FotoGaleria } from "./galeria-actions";

const MAXIMO = 5;
const BOTON =
  "inline-flex cursor-pointer items-center border-2 border-border px-2.5 py-1.5 font-mono text-[10.5px] font-bold uppercase text-text hover:bg-text hover:text-bg";

/** Galería de hasta 5 fotos: la principal (fachada) es la que ven primero los clientes. Siempre debe quedar una. */
export function GaleriaNegocio({ negocioId, fotos, hayImagenes }: { negocioId: string; fotos: FotoGaleria[]; hayImagenes: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [aEliminar, setAEliminar] = useState<FotoGaleria | null>(null);

  async function ejecutar(clave: string, textoOk: string, f: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setOcupado(clave);
    setAviso(null);
    const r = await f();
    setOcupado(null);
    setAviso(r.ok ? { tipo: "ok", texto: textoOk } : { tipo: "error", texto: r.error });
    if (r.ok) router.refresh();
  }

  async function leer(archivo: File | undefined) {
    if (!archivo) return null;
    const leida = await comprimirADataUrl(archivo, "media");
    if (!leida.ok) {
      setAviso({ tipo: "error", texto: leida.error });
      return null;
    }
    return leida.data;
  }

  async function agregar(archivo: File | undefined) {
    const d = await leer(archivo);
    if (d) await ejecutar("nueva", "Foto agregada.", () => agregarFotoGaleria(negocioId, d));
  }

  async function reemplazar(foto: FotoGaleria, archivo: File | undefined) {
    const d = await leer(archivo);
    if (d) await ejecutar(foto.id, "Foto reemplazada.", () => reemplazarFotoGaleria(negocioId, foto.id, d));
  }

  const llena = fotos.length >= MAXIMO;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sn-label">Fotos de tu negocio</span>
        <span className="font-mono text-[11px] font-bold text-text-muted">
          {fotos.length}/{MAXIMO}
        </span>
      </div>
      <p className="border-l-4 border-accent bg-accent-soft px-3 py-2 text-[12.5px] leading-relaxed text-text">
        Puedes tener hasta 5 fotos. La <b>principal</b> (normalmente la fachada) es la que ven primero tus clientes; siempre debe haber una visible.
      </p>

      {fotos.length === 0 ? (
        <p className="border-2 border-dashed border-border px-3 py-8 text-center font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
          Sin fotografías
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 border-2 border-border p-2">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- fotografía propia del negocio */}
                <img src={f.url} alt="Foto del negocio" className="size-full object-cover" />
                {f.esPrincipal ? (
                  <span className="absolute left-1 top-1 bg-signal px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">Principal</span>
                ) : null}
                {ocupado === f.id ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-mono text-[11px] font-bold uppercase text-white">…</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!f.esPrincipal ? (
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => void ejecutar(f.id, "Foto principal actualizada.", () => marcarFotoPrincipal(f.id))}
                    className={BOTON}
                  >
                    Hacer principal
                  </button>
                ) : null}
                {hayImagenes ? (
                  <label className={BOTON}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={ocupado !== null}
                      onChange={(e) => {
                        void reemplazar(f, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    Reemplazar
                  </label>
                ) : null}
                <button
                  type="button"
                  disabled={ocupado !== null || fotos.length <= 1}
                  title={fotos.length <= 1 ? "Debe quedar al menos una foto" : undefined}
                  onClick={() => setAEliminar(f)}
                  className="inline-flex items-center border-2 border-danger px-2.5 py-1.5 font-mono text-[10.5px] font-bold uppercase text-danger hover:bg-danger hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hayImagenes ? (
        <label className={`${BOTON} w-fit ${llena || ocupado !== null ? "pointer-events-none opacity-40" : ""}`}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={llena || ocupado !== null}
            onChange={(e) => {
              void agregar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {ocupado === "nueva" ? "Subiendo…" : llena ? "Galería completa" : fotos.length === 0 ? "Subir fotografía" : "Agregar foto"}
        </label>
      ) : (
        <p className="text-[12.5px] text-text-muted">La carga de fotografías no está disponible por ahora.</p>
      )}

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

      <ConfirmDialog
        isOpen={aEliminar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAEliminar(null);
        }}
        title="¿Eliminar esta foto?"
        description={
          aEliminar?.esPrincipal
            ? "Es la foto principal: la siguiente pasará a ser la principal. Esta acción no se puede deshacer."
            : "Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          const f = aEliminar;
          setAEliminar(null);
          if (f) void ejecutar(f.id, "Foto eliminada.", () => eliminarFotoGaleria(f.id));
        }}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}

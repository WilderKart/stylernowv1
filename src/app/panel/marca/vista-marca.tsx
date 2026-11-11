"use client";

import { Chip, ChipGroup, Label, Meta, Num, Panel, Poster, SectionTitle, Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarMarca, solicitarActivacionMarca, subirLogoMarca } from "./actions";

export interface MarcaInicial {
  nombre: string;
  slogan: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  publicada: boolean;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function VistaMarca({
  activo,
  precioTexto,
  cobroHabilitado,
  nombreNegocio,
  logoNegocio,
  marca,
}: {
  activo: boolean;
  precioTexto: string | null;
  cobroHabilitado: boolean;
  nombreNegocio: string;
  logoNegocio: string | null;
  marca: MarcaInicial | null;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-5 py-8 sm:px-10">
      <Num>Add-on</Num>
      <Poster as="h1" size={3} className="mb-6 break-words">
        Mi Marca
      </Poster>
      {activo ? (
        <FormularioMarca nombreNegocio={nombreNegocio} logoNegocio={logoNegocio} marca={marca} />
      ) : (
        <OfertaMarca precioTexto={precioTexto} cobroHabilitado={cobroHabilitado} />
      )}
    </main>
  );
}

// ── Estado sin add-on: producto + solicitud ──────────────────────────────

function OfertaMarca({ precioTexto, cobroHabilitado }: { precioTexto: string | null; cobroHabilitado: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [enviada, setEnviada] = useState(false);

  function solicitar() {
    iniciar(async () => {
      const r = await solicitarActivacionMarca();
      if (!r.ok) return void toast.error(r.error);
      setEnviada(true);
      toast.success(r.data.yaExistia ? "Ya tienes una solicitud abierta. Te contactaremos pronto." : "Solicitud enviada. Te contactaremos pronto.");
    });
  }

  return (
    <Panel className="min-w-0">
      <div className="p-card__h flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Haz que tu página sea tuya</SectionTitle>
        <Status tone={precioTexto ? "ok" : "warn"}>{precioTexto ? `${precioTexto} / mes` : "PENDIENTE"}</Status>
      </div>
      <div className="p-card__b flex min-w-0 flex-col gap-4">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text">
          <li>Tu nombre de marca y slogan en tu página pública.</li>
          <li>Tu logo y tus colores en lugar de los de StylerNow.</li>
          <li>Borrador y publicación: tú decides cuándo se ve.</li>
        </ul>
        <Meta className="break-words">
          {cobroHabilitado
            ? "El cobro del add-on se carga a tu suscripción."
            : "El cobro del add-on se habilita junto con la pasarela de pago de tu país. Mientras tanto coordinamos la activación contigo por soporte."}
        </Meta>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={solicitar} loading={pendiente} disabled={enviada}>
            {enviada ? "Solicitud enviada" : "Solicitar activación"}
          </Button>
          <Link href="/panel/soporte" className="sn-label underline">
            Ver mis tickets
          </Link>
        </div>
      </div>
    </Panel>
  );
}

// ── Estado con add-on: formulario + vista previa ─────────────────────────

function FormularioMarca({ nombreNegocio, logoNegocio, marca }: { nombreNegocio: string; logoNegocio: string | null; marca: MarcaInicial | null }) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(marca?.nombre ?? nombreNegocio);
  const [slogan, setSlogan] = useState(marca?.slogan ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(marca?.logoUrl ?? logoNegocio);
  const [primario, setPrimario] = useState(marca?.colorPrimario ?? "#FF4D00");
  const [secundario, setSecundario] = useState(marca?.colorSecundario ?? "#0A0A0A");
  const [publicada, setPublicada] = useState(marca?.publicada ?? false);

  const primarioOk = HEX.test(primario);
  const secundarioOk = HEX.test(secundario);
  const nombreOk = nombre.trim().length >= 1 && nombre.trim().length <= 60;

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return void toast.error("Usa una imagen PNG, JPG o WebP.");
    if (f.size > 5 * 1024 * 1024) return void toast.error("La imagen no puede superar 5 MB.");
    const lector = new FileReader();
    lector.onload = async () => {
      setSubiendo(true);
      const r = await subirLogoMarca(String(lector.result));
      setSubiendo(false);
      if (!r.ok) return void toast.error(r.error);
      setLogoUrl(r.data.url);
      toast.success("Logo subido. Guarda para aplicarlo.");
    };
    lector.readAsDataURL(f);
  }

  function guardar(publicar: boolean) {
    if (!nombreOk) return void toast.error("Escribe un nombre de marca (máx. 60 caracteres).");
    if (!primarioOk || !secundarioOk) return void toast.error("Los colores deben tener formato #RRGGBB.");
    iniciar(async () => {
      const r = await guardarMarca({ nombre, slogan, logoUrl, colorPrimario: primario, colorSecundario: secundario, publicar });
      if (!r.ok) return void toast.error(r.error);
      setPublicada(publicar);
      toast.success(publicar ? "Marca publicada." : "Borrador guardado.");
      router.refresh();
    });
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel className="min-w-0">
        <div className="p-card__h flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Tu marca</SectionTitle>
          <Status tone={publicada ? "ok" : "warn"}>{publicada ? "Publicada" : "Borrador"}</Status>
        </div>
        <div className="p-card__b flex min-w-0 flex-col gap-4">
          <Input label="Nombre de marca" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} error={nombreOk ? undefined : "Obligatorio"} />
          <Input label="Slogan" maxLength={120} value={slogan} onChange={(e) => setSlogan(e.target.value)} />

          <div className="flex min-w-0 flex-col gap-2">
            <Label>Logo</Label>
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? <img src={logoUrl} alt="Logo de la marca" className="size-16 border-2 border-border object-cover" /> : <Meta>Sin logo</Meta>}
              <Button variant="secondary" onClick={() => archivo.current?.click()} loading={subiendo}>
                {logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
              {logoUrl ? (
                <Button variant="ghost" onClick={() => setLogoUrl(null)}>
                  Quitar
                </Button>
              ) : null}
            </div>
            <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={elegirArchivo} />
            <Meta>PNG, JPG o WebP, hasta 5 MB.</Meta>
          </div>

          <CampoColor etiqueta="Color primario" valor={primario} onChange={setPrimario} ok={primarioOk} />
          <CampoColor etiqueta="Color secundario" valor={secundario} onChange={setSecundario} ok={secundarioOk} />

          <div className="flex min-w-0 flex-col gap-2">
            <Label>Estado</Label>
            <ChipGroup aria-label="Estado de la marca">
              <Chip selected={!publicada} onClick={() => setPublicada(false)}>
                Borrador
              </Chip>
              <Chip selected={publicada} onClick={() => setPublicada(true)}>
                Publicada
              </Chip>
            </ChipGroup>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => guardar(publicada)} loading={guardando}>
              {publicada ? "Guardar y publicar" : "Guardar borrador"}
            </Button>
          </div>
        </div>
      </Panel>

      <div className="flex min-w-0 flex-col gap-2">
        <Label>Vista previa</Label>
        <VistaPrevia nombre={nombre} slogan={slogan} logoUrl={logoUrl} primario={primarioOk ? primario : "#FF4D00"} secundario={secundarioOk ? secundario : "#0A0A0A"} />
        <Meta>Así se verá tu página pública cuando la marca esté publicada.</Meta>
      </div>
    </div>
  );
}

function CampoColor({ etiqueta, valor, onChange, ok }: { etiqueta: string; valor: string; onChange: (v: string) => void; ok: boolean }) {
  return (
    <div className="flex min-w-0 items-end gap-3">
      <div className="min-w-0 flex-1">
        <Input label={etiqueta} value={valor} maxLength={7} placeholder="#RRGGBB" onChange={(e) => onChange(e.target.value.trim())} error={ok ? undefined : "Formato #RRGGBB"} />
      </div>
      <input
        type="color"
        aria-label={`Elegir ${etiqueta.toLowerCase()}`}
        value={ok ? valor : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-12 shrink-0 cursor-pointer border-2 border-border bg-bg p-0"
      />
    </div>
  );
}

/** Perfil de marca estilo C25: banda de color primario, logo, nombre, slogan y CTA en secundario. */
function VistaPrevia({ nombre, slogan, logoUrl, primario, secundario }: { nombre: string; slogan: string; logoUrl: string | null; primario: string; secundario: string }) {
  return (
    <div className="min-w-0 overflow-hidden border-2 border-border shadow-hard" style={{ background: "var(--bg)" }}>
      <div className="flex min-w-0 items-center gap-4 p-5" style={{ background: primario }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-16 shrink-0 border-2 object-cover" style={{ borderColor: secundario }} />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center border-2 font-mono text-xl font-bold" style={{ borderColor: secundario, color: secundario }}>
            {(nombre.trim()[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="poster-4 break-words" style={{ color: secundario }}>
            {nombre.trim() || "Tu marca"}
          </span>
          {slogan.trim() ? (
            <span className="sn-meta break-words" style={{ color: secundario }}>
              {slogan}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <Meta>Servicios · Equipo · Reseñas</Meta>
        <span className="inline-flex min-h-12 items-center justify-center self-start border-2 px-4 font-mono text-xs font-bold tracking-[0.72px] uppercase" style={{ background: secundario, color: primario, borderColor: secundario }}>
          Reservar cita
        </span>
      </div>
    </div>
  );
}

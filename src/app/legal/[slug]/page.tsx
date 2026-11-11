import { Hot, PantallaAuth } from "@/app/login/_componentes/pantalla-auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

const TIPOS = {
  "politica-de-datos": { tipo: "POLITICA_DATOS", titulo: "Política de Tratamiento de Datos" },
  terminos: { tipo: "TERMINOS", titulo: "Términos y Condiciones" },
} as const;

export async function generateStaticParams() {
  return Object.keys(TIPOS).map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/legal/[slug]">) {
  const { slug } = await props.params;
  const config = TIPOS[slug as keyof typeof TIPOS];
  return { title: config?.titulo ?? "Legal" };
}

export default async function LegalPage(props: PageProps<"/legal/[slug]">) {
  const { slug } = await props.params;
  const config = TIPOS[slug as keyof typeof TIPOS];
  if (!config) notFound();

  const supabase = await createClient();
  // texto_legal es de lectura pública (política `texto_legal_select_publico`):
  // se muestra la versión vigente más reciente de este tipo de documento.
  const { data: texto } = await supabase
    .from("texto_legal")
    .select("contenido, version, publicado_at")
    .eq("tipo", config.tipo)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!texto) notFound();

  const parrafos = texto.contenido.split("\n\n").filter(Boolean);

  return (
    <PantallaAuth
      indice="10 / Legal"
      volver="/login"
      tamano={3}
      ancho="max-w-2xl"
      titulo={<Hot>{config.titulo}</Hot>}
      intro={
        <span className="sn-meta">
          Versión {texto.version} · vigente desde{" "}
          {new Date(texto.publicado_at).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      }
    >
      <div className="flex flex-col gap-4 border-t-2 border-border pt-4">
        {parrafos.map((p, i) => {
          const esTitulo = /^\d+\.\s/.test(p);
          return esTitulo ? (
            <h2 key={i} className="section mt-2 text-[15px] leading-5 break-words">
              {p}
            </h2>
          ) : (
            <p key={i} className="body text-text-muted break-words">
              {p}
            </p>
          );
        })}
      </div>
    </PantallaAuth>
  );
}

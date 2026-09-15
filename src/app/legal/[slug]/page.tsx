import { BarraSuperior } from "@/components/layout/header";
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
    <div className="flex min-h-dvh flex-col bg-bg">
      <BarraSuperior titulo={config.titulo} volverA="/login" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 sm:px-10">
        <p className="mb-6 text-[11.5px] text-text-faint">
          Versión {texto.version} · vigente desde{" "}
          {new Date(texto.publicado_at).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="flex flex-col gap-4">
          {parrafos.map((p, i) => {
            const esTitulo = /^\d+\.\s/.test(p);
            return esTitulo ? (
              <h2 key={i} className="font-display mt-2 text-[15px] font-bold text-text">
                {p}
              </h2>
            ) : (
              <p key={i} className="text-[13.5px] leading-relaxed text-text-muted">
                {p}
              </p>
            );
          })}
        </div>
      </main>
    </div>
  );
}

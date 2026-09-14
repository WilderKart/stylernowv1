import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioLogin } from "./formulario";

export const metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

/**
 * Solo se acepta un destino interno: un `next` absoluto o protocol-relative sería
 * una redirección abierta hacia un dominio de terceros tras autenticarse.
 */
function destinoSeguro(valor: string | string[] | undefined) {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const siguiente = destinoSeguro(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(siguiente);

  return <FormularioLogin siguiente={siguiente} />;
}

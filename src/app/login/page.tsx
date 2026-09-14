import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FormularioLogin } from "./formulario";

export const metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

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

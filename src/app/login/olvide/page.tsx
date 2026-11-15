import { destinoSeguro } from "@/lib/auth/destino-seguro";
import { obtenerT } from "@/lib/i18n/servidor";
import { VistaOlvide } from "./vista-olvide";

export async function generateMetadata() {
  const t = await obtenerT();
  return { title: t("login.meta_recuperar"), robots: { index: false, follow: false } };
}

/** ¿Olvidaste tu contraseña? — paso 1 de la recuperación (paso 2: /login/recuperar). */
export default async function OlvidePage(props: PageProps<"/login/olvide">) {
  const params = await props.searchParams;
  return <VistaOlvide siguiente={destinoSeguro(params.next)} />;
}

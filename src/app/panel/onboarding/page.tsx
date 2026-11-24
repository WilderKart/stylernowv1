import { categoriaRegistroDe } from "@/lib/auth/destino-inicial";
import { obtenerConfigPrueba } from "@/app/panel/suscripcion/config-prueba";
import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { listarPaisesActivos, obtenerCatalogoPais } from "@/lib/planes/catalogo";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { almacenamientoDeImagenesDisponible } from "./actions";
import { Wizard } from "./wizard";

export const metadata = { title: "Registra tu negocio" };

export default async function OnboardingNegocioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel/onboarding");

  // Un Guardian ya pertenece a un negocio existente como Staff — este wizard
  // es exclusivo para dar de alta un negocio NUEVO como Barbería (ADR-006).
  const contexto = await resolverContexto();
  if (contexto.rol === "GUARDIAN") redirect("/panel");

  const { data: negocio } = await supabase
    .from("negocio")
    .select(
      "id, nombre, categoria, ciudad, descripcion, logo_url, foto_principal_url, telefono_contacto, email_contacto, plan_codigo, onboarding_completo, estado, pais_codigo"
    )
    .eq("owner_user_id", user.id)
    // Mismo criterio que resolverContexto: con negocios duplicados, el más avanzado.
    .order("onboarding_completo", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Un negocio con el alta cerrada no vuelve al wizard: el panel muestra su estado y el asistente de bienvenida.
  if (negocio?.onboarding_completo) redirect("/panel");

  const [{ data: sede }, { data: suscripcion }] = negocio
    ? await Promise.all([
        supabase
          .from("sede")
          .select("id, nombre, direccion, ciudad, horario_base, latitud, longitud")
          .eq("negocio_id", negocio.id)
          .eq("cerrada_permanente", false)
          .order("created_at")
          .limit(1)
          .maybeSingle()
          .then((r) => ({ data: r.data })),
        supabase.from("suscripcion").select("plan_codigo, estado").eq("negocio_id", negocio.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  const [paises, configPrueba, hayImagenes] = await Promise.all([
    listarPaisesActivos(),
    obtenerConfigPrueba(),
    almacenamientoDeImagenesDisponible(),
  ]);
  const catalogos = (await Promise.all(paises.map((p) => obtenerCatalogoPais(p.codigo)))).filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  // Paso válido más avanzado según lo ya guardado en el servidor (nunca según el navegador).
  const pasoMaximo = !negocio ? 1 : !sede ? 2 : !suscripcion ? 3 : 4;

  return (
    <Wizard
      perfilEmail={user.email ?? ""}
      categoriaSugerida={categoriaRegistroDe(user) ? [categoriaRegistroDe(user) as string] : undefined}
      negocioInicial={negocio ?? null}
      sedeInicial={sede ?? null}
      planInicial={suscripcion?.plan_codigo ?? null}
      pasoMaximoInicial={pasoMaximo}
      catalogos={catalogos}
      diasPrueba={configPrueba.dias}
      hayImagenes={hayImagenes}
    />
  );
}

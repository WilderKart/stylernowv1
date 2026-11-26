import { PanelNav } from "@/components/panel/panel-nav";
import { verificarAccesoPanel } from "@/lib/auth/verificar-acceso-panel";
import { formatearMoneda } from "@/lib/planes/moneda";
import { createClient } from "@/lib/supabase/server";
import { VistaMarca } from "./vista-marca";

export const metadata = { title: "Mi Marca" };

/** Vigente = sin fecha de fin (activación manual) o con fin en el futuro. */
function estaVigente(hasta: string | null) {
  return !hasta || new Date(hasta).getTime() > Date.now();
}

export default async function MarcaPage() {
  // Mi Marca es decisión del dueño del negocio: solo rol Barbería.
  const contexto = await verificarAccesoPanel(["BARBERIA"], "/panel/marca");
  const negocioId = contexto.negocioId!;
  const supabase = await createClient();

  const [{ data: negocio }, { data: addon }, { data: marca }] = await Promise.all([
    supabase.from("negocio").select("nombre, logo_url, pais_codigo").eq("id", negocioId).single(),
    supabase.from("negocio_addon").select("id, hasta").eq("negocio_id", negocioId).eq("addon_codigo", "MI_MARCA").eq("activo", true).limit(1),
    supabase
      .from("negocio_marca")
      .select("nombre_marca, slogan, logo_url, color_primario, color_secundario, estado")
      .eq("negocio_id", negocioId)
      .maybeSingle(),
  ]);

  const paisCodigo = negocio?.pais_codigo ?? "CO";
  const [{ data: pais }, { data: precio }] = await Promise.all([
    supabase.from("pais").select("moneda, locale, pasarela, cobro_recurrente_habilitado").eq("codigo", paisCodigo).maybeSingle(),
    supabase.from("addon_precio").select("precio_mensual").eq("addon_codigo", "MI_MARCA").eq("pais_codigo", paisCodigo).maybeSingle(),
  ]);

  // Vigente: activo y sin vencer (una activación manual sin fecha de fin sigue vigente).
  const vigente = (addon ?? []).some((a) => estaVigente(a.hasta));

  const precioTexto =
    precio?.precio_mensual != null && pais ? formatearMoneda(Number(precio.precio_mensual), pais.moneda, pais.locale) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <PanelNav rol={contexto.rol} />
      <VistaMarca
        activo={vigente}
        vigenteHasta={addon?.[0]?.hasta ?? null}
        precioTexto={precioTexto}
                nombreNegocio={negocio?.nombre ?? ""}
        logoNegocio={negocio?.logo_url ?? null}
        marca={
          marca
            ? {
                nombre: marca.nombre_marca,
                slogan: marca.slogan ?? "",
                logoUrl: marca.logo_url,
                colorPrimario: marca.color_primario,
                colorSecundario: marca.color_secundario,
                publicada: marca.estado === "PUBLICADA",
              }
            : null
        }
      />
    </div>
  );
}

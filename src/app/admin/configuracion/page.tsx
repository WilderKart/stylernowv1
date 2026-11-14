import { EncabezadoAdmin } from "@/app/admin/_componentes/encabezado-admin";
import {
  listarBanners,
  listarCiudades,
  listarPlanes,
  listarTextosLegales,
  obtenerComisionGlobal,
  obtenerMetricasAdsPlataforma,
  obtenerTarifasAds,
} from "./actions";
import { VistaConfiguracion } from "./vista-configuracion";

export default async function AdminConfiguracionPage() {
  const [comision, ciudades, banners, planes, textos, tarifasAds, metricasAds] = await Promise.all([
    obtenerComisionGlobal(),
    listarCiudades(),
    listarBanners(),
    listarPlanes(),
    listarTextosLegales(),
    obtenerTarifasAds(),
    obtenerMetricasAdsPlataforma(),
  ]);

  return (
    <main className="w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <EncabezadoAdmin seccion="Configuración" titulo="Configuración" resaltado="global." />
      <VistaConfiguracion
        comisionInicial={comision.ok ? comision.data : 8}
        ciudadesIniciales={ciudades.ok ? ciudades.data : []}
        bannersIniciales={banners.ok ? banners.data : []}
        planesIniciales={planes.ok ? planes.data : []}
        textosIniciales={textos.ok ? textos.data : []}
        tarifasAdsIniciales={tarifasAds.ok ? tarifasAds.data : { cpcDestacado: 0, cpcPin: 0, cpmPin: 0 }}
        metricasAdsIniciales={metricasAds.ok ? metricasAds.data : { gastoTotalPlataforma: 0, campanasActivas: 0 }}
      />
    </main>
  );
}

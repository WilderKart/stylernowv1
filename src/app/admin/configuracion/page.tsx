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
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Configuración global</h1>
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

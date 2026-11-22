import { AvisoSinConexion } from "./aviso-sin-conexion";
import { EstadoSistema } from "./estado-sistema";
import { RecargaPorVersion } from "./recarga-por-version";
import { SplashArranque } from "./splash-arranque";

/** Estados globales del sistema (C16): splash de primera visita, sin conexión, mantenimiento y nueva versión. */
export function SistemaCliente() {
  return (
    <>
      <SplashArranque />
      <AvisoSinConexion />
      <EstadoSistema />
      <RecargaPorVersion />
    </>
  );
}

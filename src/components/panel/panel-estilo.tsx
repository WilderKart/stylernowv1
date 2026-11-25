"use client";

import { createContext, useContext } from "react";

/**
 * Indica a los componentes del panel si el negocio usa el diseño unificado (spa, salón y uñas).
 * Barbería y tattoo quedan en `false` y conservan su navegación y estilo originales.
 * Es solo presentación: el servidor decide la categoría y los permisos siguen en las acciones y la base de datos.
 */
const PanelSuaveContexto = createContext(true);

export function PanelSuaveProvider({ suave, children }: { suave: boolean; children: React.ReactNode }) {
  return <PanelSuaveContexto.Provider value={suave}>{children}</PanelSuaveContexto.Provider>;
}

export function usePanelSuave() {
  return useContext(PanelSuaveContexto);
}

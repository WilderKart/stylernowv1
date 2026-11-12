"use client";

import { createContext, useContext, useMemo } from "react";
import { IDIOMA_BASE, crearTraductor, type Idioma, type Traductor } from "./diccionario";

const Contexto = createContext<Idioma>(IDIOMA_BASE);

/** Envuelve la app (layout raíz) con el idioma resuelto en el servidor. */
export function IdiomaProvider({ idioma, children }: { idioma: Idioma; children: React.ReactNode }) {
  return <Contexto.Provider value={idioma}>{children}</Contexto.Provider>;
}

export function useIdioma(): Idioma {
  return useContext(Contexto);
}

/** Traductor para componentes de cliente: `const t = useT(); t("nav.explorar")`. */
export function useT(): Traductor {
  const idioma = useContext(Contexto);
  return useMemo(() => crearTraductor(idioma), [idioma]);
}

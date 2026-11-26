"use client";

import { TERMINOLOGIA_GENERICA, traducirTextos, type Terminologia } from "@/lib/terminologia";
import { createContext, useContext, useMemo } from "react";

/** Cómo se llama a quien presta el servicio en este negocio (solo textos; el servidor decide la categoría). */
const Contexto = createContext<Terminologia>(TERMINOLOGIA_GENERICA);

export function TerminologiaProvider({ terminos, children }: { terminos: Terminologia; children: React.ReactNode }) {
  return <Contexto.Provider value={terminos}>{children}</Contexto.Provider>;
}

export function useTerminologia(): Terminologia {
  return useContext(Contexto);
}

/** Etiquetas fijas del módulo con «barbero(s)» sustituido por el término del negocio. */
export function useTextos<T>(textos: T): T {
  const tm = useTerminologia();
  return useMemo(() => traducirTextos(textos, tm), [textos, tm]);
}

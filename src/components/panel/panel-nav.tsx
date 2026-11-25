"use client";

import type { RolPanel } from "@/lib/auth/resolver-contexto";
import { PanelNavSuave } from "./panel-nav-suave";

/**
 * Punto único de entrada de la navegación del panel. Un solo diseño para todos los tipos de negocio (barbería, tattoo,
 * salón, uñas y spa): barra lateral flotante en escritorio y barra inferior + hoja «Más» en móvil.
 */
export function PanelNav(props: { rol: RolPanel; /** Perfil profesional activo: añade el acceso a la agenda propia (/staff). */ prestaServicios?: boolean }) {
  return <PanelNavSuave rol={props.rol} prestaServicios={props.prestaServicios} />;
}

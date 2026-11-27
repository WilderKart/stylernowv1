"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export const CLAVE_ONBOARDING = "stylernow_onboarding_visto";

/**
 * Primera visita del navegador: si entra por la portada («/») y nunca vio el onboarding, se le lleva a /onboarding.
 * Solo la portada (no enlaces profundos como una reserva o un negocio) y solo una vez; sin localStorage no se redirige.
 */
export function OnboardingPrimeraVisita() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      if (pathname === "/onboarding") {
        localStorage.setItem(CLAVE_ONBOARDING, "1");
        return;
      }
      if (pathname === "/" && !localStorage.getItem(CLAVE_ONBOARDING)) {
        localStorage.setItem(CLAVE_ONBOARDING, "1");
        router.replace("/onboarding");
      }
    } catch {
      /* sin almacenamiento: no se redirige, para no repetirlo en cada carga */
    }
  }, [pathname, router]);

  return null;
}

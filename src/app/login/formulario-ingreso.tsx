"use client";

import { Turnstile, type ControlTurnstile } from "@/components/seguridad/turnstile";

import { Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/proveedor";
import { Scissors, User } from "lucide-react";
import { AuthDividido } from "@/components/auth/auth-dividido";
import type { CategoriaRegistro } from "@/lib/tema/vertical";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { Aviso, BotonGoogle, CampoContrasena, guardarVerificacion } from "./_componentes/campos";
import { BarraVolverAuth, ErrorForm, Hot, Separador, claseEnlace } from "./_componentes/pantalla-auth";
import { iniciarSesionConContrasena, iniciarSesionConGoogle, reenviarCodigoVerificacion } from "./actions";

/**
 * INGRESAR (rediseño 2026-11-22): solo para cuentas existentes, con correo + contraseña.
 * El código por correo ya no es un método de ingreso. Crear cuenta vive en /registro y
 * recuperar la contraseña en /login/olvide: cada pantalla tiene una sola acción principal.
 *
 * Solo cambia la presentación: en escritorio es una pantalla dividida (panel de marca a la
 * izquierda + formulario centrado a la derecha) y en móvil una sola columna con jerarquía
 * clara. Turnstile, invitaciones, handlers, estados, Supabase, OAuth y `?next=` quedan intactos.
 */
export function FormularioIngreso({
  siguiente,
  aviso,
  invitacion,
  categoria = null,
}: {
  categoria?: CategoriaRegistro | null;
  siguiente: string;
  aviso?: "recuperada" | "enlace";
  /** Staff invitado que ya tiene cuenta: correo precargado y aviso de la invitación. */
  invitacion?: { email: string; negocio: string } | null;
}) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState(invitacion?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinVerificar, setSinVerificar] = useState(false);
  // El banner de cookies es un overlay fijo (no se toca): mientras está visible se reserva
  // espacio inferior para que ningún botón quede inalcanzable. Al elegir, desaparece y el
  // formulario vuelve a su centrado natural. Misma clave/evento que usa el banner.
  const bannerCookies = useBannerCookiesVisible();

  const qs = siguiente && siguiente !== "/" ? `?next=${encodeURIComponent(siguiente)}` : "";

  const [tokenTs, setTokenTs] = useState<string | null>(null);
  const controlTs = useRef<ControlTurnstile>(null);

  async function onIngresar(e: React.FormEvent) {
    e.preventDefault();
    setSinVerificar(false);
    if (!email.trim() || !password) {
      setError(t("auth.err_campos"));
      return;
    }
    if (!tokenTs) {
      setError(t("auth.err_verificando"));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await iniciarSesionConContrasena(email, password, siguiente, tokenTs);
    // Cada token sirve una sola vez: se pide uno nuevo para el siguiente intento.
    controlTs.current?.reiniciar();
    if (!res.ok) {
      setLoading(false);
      if ("sinVerificar" in res && res.sinVerificar) setSinVerificar(true);
      else setError(res.error);
      return;
    }
    // Super Admin a su panel; el resto a su destino (el servidor desvía a «Completa tu perfil»
    // o a /legal/aceptar si hace falta, y cada rol aterriza en su propia zona).
    // Navegación completa al cambiar la sesión: nada de la caché del router de antes de ingresar.
    window.location.assign(res.destino);
  }

  async function onVerificarAhora() {
    setLoading(true);
    const res = await reenviarCodigoVerificacion(email, siguiente);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    guardarVerificacion(email.trim().toLowerCase(), siguiente);
    router.push(`/registro/verificar${qs}`);
  }

  async function onGoogle() {
    setGoogleCargando(true);
    setError(null);
    const res = await iniciarSesionConGoogle(siguiente);
    if (!res.ok) {
      setGoogleCargando(false);
      setError(res.error);
      return;
    }
    window.location.href = res.url;
  }

  return (
    <AuthDividido categoria={categoria}>
      {/* Panel de formulario */}
      <div className="flex min-h-dvh flex-col">
        <BarraVolverAuth />

        <div className={`flex flex-1 flex-col px-5 pt-3 sm:px-8 lg:pt-0 ${bannerCookies ? "pb-80 lg:pb-60" : "pb-16 lg:pb-10"}`}>
          <div className="mx-auto flex w-full max-w-lg flex-col lg:my-auto lg:max-w-md">
            <Poster as="h1" size={3} className="pt-1 pb-3 break-words lg:pb-4 lg:text-[44px]">
              {t("auth.ing_t1")}
              <br />
              {t("auth.ing_t2")}
              <br />
              <Hot>{t("auth.ing_t3")}</Hot>
            </Poster>
            <p className="body mb-4 text-text-muted break-words">{t("auth.ing_intro")}</p>

            <form onSubmit={onIngresar} className="flex flex-col gap-4" noValidate>
              {invitacion ? <Aviso>Ingresa con tu cuenta para continuar con la invitación de {invitacion.negocio}.</Aviso> : null}
              {aviso === "recuperada" ? <Aviso>{t("auth.aviso_recuperada")}</Aviso> : null}
              {aviso === "enlace" ? <Aviso>{t("auth.aviso_enlace")}</Aviso> : null}

              <Input
                label={t("login.correo")}
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder={t("login.correo_ph")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex flex-col gap-1">
                <CampoContrasena label={t("login.contrasena")} name="password" value={password} onChange={setPassword} autoComplete="current-password" />
                <Link href={`/login/olvide${qs}`} className={`${claseEnlace} self-end`}>
                  {t("auth.olvide")}
                </Link>
              </div>

              <Turnstile ref={controlTs} accion="ingreso" onToken={setTokenTs} />
              {error ? <ErrorForm>{error}</ErrorForm> : null}
              {sinVerificar ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-[14px] text-text">{t("auth.sin_verificar")}</p>
                  <button type="button" onClick={onVerificarAhora} disabled={loading} className={`${claseEnlace} self-start`}>
                    {t("auth.verificar_ahora")}
                  </button>
                </div>
              ) : null}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {t("auth.ingresar")}
              </Button>

              <Separador>{t("login.o")}</Separador>
              <BotonGoogle texto={t("login.google")} onClick={onGoogle} cargando={googleCargando} />

              {/* ¿Todavía no tienes cuenta? — tarjeta secundaria destacada */}
              <Link
                href={`/registro${qs}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg px-4 py-3.5 no-underline shadow-hard-sm transition-colors hover:bg-surface"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="body-sm text-text-muted">{t("auth.sin_cuenta")}</span>
                  <span className="text-[15px] font-semibold text-accent-text">{t("auth.crea_una")}</span>
                </span>
                <User className="size-5 shrink-0 text-text" aria-hidden />
              </Link>

              {/* Registro de negocios */}
              <Link
                href="/para-negocios"
                className="flex items-center justify-between gap-3 rounded-2xl bg-signal px-4 py-3.5 text-white no-underline shadow-[0_10px_22px_-10px_rgba(11,99,246,0.7)] transition-transform duration-150 hover:-translate-y-0.5"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-white/85">{t("login.negocio_q")}</span>
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-white">
                    {t("login.negocio_cta")}
                  </span>
                </span>
                <Scissors className="size-6 shrink-0 text-white" aria-hidden />
              </Link>
            </form>
          </div>
        </div>
      </div>
    </AuthDividido>
  );
}

/**
 * ¿Sigue visible el banner de cookies? Lee la misma clave de `localStorage` y escucha el
 * evento que emite el banner al elegir. `useSyncExternalStore` evita el setState dentro de
 * un efecto (servidor: sin reserva; cliente: se ajusta tras hidratar).
 */
function useBannerCookiesVisible(): boolean {
  return useSyncExternalStore(
    (alCambiar) => {
      window.addEventListener("stylernow:cookies", alCambiar);
      return () => window.removeEventListener("stylernow:cookies", alCambiar);
    },
    () => {
      try {
        return !localStorage.getItem("stylernow_cookies_v1");
      } catch {
        return true;
      }
    },
    () => false
  );
}
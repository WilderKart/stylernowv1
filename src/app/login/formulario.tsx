"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { enviarCodigo, verificarCodigo } from "./actions";

/**
 * Clave de sessionStorage para sobrevivir al paso "codigo" si el usuario cambia de
 * pestaña a revisar el correo y la vuelve a abrir, o la refresca sin querer — sin
 * esto, todo el estado vivía solo en memoria de React y un refresh lo mandaba de
 * nuevo a pedir el correo desde cero, incluso con la sesión de a medio camino.
 * Se limpia sola al confirmar o al tocar "Cambiar correo".
 */
const CLAVE_PASO = "stylernow_login_paso";

export function FormularioLogin({ siguiente }: { siguiente: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, iniciarHidratacion] = useTransition();

  useEffect(() => {
    iniciarHidratacion(() => {
      try {
        const guardado = sessionStorage.getItem(CLAVE_PASO);
        if (!guardado) return;
        const datos = JSON.parse(guardado) as { email?: string };
        if (datos.email) {
          setEmail(datos.email);
          setStep("codigo");
        }
      } catch {
        // localStorage/sessionStorage puede fallar (navegación privada, cuota) —
        // el usuario simplemente vuelve a pedir el código, no rompe nada.
      }
    });
  }, [iniciarHidratacion]);

  function avanzarAPasoCodigo(correo: string) {
    setStep("codigo");
    try {
      sessionStorage.setItem(CLAVE_PASO, JSON.stringify({ email: correo }));
    } catch {
      /* no crítico */
    }
  }

  function volverAPasoEmail() {
    setStep("email");
    setCodigo("");
    try {
      sessionStorage.removeItem(CLAVE_PASO);
    } catch {
      /* no crítico */
    }
  }

  async function onEnviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!aceptaTerminos) {
      setError("Debes aceptar la Política de Tratamiento de Datos para continuar.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await enviarCodigo(email, siguiente);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    avanzarAPasoCodigo(email);
  }

  async function onVerificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await verificarCodigo(email, codigo);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      sessionStorage.removeItem(CLAVE_PASO);
    } catch {
      /* no crítico */
    }
    // Primer login (sin teléfono todavía): un solo desvío a completar el perfil
    // antes de seguir a donde iba (02-UX/02_Onboarding.md).
    router.replace(res.faltaTelefono ? "/perfil?bienvenida=1" : siguiente);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16 sm:px-0">
        <h1 className="font-display mb-1.5 text-[28px] font-bold uppercase text-text">Bienvenido</h1>
        <p className="mb-8 text-sm text-text-muted">
          {step === "email"
            ? "Ingresa tu correo para reservar tu próxima cita."
            : `Te enviamos un código a ${email}.`}
        </p>

        {step === "email" ? (
          <form onSubmit={onEnviarCodigo} className="flex flex-col gap-5">
            <Input
              label="Correo electrónico"
              type="email"
              required
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-text-muted">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              Acepto los Términos y la{" "}
              <a href="/legal/politica-de-datos" className="text-accent underline underline-offset-2">
                Política de Tratamiento de Datos
              </a>{" "}
              de StylerNow.
            </label>

            {error ? <p className="text-xs text-danger">{error}</p> : null}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              ENVIAR CÓDIGO
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-text-faint">
              El inicio de sesión por WhatsApp/SMS llega en una fase posterior — por ahora
              usamos un código enviado a tu correo.
            </p>
          </form>
        ) : (
          <form onSubmit={onVerificarCodigo} className="flex flex-col gap-5">
            <Input
              label="Código de acceso"
              inputMode="numeric"
              maxLength={8}
              required
              placeholder="00000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="tracking-[0.4em]"
            />
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              CONFIRMAR
            </Button>
            <p className="text-center text-[11.5px] leading-relaxed text-text-faint">
              También podés entrar con un solo click desde el botón “Iniciar sesión” que
              te llegó en el mismo correo — no hace falta tipear el código.
            </p>
            <button
              type="button"
              onClick={volverAPasoEmail}
              className="text-center text-[12.5px] font-semibold text-accent"
            >
              Cambiar correo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

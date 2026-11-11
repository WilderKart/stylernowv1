"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Casilla } from "@/components/privacidad/casilla";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ErrorForm, Hot, PantallaAuth, Separador, claseEnlace } from "./_componentes/pantalla-auth";
import {
  crearContrasena,
  enviarCodigo,
  iniciarSesionConContrasena,
  iniciarSesionConGoogle,
  solicitarRecuperacion,
  verificarCodigo,
} from "./actions";
import { crearCuentaRegistro, necesitaRegistro } from "./registro-actions";

/**
 * Clave de sessionStorage para sobrevivir al paso "codigo" si el usuario cambia de
 * pestaña a revisar el correo y la vuelve a abrir, o la refresca sin querer — sin
 * esto, todo el estado vivía solo en memoria de React y un refresh lo mandaba de
 * nuevo a pedir el correo desde cero, incluso con la sesión de a medio camino.
 * Se limpia sola al confirmar o al tocar "Cambiar correo".
 */
const CLAVE_PASO = "stylernow_login_paso";

type Paso = "email" | "password" | "codigo" | "registro" | "crear-password" | "recovery-enviado";

type PostVerificacion = { faltaContrasena: boolean; faltaTelefono: boolean };

export function FormularioLogin({
  siguiente,
  registroPendiente,
  emailSesion,
}: {
  siguiente: string;
  /** Sesión ya activa pero sin registro completado (C17): abre directo el paso de registro. */
  registroPendiente?: boolean;
  emailSesion?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Paso>(registroPendiente ? "registro" : "email");
  const [email, setEmail] = useState(emailSesion ?? "");
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState("CO");
  const [marketing, setMarketing] = useState(false);
  const [post, setPost] = useState<PostVerificacion>({ faltaContrasena: false, faltaTelefono: false });
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendienteLegales, setPendienteLegales] = useState<{ id: string; tipo: string }[]>([]);
  const [, iniciarHidratacion] = useTransition();

  useEffect(() => {
    iniciarHidratacion(() => {
      if (registroPendiente) return;
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
  }, [iniciarHidratacion, registroPendiente]);

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
    setPassword("");
    setError(null);
    try {
      sessionStorage.removeItem(CLAVE_PASO);
    } catch {
      /* no crítico */
    }
  }

  function irADestinoFinal() {
    const destino = pendienteLegales.length > 0 ? `/legal/aceptar?next=${encodeURIComponent(siguiente)}` : siguiente;
    router.replace(destino);
    router.refresh();
  }

  async function onEnviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!aceptaTerminos) {
      setError("Debes aceptar la Política de Tratamiento de Datos para continuar.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await enviarCodigo(email, siguiente, aceptaTerminos);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    avanzarAPasoCodigo(email);
  }

  async function onIniciarConPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await iniciarSesionConContrasena(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    irADestinoFinal();
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
    setPendienteLegales(res.pendientesLegales);

    const siguientePaso: PostVerificacion = { faltaContrasena: res.faltaContrasena, faltaTelefono: res.faltaTelefono };
    setPost(siguientePaso);

    // C17: si es un usuario nuevo (perfil sin país), primero el paso de registro.
    const reg = await necesitaRegistro();
    if (reg.necesita) {
      setStep("registro");
      return;
    }
    continuarTrasVerificar(siguientePaso);
  }

  function continuarTrasVerificar(p: PostVerificacion) {
    // Auth_State_Machine.md: "OTP Verificado" exige "Crear contraseña" antes
    // de llegar a "Cuenta activa" — se pide una sola vez, la primera vez.
    if (p.faltaContrasena) {
      setStep("crear-password");
      return;
    }
    if (p.faltaTelefono) {
      router.replace("/perfil?bienvenida=1");
      router.refresh();
      return;
    }
    irADestinoFinal();
  }

  async function onCrearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await crearCuentaRegistro(nombre, pais, marketing);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Si llegó con sesión previa (sin pasar por el OTP), los pendientes salen de la sesión: se continúa al destino.
    continuarTrasVerificar(registroPendiente ? { faltaContrasena: false, faltaTelefono: false } : post);
  }

  async function onCrearContrasena(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await crearContrasena(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    irADestinoFinal();
  }

  async function onContinuarConGoogle() {
    setLoading(true);
    setError(null);
    const res = await iniciarSesionConGoogle(siguiente);
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }
    window.location.href = res.url;
  }

  async function onSolicitarRecuperacion() {
    if (!email) {
      setError("Ingresá tu correo primero.");
      return;
    }
    setLoading(true);
    setError(null);
    await solicitarRecuperacion(email);
    setLoading(false);
    setStep("recovery-enviado");
  }

  const titulos: Record<Paso, React.ReactNode> = {
    email: (
      <>
        Entra.
        <br />
        Reserva.
        <br />
        <Hot>Listo.</Hot>
      </>
    ),
    password: (
      <>
        Hola de
        <br />
        <Hot>nuevo.</Hot>
      </>
    ),
    codigo: (
      <>
        Revisa
        <br />
        tu <Hot>correo.</Hot>
      </>
    ),
    registro: (
      <>
        Crea tu
        <br />
        <Hot>cuenta.</Hot>
      </>
    ),
    "crear-password": (
      <>
        Crea tu
        <br />
        <Hot>contraseña.</Hot>
      </>
    ),
    "recovery-enviado": (
      <>
        Enlace
        <br />
        <Hot>enviado.</Hot>
      </>
    ),
  };
  const indices: Record<Paso, string> = {
    email: "04 / Ingreso",
    password: "04 / Ingreso",
    codigo: "05 / Verificación",
    registro: "06 / Registro",
    "crear-password": "07 / Contraseña",
    "recovery-enviado": "08 / Recuperar",
  };
  const intros: Record<Paso, string> = {
    email: "Ingresa tu correo para reservar tu próxima cita.",
    password: `Ingresá tu contraseña para ${email}.`,
    codigo: `Te enviamos un código a ${email}.`,
    registro: "Un minuto. Así el negocio sabe a quién espera.",
    "crear-password": "Ya verificamos tu correo — creá una contraseña para tu cuenta.",
    "recovery-enviado": `Si ${email} tiene una cuenta, te enviamos un enlace para recuperarla.`,
  };

  const botonGoogle = (
    <Button type="button" variant="secondary" size="lg" onClick={onContinuarConGoogle} className="w-full justify-between">
      <span className="flex items-center gap-3">
        {/* Logo "G" de Google en sus colores oficiales: da confianza y se reconoce al instante. */}
        <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continuar con Google
      </span>
      <ArrowUpRight className="size-[18px]" aria-hidden />
    </Button>
  );

  return (
    <PantallaAuth
      indice={indices[step]}
      volver={step === "email" ? "/onboarding" : undefined}
      onVolver={step === "email" ? undefined : volverAPasoEmail}
      titulo={titulos[step]}
      intro={intros[step]}
    >
      {step === "email" ? (
        <form onSubmit={onEnviarCodigo} className="flex flex-col gap-3">
          <Input
            label="Correo electrónico"
            type="email"
            required
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="flex cursor-pointer items-start gap-3 border-t-2 border-border py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="grid size-6 flex-none place-items-center border-2 border-border text-ink peer-checked:bg-signal [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
            >
              <Check className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="body-sm break-words">
                Acepto los{" "}
                <Link href="/legal/terminos" className="font-bold underline underline-offset-2">
                  Términos
                </Link>{" "}
                y la{" "}
                <Link href="/legal/politica-de-datos" className="font-bold underline underline-offset-2">
                  Política de Tratamiento de Datos
                </Link>{" "}
                de StylerNow.
              </span>
              <span className="sn-meta text-[var(--accent-text)]">Obligatoria</span>
            </span>
          </label>

          {error ? <ErrorForm>{error}</ErrorForm> : null}

          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>Enviar código</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("password");
            }}
            className={claseEnlace}
          >
            Ya tengo cuenta — entrar con contraseña ↗
          </button>

          <Separador>o</Separador>
          {botonGoogle}
        </form>
      ) : null}

      {step === "password" ? (
        <form onSubmit={onIniciarConPassword} className="flex flex-col gap-3">
          <Input
            label="Correo electrónico"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>Entrar</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
          <div className="flex flex-wrap justify-between gap-x-4">
            <button type="button" onClick={onSolicitarRecuperacion} className={claseEnlace}>
              No puedo entrar ↗
            </button>
            <button type="button" onClick={volverAPasoEmail} className={claseEnlace}>
              Usar código por correo ↗
            </button>
          </div>

          <Separador>o</Separador>
          {botonGoogle}
        </form>
      ) : null}

      {step === "codigo" ? (
        <form onSubmit={onVerificarCodigo} className="flex flex-col gap-3">
          <Input
            label="Código de acceso"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            minLength={6}
            required
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className="h-16 text-center font-display text-[32px] leading-none font-black tracking-[0.3em] [font-stretch:var(--stretch-condensed)]"
          />
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>Verificar</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
          <p className="p-note normal-case">
            También podés entrar con un solo click desde el botón “Iniciar sesión” que te llegó en el mismo correo — no hace falta tipear el código.
          </p>
          <button type="button" onClick={volverAPasoEmail} className={claseEnlace}>
            Cambiar correo ↗
          </button>
        </form>
      ) : null}

      {step === "registro" ? (
        <form onSubmit={onCrearCuenta} className="flex flex-col gap-3.5">
          <Input label="01 / Correo · Verificado" type="email" value={email} readOnly />
          <Input
            label="02 / Nombre y apellido"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Como quieres que te llamen"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="registro-pais" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
              03 / País
            </label>
            <div className="relative">
              <select
                id="registro-pais"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                className="min-h-12 w-full appearance-none border-2 border-border bg-bg py-0 pr-11 pl-3 text-[15px] text-text outline-none focus:shadow-hard"
              >
                <option value="CO">Colombia · CO</option>
                <option value="US">Estados Unidos · US</option>
                <option value="MX">México · MX</option>
                <option value="ES">España · ES</option>
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute top-3.5 right-3.5 size-5" />
            </div>
          </div>
          <Casilla
            caja
            checked={marketing}
            onChange={setMarketing}
            etiqueta="OPCIONAL"
            descripcion="Quiero recibir novedades y ofertas de StylerNow por correo. Me puedo dar de baja cuando quiera."
            className="mt-1"
          />
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <p className="body-sm text-text-muted">
            Al crear tu cuenta aceptas los{" "}
            <Link href="/legal/terminos" className="font-bold text-[var(--accent-text)] underline underline-offset-2">
              Términos
            </Link>{" "}
            y la{" "}
            <Link href="/legal/politica-de-datos" className="font-bold text-[var(--accent-text)] underline underline-offset-2">
              Política de privacidad
            </Link>
            .
          </p>
          <Button type="submit" size="lg" loading={loading} disabled={nombre.trim().length < 2} className="w-full justify-between">
            <span>Crear cuenta</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
        </form>
      ) : null}

      {step === "crear-password" ? (
        <form onSubmit={onCrearContrasena} className="flex flex-col gap-3">
          <Input
            label="Contraseña nueva"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="p-note normal-case">
            Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo. La vas a poder usar en vez del código por correo la próxima vez.
          </p>
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>Guardar y entrar</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
        </form>
      ) : null}

      {step === "recovery-enviado" ? (
        <button type="button" onClick={volverAPasoEmail} className={claseEnlace}>
          Volver ↗
        </button>
      ) : null}
    </PantallaAuth>
  );
}

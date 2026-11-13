"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/proveedor";
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
import { EJEMPLO_NACIONAL, INDICATIVO, type PaisRegistro } from "@/lib/telefono-registro";
import { cancelarRegistro, crearCuentaRegistro, necesitaRegistro } from "./registro-actions";

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
  const t = useT();
  const [step, setStep] = useState<Paso>(registroPendiente ? "registro" : "email");
  const [email, setEmail] = useState(emailSesion ?? "");
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState("CO");
  const [telefono, setTelefono] = useState("");
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

  /**
   * «Atrás» en «Crea tu cuenta»: la cuenta NO se crea. Se cierra la sesión que abrió el código
   * (el servidor solo lo hace si el registro sigue pendiente) y se vuelve al inicio del login.
   */
  async function cancelarRegistroYVolver() {
    setLoading(true);
    await cancelarRegistro();
    setLoading(false);
    setNombre("");
    setMarketing(false);
    setEmail("");
    volverAPasoEmail();
    router.replace("/login");
    router.refresh();
  }

  function irADestinoFinal() {
    const destino = pendienteLegales.length > 0 ? `/legal/aceptar?next=${encodeURIComponent(siguiente)}` : siguiente;
    router.replace(destino);
    router.refresh();
  }

  async function onEnviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!aceptaTerminos) {
      setError(t("login.err_terminos"));
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
    const res = await crearCuentaRegistro(nombre, pais, telefono, marketing);
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
      setError(t("login.err_correo_primero"));
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
        {t("login.t_email_1")}
        <br />
        {t("login.t_email_2")}
        <br />
        <Hot>{t("login.t_email_3")}</Hot>
      </>
    ),
    password: (
      <>
        {t("login.t_pw_1")}
        <br />
        <Hot>{t("login.t_pw_2")}</Hot>
      </>
    ),
    codigo: (
      <>
        {t("login.t_cod_1")}
        <br />
        {t("login.t_cod_tu")} <Hot>{t("login.t_cod_correo")}</Hot>
      </>
    ),
    registro: (
      <>
        {t("login.t_reg_1")}
        <br />
        <Hot>{t("login.t_reg_2")}</Hot>
      </>
    ),
    "crear-password": (
      <>
        {t("login.t_reg_1")}
        <br />
        <Hot>{t("login.t_cpw_2")}</Hot>
      </>
    ),
    "recovery-enviado": (
      <>
        {t("login.t_rec_1")}
        <br />
        <Hot>{t("login.t_rec_2")}</Hot>
      </>
    ),
  };
  const indices: Record<Paso, string> = {
    email: t("login.i_ingreso"),
    password: t("login.i_ingreso"),
    codigo: t("login.i_verificacion"),
    registro: t("login.i_registro"),
    "crear-password": t("login.i_password"),
    "recovery-enviado": t("login.i_recuperar"),
  };
  const intros: Record<Paso, string> = {
    email: t("login.intro_email"),
    password: email ? t("login.intro_pw_email", { email }) : t("login.intro_pw"),
    codigo: t("login.intro_codigo", { email }),
    registro: t("login.intro_registro"),
    "crear-password": t("login.intro_cpw"),
    "recovery-enviado": t("login.intro_recovery", { email }),
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
        {t("login.google")}
      </span>
      <ArrowUpRight className="size-[18px]" aria-hidden />
    </Button>
  );

  return (
    <PantallaAuth
      indice={indices[step]}
      volver={step === "email" ? "/onboarding" : undefined}
      onVolver={step === "email" ? undefined : step === "registro" ? cancelarRegistroYVolver : volverAPasoEmail}
      titulo={titulos[step]}
      intro={intros[step]}
    >
      {step === "email" ? (
        <form onSubmit={onEnviarCodigo} className="flex flex-col gap-3">
          <Input
            label={t("login.correo")}
            type="email"
            required
            placeholder={t("login.correo_ph")}
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
                {t("login.acepto_1")}{" "}
                <Link href="/legal/terminos" className="font-bold underline underline-offset-2">
                  {t("login.terminos")}
                </Link>{" "}
                {t("login.y_la")}{" "}
                <Link href="/legal/politica-de-datos" className="font-bold underline underline-offset-2">
                  {t("login.politica_datos")}
                </Link>{" "}
                {t("login.de_stylernow")}
              </span>
              <span className="sn-meta text-[var(--accent-text)]">{t("login.obligatoria")}</span>
            </span>
          </label>

          {error ? <ErrorForm>{error}</ErrorForm> : null}

          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>{t("login.enviar_codigo")}</span>
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
            {t("login.ya_tengo_cuenta")}
          </button>

          <Separador>{t("login.o")}</Separador>
          {botonGoogle}
        </form>
      ) : null}

      {step === "password" ? (
        <form onSubmit={onIniciarConPassword} className="flex flex-col gap-3">
          <Input
            label={t("login.correo")}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t("login.contrasena")}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>{t("login.entrar")}</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
          <div className="flex flex-wrap justify-between gap-x-4">
            <button type="button" onClick={onSolicitarRecuperacion} className={claseEnlace}>
              {t("login.no_puedo")}
            </button>
            <button type="button" onClick={volverAPasoEmail} className={claseEnlace}>
              {t("login.usar_codigo")}
            </button>
          </div>

          <Separador>{t("login.o")}</Separador>
          {botonGoogle}
        </form>
      ) : null}

      {step === "codigo" ? (
        <form onSubmit={onVerificarCodigo} className="flex flex-col gap-3">
          <Input
            label={t("login.codigo_acceso")}
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
            <span>{t("login.verificar")}</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
          <p className="p-note normal-case">
            {t("login.nota_click")}
          </p>
          <button type="button" onClick={volverAPasoEmail} className={claseEnlace}>
            {t("login.cambiar_correo")}
          </button>
        </form>
      ) : null}

      {step === "registro" ? (
        <form onSubmit={onCrearCuenta} className="flex flex-col gap-3.5">
          <Input label={t("login.reg_correo")} type="email" value={email} readOnly />
          <Input
            label={t("login.reg_nombre")}
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder={t("login.reg_nombre_ph")}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="registro-pais" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
              {t("login.reg_pais")}
            </label>
            <div className="relative">
              <select
                id="registro-pais"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                className="min-h-12 w-full appearance-none border-2 border-border bg-bg py-0 pr-11 pl-3 text-[15px] text-text outline-none focus:shadow-hard"
              >
                <option value="CO">{t("login.pais_co")}</option>
                <option value="US">{t("login.pais_us")}</option>
                <option value="MX">{t("login.pais_mx")}</option>
                <option value="ES">{t("login.pais_es")}</option>
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute top-3.5 right-3.5 size-5" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="registro-telefono" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] text-text uppercase">
              {t("login.reg_telefono")}
            </label>
            <div className="flex min-h-12 w-full border-2 border-border bg-bg focus-within:shadow-hard">
              <span className="flex items-center border-r-2 border-border px-3 font-mono text-[15px] text-text" aria-hidden>
                {INDICATIVO[pais as PaisRegistro] ?? ""}
              </span>
              <input
                id="registro-telefono"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                maxLength={20}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder={EJEMPLO_NACIONAL[pais as PaisRegistro] ?? ""}
                aria-describedby="registro-telefono-ayuda"
                className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-text outline-none"
              />
            </div>
            <p id="registro-telefono-ayuda" className="m-0 text-[12.5px] text-text-muted">
              {t("login.reg_telefono_ayuda")}
            </p>
          </div>
          <Casilla
            caja
            checked={marketing}
            onChange={setMarketing}
            etiqueta={t("login.opcional")}
            descripcion={t("login.marketing")}
            className="mt-1"
          />
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <p className="body-sm text-text-muted">
            {t("login.al_crear")}{" "}
            <Link href="/legal/terminos" className="font-bold text-[var(--accent-text)] underline underline-offset-2">
              {t("login.terminos")}
            </Link>{" "}
            {t("login.y_la")}{" "}
            <Link href="/legal/politica-de-datos" className="font-bold text-[var(--accent-text)] underline underline-offset-2">
              {t("login.politica_priv")}
            </Link>
            .
          </p>
          <Button type="submit" size="lg" loading={loading} disabled={nombre.trim().length < 2} className="w-full justify-between">
            <span>{t("login.crear_cuenta")}</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
        </form>
      ) : null}

      {step === "crear-password" ? (
        <form onSubmit={onCrearContrasena} className="flex flex-col gap-3">
          <Input
            label={t("login.contrasena_nueva")}
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="p-note normal-case">
            {t("login.nota_pw_larga")}
          </p>
          {error ? <ErrorForm>{error}</ErrorForm> : null}
          <Button type="submit" size="lg" loading={loading} className="w-full justify-between">
            <span>{t("login.guardar_entrar")}</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Button>
        </form>
      ) : null}

      {step === "recovery-enviado" ? (
        <button type="button" onClick={volverAPasoEmail} className={claseEnlace}>
          {t("login.volver_enlace")}
        </button>
      ) : null}
    </PantallaAuth>
  );
}

/**
 * Aviso sonoro del chat de soporte (solo navegador). Un tono corto cuando llega un mensaje del otro lado, para quien está en
 * otra pantalla del panel, en otra pestaña o con el teléfono en la mano.
 *
 * - Preferencia guardada en este dispositivo (localStorage): sonido activado por defecto, se puede silenciar desde el chat.
 * - Los navegadores bloquean el audio hasta que la persona toca la página una vez: `prepararAudio` lo «desbloquea» con el
 *   primer toque o tecla, y todo `play()` lleva catch silencioso para no ensuciar la consola.
 * - Una ráfaga de mensajes suena una sola vez (se agrupa en ventanas de ENTRE_AVISOS_MS (lo que dura el tono)).
 * - Con la pestaña oculta también se marca el título y, donde el dispositivo lo permite, vibra.
 * Limitación honesta: si el navegador está cerrado o la app suspendida por el sistema, el audio no puede sonar (eso exige
 * notificaciones push, que es otra función).
 */

const CLAVE = "sn_sonido_soporte";
const EVENTO = "sn-sonido-soporte";
const RUTA = "/sounds/soporte-mensaje.mp3";
const ENTRE_AVISOS_MS = 3500; // lo que dura el tono: un mensaje que llega mientras suena no lo reinicia

let audio: HTMLAudioElement | null = null;
let ultimoAviso = 0;
let preparado = false;

export function sonidoActivado(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "0";
  } catch {
    return true;
  }
}

export function fijarSonido(activado: boolean): void {
  try {
    localStorage.setItem(CLAVE, activado ? "1" : "0");
  } catch {
    /* sin almacenamiento (modo privado): la preferencia vale solo mientras la pestaña esté abierta */
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Para `useSyncExternalStore`: avisa cuando cambia la preferencia (en esta pestaña o en otra). */
export function suscribirSonido(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

function elemento(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(RUTA);
    audio.preload = "auto";
    audio.volume = 0.8;
  }
  return audio;
}

/** Desbloquea el audio con el primer toque, clic o tecla de la persona (política de reproducción automática). */
export function prepararAudio(): void {
  if (preparado || typeof document === "undefined") return;
  preparado = true;
  const eventos = ["pointerdown", "touchend", "keydown"] as const;
  const desbloquear = () => {
    eventos.forEach((e) => document.removeEventListener(e, desbloquear, true));
    const a = elemento();
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
      });
  };
  eventos.forEach((e) => document.addEventListener(e, desbloquear, true));
}

let tituloOriginal: string | null = null;
function marcarTitulo(): void {
  if (!document.hidden || tituloOriginal !== null) return;
  tituloOriginal = document.title;
  document.title = `● Nuevo mensaje · ${tituloOriginal}`;
  const restaurar = () => {
    if (document.hidden) return;
    if (tituloOriginal !== null) document.title = tituloOriginal;
    tituloOriginal = null;
    document.removeEventListener("visibilitychange", restaurar);
  };
  document.addEventListener("visibilitychange", restaurar);
}

/** Suena el aviso de mensaje nuevo (respeta el silencio y agrupa ráfagas). `forzar` es para la vista previa del botón. */
export function reproducirAviso(forzar = false): void {
  if (typeof window === "undefined") return;
  if (!forzar && !sonidoActivado()) return;
  const ahora = Date.now();
  if (!forzar && ahora - ultimoAviso < ENTRE_AVISOS_MS) return;
  ultimoAviso = ahora;
  try {
    const a = elemento();
    a.muted = false;
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* el navegador no permite reproducir todavía: se ignora en silencio */
  }
  if (forzar) return;
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    /* no todos los dispositivos vibran */
  }
  marcarTitulo();
}

import * as Sentry from "@sentry/nextjs";
import { opcionesBase } from "@/lib/sentry/comun";

/** Sentry en el runtime Edge (si alguna ruta lo usa). */
Sentry.init(opcionesBase());

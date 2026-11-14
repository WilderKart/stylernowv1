import * as Sentry from "@sentry/nextjs";
import { opcionesBase } from "@/lib/sentry/comun";

/** Sentry en el servidor (Node): Server Components, Route Handlers, Server Actions y el proxy. */
Sentry.init(opcionesBase());

import { ConfirmHost } from "@/components/ui/confirmar";
import { AnaliticaConsentida } from "@/components/privacidad/analitica";
import { BannerCookies } from "@/components/privacidad/banner-cookies";
import { IdiomaProvider } from "@/lib/i18n/proveedor";
import { obtenerIdioma } from "@/lib/i18n/servidor";
import { BloquearZoom } from "@/components/pwa/bloquear-zoom";
import { PwaManager } from "@/components/pwa/pwa-manager";
import { SistemaCliente } from "@/components/sistema";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata, Viewport } from "next";
import { Archivo, Cormorant_Garamond, Fraunces, Italiana, Jost, Sacramento, Space_Mono } from "next/font/google";
import { SincronizarTema } from "@/components/tema/tema-cliente";
import { obtenerModoTema, obtenerTemaEfectivo } from "@/lib/tema/servidor";
import { obtenerCategoriaAspecto } from "@/lib/tema/categoria-cookie";
import { verticalDeCategorias } from "@/lib/tema/vertical";
import "./globals.css";

// Archivo variable: eje de ancho (62–125 %) para títulos condensados y secciones
// expandidas; el eje de peso (400–900) queda completo al omitir `weight`.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

// Serif suave para los temas de spa, salón y uñas (solo se descarga cuando una página la usa).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// Tipografías delicadas de los temas spa (caligrafía), salón (serif fina) y uñas (sans elegante). Solo se descargan
// cuando una página las usa (preload apagado): barbería y tattoo no pagan nada por ellas.
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], display: "swap", preload: false });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], display: "swap", preload: false });
const sacramento = Sacramento({ variable: "--font-sacramento", subsets: ["latin"], weight: "400", display: "swap", preload: false });
const italiana = Italiana({ variable: "--font-italiana", subsets: ["latin"], weight: "400", display: "swap", preload: false });

export const metadata: Metadata = {
  title: {
    default: "StylerNow",
    template: "%s · StylerNow",
  },
  description:
    "El sistema operativo para negocios de citas de belleza, cuidado personal y bienestar en Colombia.",
  manifest: "/manifest.json",
  metadataBase: new URL((process.env.NEXT_PUBLIC_SITE_URL ?? "https://stylernowv1.vercel.app").replace(/\/$/, "")),
  openGraph: {
    type: "website",
    siteName: "StylerNow",
    title: "StylerNow",
    description: "Encuentra barberías, salones y spas cerca de ti y reserva tu turno en segundos.",
    locale: "es_CO",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "StylerNow" }],
  },
  twitter: { card: "summary", title: "StylerNow", images: ["/icons/icon-512.png"] },
  icons: { apple: "/icons/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StylerNow",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  // Comportamiento de app: sin zoom de página (el contenido nunca debe poder "abrirse" fuera de los bordes).
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const idioma = await obtenerIdioma();
  const tema = await obtenerTemaEfectivo();
  const modoTema = await obtenerModoTema();
  // Aspecto elegido (cookie decorativa validada en el servidor): spa, salón y uñas rediseñan toda la app.
  const vertical = verticalDeCategorias([(await obtenerCategoriaAspecto()) ?? ""]);
  return (
    <html
      lang={idioma}
      data-theme={tema}
      data-vertical={vertical ?? undefined}
      suppressHydrationWarning
      className={`${archivo.variable} ${spaceMono.variable} ${fraunces.variable} ${cormorant.variable} ${jost.variable} ${sacramento.variable} ${italiana.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-app text-text">
        <IdiomaProvider idioma={idioma}>{children}</IdiomaProvider>
        <ConfirmHost />
        <SincronizarTema modoInicial={modoTema} />
        <BloquearZoom />
        <PwaManager />
        <SistemaCliente />
        <Toaster />
        <BannerCookies />
        <AnaliticaConsentida />
      </body>
    </html>
  );
}

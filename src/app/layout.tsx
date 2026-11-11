import { PwaManager } from "@/components/pwa/pwa-manager";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata, Viewport } from "next";
import { Archivo, Space_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "StylerNow",
    template: "%s · StylerNow",
  },
  description:
    "El sistema operativo para negocios de citas de belleza, cuidado personal y bienestar en Colombia.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StylerNow",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${archivo.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        {children}
        <PwaManager />
        <Toaster />
      </body>
    </html>
  );
}

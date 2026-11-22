import { obtenerT } from "@/lib/i18n/servidor";
import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * «Tu cita también en tu celular»: QR con el enlace a esta misma reserva, para quien reservó desde
 * un computador. Solo se muestra en pantallas medianas o grandes (en el celular ya está en la app).
 *
 * Zero trust: el QR contiene SOLO la URL /reserva/{id}. Abrirla exige iniciar sesión, y la reserva
 * se lee con RLS (solo su cliente o su negocio la ven); el id no es una credencial.
 * Se genera en el servidor como imagen data: (la CSP ya permite img-src data:), sin innerHTML.
 */
export async function QrCita({ reservaId }: { reservaId: string }) {
  const t = await obtenerT();
  const h = await headers();
  const host = h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const url = `${proto}://${host}/reserva/${reservaId}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return (
    <div className="mx-4 mt-4 hidden items-center gap-5 border-2 border-border bg-app p-4 shadow-hard md:flex">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el servidor (data:), no optimizable */}
      <img src={src} alt={t("rv.qr_alt")} width={132} height={132} className="size-[132px] shrink-0 border-2 border-ink bg-paper" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="sn-num">{t("rv.qr_num")}</span>
        <p className="poster-5 break-words">{t("rv.qr_titulo")}</p>
        <p className="body-sm text-text-muted">{t("rv.qr_texto")}</p>
      </div>
    </div>
  );
}

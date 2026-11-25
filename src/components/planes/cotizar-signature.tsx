import { Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

/**
 * Cotización del plan Signature (cadenas y franquicias): tres vías con el mensaje ya escrito.
 * WhatsApp usa el número de ventas (o NEXT_PUBLIC_WHATSAPP_VENTAS si se define, solo dígitos con indicativo). El correo se abre en el programa de correo
 * del dispositivo (mailto:) con asunto y cuerpo listos.
 */
/** Número de ventas de StylerNow (+57 318 394 3465). NEXT_PUBLIC_WHATSAPP_VENTAS lo reemplaza si se define. */
const NUMERO_VENTAS = "573183943465";
const CORREO_VENTAS = "equipo@stylernow.com";
const MENSAJE = "Hola, quiero cotizar el plan Signature de StylerNow para mi cadena o franquicia. Mi negocio tiene ___ sedes y ___ profesionales.";

export function CotizarSignature({ negocio }: { negocio?: string }) {
  const numero = (process.env.NEXT_PUBLIC_WHATSAPP_VENTAS || NUMERO_VENTAS).replace(/\D/g, "");
  const texto = negocio ? `${MENSAJE} Negocio: ${negocio}.` : MENSAJE;
  const wa = numero.length >= 10 ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
  const correo = `mailto:${CORREO_VENTAS}?subject=${encodeURIComponent("Cotización plan Signature")}&body=${encodeURIComponent(texto)}`;
  const boton = "sn-card-btn inline-flex min-h-11 items-center gap-2 border-2 border-border bg-bg px-4 py-2 text-[13px] font-bold text-text no-underline hover:bg-surface";
  return (
    <section aria-labelledby="cotizar-signature" className="flex flex-col gap-3 border-2 border-border p-4">
      <div className="flex flex-col gap-1">
        <h3 id="cotizar-signature" className="font-display text-[15px] font-bold uppercase text-text">
          ¿Cadena o franquicia? Cotiza Signature
        </h3>
        <p className="text-[13px] leading-relaxed text-text-muted">Elige cómo prefieres hablar con ventas; el mensaje ya va escrito.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={boton}>
            <Phone className="!size-4" aria-hidden /> WhatsApp
          </a>
        ) : null}
        <a href={correo} className={boton}>
          <Mail className="!size-4" aria-hidden /> Correo
        </a>
        <Link href="/ayuda" className={boton}>
          <MessageCircle className="!size-4" aria-hidden /> Chat de soporte
        </Link>
      </div>
    </section>
  );
}

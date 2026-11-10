import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";
import { Num, Photo, Tier } from "./primitives";

/** Tarjeta numerada de negocio (patrón .sn-shop). `featured` = patrocinado/destacado. */
export function ShopCard({
  href,
  index,
  name,
  meta,
  price,
  photo,
  featured,
  badge,
  className,
}: {
  href: string;
  index?: number;
  name: string;
  meta?: React.ReactNode;
  price?: React.ReactNode;
  photo?: string | null;
  featured?: boolean;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("sn-shop text-text no-underline", featured && "is-featured", className)}>
      <div className="relative">
        <Photo src={photo} className="h-[190px]" />
        {badge ? <span className="p-spons">{badge}</span> : null}
      </div>
      <div className="sn-shop__body">
        {index != null ? <Num>{String(index).padStart(2, "0")}</Num> : <span />}
        <span className="sn-price justify-self-end">{price}</span>
        <h3 className="sn-shop__name poster-4 break-words">{name}</h3>
        {meta ? <div className="sn-shop__foot">{meta}</div> : null}
      </div>
    </Link>
  );
}

/** Tarjeta de profesional (patrón .sn-pro). */
export function ProCard({
  href,
  name,
  role,
  tier,
  photo,
  right,
}: {
  href?: string;
  name: string;
  role?: string;
  tier?: "pro" | "expert" | "master";
  photo?: string | null;
  right?: React.ReactNode;
}) {
  const body = (
    <>
      <Photo src={photo} />
      <div className="sn-pro__info">
        <h3 className="sn-pro__name poster-5 break-words">{name}</h3>
        {role ? <span className="sn-meta">{role}</span> : null}
        <div className="sn-pro__foot">
          {tier ? <Tier level={tier} /> : <span />}
          {right}
        </div>
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="sn-pro text-text no-underline">
      {body}
    </Link>
  ) : (
    <div className="sn-pro">{body}</div>
  );
}

/** Cita tipo ticket (patrón .sn-ticket). */
export function Ticket({
  day,
  month,
  title,
  lines,
  footer,
  className,
}: {
  day: string;
  month: string;
  title: React.ReactNode;
  lines?: React.ReactNode[];
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("sn-ticket", className)}>
      <div className="sn-ticket__top">
        <div className="sn-ticket__date">
          <b>{day}</b>
          <span className="sn-meta">{month}</span>
        </div>
        <div className="sn-ticket__main">
          <h3 className="poster-5 break-words">{title}</h3>
          {lines?.map((l, i) => (
            <span key={i} className="sn-meta">
              {l}
            </span>
          ))}
        </div>
      </div>
      {footer ? (
        <>
          <div className="sn-ticket__perf" />
          <div className="sn-ticket__foot">{footer}</div>
        </>
      ) : null}
    </article>
  );
}

/** Estado vacío tipográfico (patrón .sn-empty). */
export function EmptyState({
  big,
  title,
  hint,
  action,
  className,
}: {
  big: string;
  title?: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sn-empty", className)}>
      <span className="sn-empty__big poster-2 break-words !whitespace-normal">{big}</span>
      {title ? <h3 className="section">{title}</h3> : null}
      {hint ? <p className="sn-meta">{hint}</p> : null}
      {action}
    </div>
  );
}

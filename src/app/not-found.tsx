import { Num, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { obtenerT } from "@/lib/i18n/servidor";

export default async function NotFound() {
  const t = await obtenerT();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 p-4">
        <Num>{t("nf.codigo")}</Num>
        <Poster as="h1" size={2} className="break-words">
          {t("nf.1")}
          <br />
          <span className="sn-hot">{t("nf.2")}</span>
        </Poster>
        <p className="body text-text-muted">
          {t("nf.txt")}
        </p>
        <Button asChild variant="secondary" size="lg" className="w-full justify-between">
          <Link href="/">
            <span>{t("err.volver_inicio")}</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Link>
        </Button>
      </main>
    </div>
  );
}

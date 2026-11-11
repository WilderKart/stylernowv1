"use client";

import { Meta, Num, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function ErrorMarca({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[panel/marca]", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-5 py-10">
      <Num>00 / Error</Num>
      <Poster as="h1" size={3} className="break-words">
        No pudimos cargar Mi Marca
      </Poster>
      <Meta>Intenta de nuevo en unos segundos.</Meta>
      <Button onClick={reset} className="self-start">
        Reintentar
      </Button>
    </main>
  );
}

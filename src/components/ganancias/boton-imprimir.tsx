"use client";

import { Button } from "@/components/ui/button";

export function BotonImprimir() {
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => window.print()} className="print:hidden">
      Imprimir o guardar PDF
    </Button>
  );
}

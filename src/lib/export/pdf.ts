import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";

/**
 * Generador de PDF real y reutilizable (ADR-014, Fase D) — branding,
 * filtros, tabla paginada, numeración y QR de verificación, para
 * cualquier módulo que necesite un reporte descargable.
 */
export interface ColumnaPdf {
  header: string;
  key: string;
  width: number; // puntos, dentro del ancho útil de la página
  alineacion?: "izquierda" | "derecha";
}

export interface ReportePdfInput {
  titulo: string;
  negocioNombre: string;
  filtros?: string[]; // ej. ["Período: 01/09/2026 - 30/09/2026", "Sede: Principal"]
  columnas: ColumnaPdf[];
  filas: Record<string, string | number>[];
}

const MARGEN = 40;
const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const ALTO_FILA = 18;

export async function generarReportePdf(input: ReportePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const numeroReporte = randomUUID().slice(0, 8).toUpperCase();
  const generadoEn = new Date();
  const codigoVerificacion = `STYLERNOW-REPORTE-${numeroReporte}-${generadoEn.toISOString()}`;
  const qrPngDataUrl = await QRCode.toDataURL(codigoVerificacion, { margin: 1, width: 120 });
  const qrPngBytes = Buffer.from(qrPngDataUrl.split(",")[1], "base64");
  const qrImage = await doc.embedPng(qrPngBytes);

  let page = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - MARGEN;
  let numeroPagina = 1;
  const totalFilasEstimadas = input.filas.length;

  function dibujarEncabezado(paginaActual: typeof page) {
    paginaActual.drawText("STYLERNOW", { x: MARGEN, y: y, size: 16, font: fontBold, color: rgb(0.66, 0.38, 0.1) });
    y -= 20;
    paginaActual.drawText(input.titulo, { x: MARGEN, y, size: 13, font: fontBold, color: rgb(0.12, 0.1, 0.09) });
    y -= 16;
    paginaActual.drawText(input.negocioNombre, { x: MARGEN, y, size: 10, font: fontRegular, color: rgb(0.35, 0.32, 0.29) });
    y -= 14;
    for (const filtro of input.filtros ?? []) {
      paginaActual.drawText(filtro, { x: MARGEN, y, size: 9, font: fontRegular, color: rgb(0.5, 0.47, 0.43) });
      y -= 12;
    }
    y -= 8;
    // Encabezado de la tabla
    let x = MARGEN;
    for (const col of input.columnas) {
      paginaActual.drawText(col.header, { x, y, size: 9, font: fontBold, color: rgb(0.12, 0.1, 0.09) });
      x += col.width;
    }
    y -= 4;
    paginaActual.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO_PAGINA - MARGEN, y }, thickness: 0.5, color: rgb(0.8, 0.78, 0.75) });
    y -= ALTO_FILA;
  }

  function dibujarPie(paginaActual: typeof page, pagina: number) {
    paginaActual.drawImage(qrImage, { x: ANCHO_PAGINA - MARGEN - 40, y: MARGEN - 5, width: 40, height: 40 });
    paginaActual.drawText(`Reporte N.º ${numeroReporte} · Generado ${generadoEn.toLocaleString("es-CO")}`, {
      x: MARGEN, y: MARGEN + 10, size: 7.5, font: fontRegular, color: rgb(0.55, 0.52, 0.48),
    });
    paginaActual.drawText(`Página ${pagina}`, { x: MARGEN, y: MARGEN - 5, size: 7.5, font: fontRegular, color: rgb(0.55, 0.52, 0.48) });
    paginaActual.drawText(`Verificación: ${codigoVerificacion.slice(0, 40)}...`, {
      x: MARGEN, y: MARGEN + 20, size: 6.5, font: fontRegular, color: rgb(0.6, 0.58, 0.55),
    });
  }

  dibujarEncabezado(page);

  for (const fila of input.filas) {
    if (y < MARGEN + 60) {
      dibujarPie(page, numeroPagina);
      page = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
      y = ALTO_PAGINA - MARGEN;
      numeroPagina += 1;
      dibujarEncabezado(page);
    }
    let x = MARGEN;
    for (const col of input.columnas) {
      const valor = String(fila[col.key] ?? "");
      const anchoTexto = fontRegular.widthOfTextAtSize(valor, 9);
      const xAjustado = col.alineacion === "derecha" ? x + col.width - anchoTexto - 4 : x;
      page.drawText(valor, { x: xAjustado, y, size: 9, font: fontRegular, color: rgb(0.2, 0.18, 0.16) });
      x += col.width;
    }
    y -= ALTO_FILA;
  }

  if (totalFilasEstimadas === 0) {
    page.drawText("Sin datos para el período/filtro seleccionado.", { x: MARGEN, y, size: 9, font: fontRegular, color: rgb(0.5, 0.47, 0.43) });
  }

  dibujarPie(page, numeroPagina);

  return doc.save();
}

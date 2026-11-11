import "server-only";
import ExcelJS from "exceljs";

/**
 * Generador de Excel real y reutilizable (ADR-014, Fase D) — cualquier
 * módulo (Reportes, CRM, Inventario, Staff, Lealtad, IA...) arma sus
 * hojas con esta única función en vez de reimplementar exceljs cada vez.
 */
export interface ColumnaExcel {
  header: string;
  key: string;
  width?: number;
  formato?: "moneda" | "fecha" | "texto";
}

export interface HojaExcel {
  nombre: string;
  columnas: ColumnaExcel[];
  filas: Record<string, unknown>[];
}

export async function generarExcel(hojas: HojaExcel[], titulo = "StylerNow"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StylerNow";
  workbook.created = new Date();
  workbook.title = titulo;

  for (const hoja of hojas) {
    const worksheet = workbook.addWorksheet(hoja.nombre.slice(0, 31)); // Excel limita el nombre de hoja a 31 caracteres.
    worksheet.columns = hoja.columnas.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEAE2" } };

    for (const fila of hoja.filas) {
      const row = worksheet.addRow(fila);
      hoja.columnas.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.formato === "moneda") cell.numFmt = '"$"#,##0';
        if (c.formato === "fecha") cell.numFmt = "yyyy-mm-dd";
      });
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

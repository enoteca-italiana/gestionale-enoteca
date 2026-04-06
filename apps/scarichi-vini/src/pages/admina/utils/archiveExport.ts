import type { Wine } from '@/domain/types';

function buildExportFileBaseName() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('it-IT', { day: 'numeric' }).format(now);
  const monthRaw = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(now);
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  const year = new Intl.DateTimeFormat('it-IT', { year: 'numeric' }).format(now);
  return `archivio_vini_${day} ${month} ${year}`;
}

export async function exportArchiveExcel(wines: Wine[]): Promise<void> {
  const headers = [
    'Categoria',
    'Nome',
    'Anno',
    'Produttore',
    'Provenienza',
    'Soglia',
    'Acquisto',
    'Vendita',
    'Quantita',
    'Note'
  ] as const;
  const widthRules: Record<(typeof headers)[number], { min: number; max: number }> = {
    Categoria: { min: 15, max: 24 },
    Nome: { min: 18, max: 38 },
    Anno: { min: 10, max: 12 },
    Produttore: { min: 16, max: 34 },
    Provenienza: { min: 16, max: 32 },
    Soglia: { min: 10, max: 12 },
    Acquisto: { min: 12, max: 16 },
    Vendita: { min: 12, max: 16 },
    Quantita: { min: 12, max: 14 },
    Note: { min: 20, max: 52 }
  };
  const { Workbook } = await import('exceljs');

  const rows = wines.map((wine) => ({
    Categoria: wine.category ?? '',
    Nome: wine.name,
    Anno: wine.age ?? '',
    Produttore: wine.producer,
    Provenienza: wine.origin,
    Soglia: wine.threshold ?? '',
    Acquisto: wine.purchasePrice ?? '',
    Vendita: wine.salePrice ?? '',
    Quantita: wine.qty,
    Note: wine.notes ?? ''
  }));
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Archivio', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: widthRules[header].min
  }));

  rows.forEach((row) => {
    worksheet.addRow({
      ...row,
      Soglia: typeof row.Soglia === 'number' ? row.Soglia : undefined,
      Acquisto: typeof row.Acquisto === 'number' ? row.Acquisto : undefined,
      Vendita: typeof row.Vendita === 'number' ? row.Vendita : undefined,
      Quantita: row.Quantita
    });
  });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  };

  worksheet.columns.forEach((column, idx) => {
    const header = headers[idx];
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? '').replace(/\s+/g, ' ').length)
    );
    const { min, max } = widthRules[header];
    column.width = Math.min(max, Math.max(min, maxLength + 4));
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 40;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF4B5563' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF3EA' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const isOdd = rowNumber % 2 === 1;
    const rowFill = isOdd ? 'FFFFFFFF' : 'FFF6F7F9';

    row.height = 18;
    row.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
      cell.font = { color: { argb: 'FF1F2937' }, size: 11 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };

      if (colNumber === headers.indexOf('Nome') + 1) {
        cell.font = { ...cell.font, bold: true };
      }

      const isNumberCol = ['Soglia', 'Acquisto', 'Vendita', 'Quantita'].includes(
        headers[colNumber - 1]
      );
      if (isNumberCol) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    const qtyCell = row.getCell(headers.indexOf('Quantita') + 1);
    const thresholdCell = row.getCell(headers.indexOf('Soglia') + 1);
    const qty = Number(qtyCell.value ?? 0);
    const threshold = Number(thresholdCell.value ?? 0);

    if (Number.isFinite(qty)) {
      if (qty <= 0) {
        qtyCell.font = { ...(qtyCell.font ?? {}), color: { argb: 'FFFF0000' }, bold: false };
      } else if (Number.isFinite(threshold) && threshold > 0 && qty <= threshold) {
        qtyCell.font = { ...(qtyCell.font ?? {}), color: { argb: 'FFCA8A04' }, bold: false };
      }
    }

    const thresholdNumCell = row.getCell(headers.indexOf('Soglia') + 1);
    const purchaseNumCell = row.getCell(headers.indexOf('Acquisto') + 1);
    const saleNumCell = row.getCell(headers.indexOf('Vendita') + 1);
    thresholdNumCell.numFmt = '0';
    purchaseNumCell.numFmt = '#,##0.00';
    saleNumCell.numFmt = '#,##0.00';
    qtyCell.numFmt = '0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${buildExportFileBaseName()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportArchivePdf(wines: Wine[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const formatMoney = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? `${value.toFixed(2).replace('.', ',')} €`
      : '—';

  const loadLogoDataUrl = async (): Promise<{
    dataUrl: string;
    width: number;
    height: number;
  } | null> => {
    try {
      const response = await fetch('/logo.png');
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('logo read failed'));
        reader.readAsDataURL(blob);
      });
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
        img.onerror = () => reject(new Error('logo size read failed'));
        img.src = dataUrl;
      });
      return { dataUrl, ...dimensions };
    } catch {
      return null;
    }
  };

  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = 72 + 108 + 96 + 96 + 36 + 64 + 64;
  const marginX = Math.max(16, Math.floor((pageWidth - tableWidth) / 2));
  const topY = 58;

  const body = wines.map((wine) => [
    wine.category?.trim() || '—',
    wine.name,
    wine.producer,
    wine.origin,
    String(wine.qty),
    formatMoney(wine.purchasePrice),
    formatMoney(wine.salePrice)
  ]);

  autoTable(doc, {
    head: [['Categoria', 'Nome', 'Produttore', 'Provenienza', 'Q.tà', 'Acquisto', 'Vendita']],
    body,
    startY: topY,
    margin: { top: topY, left: marginX, right: marginX, bottom: 20 },
    styles: {
      fontSize: 9,
      textColor: [31, 41, 55],
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
      overflow: 'ellipsize'
    },
    headStyles: {
      fillColor: [237, 243, 234],
      textColor: [75, 85, 99],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9
    },
    alternateRowStyles: {
      fillColor: [246, 247, 249]
    },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 108 },
      2: { cellWidth: 96 },
      3: { cellWidth: 96 },
      4: { halign: 'right', cellWidth: 36 },
      5: { halign: 'right', cellWidth: 64 },
      6: { halign: 'right', cellWidth: 64 }
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 4) return;
      const wine = wines[data.row.index];
      if (!wine) return;
      const qty = Math.max(0, Math.round(wine.qty));
      const threshold = typeof wine.threshold === 'number' ? wine.threshold : 0;
      if (qty <= 0) {
        data.cell.styles.textColor = [255, 0, 0];
      } else if (threshold > 0 && qty <= threshold) {
        data.cell.styles.textColor = [202, 138, 4];
      }
    },
    didDrawPage: () => {
      if (logoDataUrl) {
        const maxWidth = 190;
        const maxHeight = 30;
        const ratio = logoDataUrl.width / logoDataUrl.height;
        let logoWidth = maxWidth;
        let logoHeight = logoWidth / ratio;
        if (logoHeight > maxHeight) {
          logoHeight = maxHeight;
          logoWidth = logoHeight * ratio;
        }
        doc.addImage(logoDataUrl.dataUrl, 'PNG', (pageWidth - logoWidth) / 2, 14, logoWidth, logoHeight);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(124, 22, 74);
        doc.setFontSize(20);
        doc.text('Enoteca Italiana', pageWidth / 2, 40, { align: 'center' });
      }
    }
  });

  doc.save(`${buildExportFileBaseName()}.pdf`);
}

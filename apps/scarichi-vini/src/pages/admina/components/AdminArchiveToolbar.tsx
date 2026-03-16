import type { Wine } from '@/domain/types';
import type { Filters, StockFilter } from '@/pages/admina/types';
import { RefreshCcw } from 'lucide-react';

type Props = {
  winesCount: number;
  thresholdCount: number;
  outCount: number;
  wines: Wine[];
  filters: Filters;
  categories: string[];
  producers: string[];
  origins: string[];
  suppliers: string[];
  onFiltersChange: (next: Filters) => void;
  onRequestAddCategory: (onResult: (created: string | null) => void) => void;
  onRequestAddProducer: (onResult: (created: string | null) => void) => void;
  onRequestAddOrigin: (onResult: (created: string | null) => void) => void;
  onRequestAddSupplier: (onResult: (created: string | null) => void) => void;
  onResetFilters: () => void;
  onOpenCreate: () => void;
  onOpenAi: () => void;
  noteReady: boolean;
  onOpenDischargeNote: () => void;
};

export function AdminArchiveToolbar({
  winesCount,
  thresholdCount,
  outCount,
  wines,
  filters,
  categories,
  producers,
  origins,
  suppliers,
  onFiltersChange,
  onRequestAddCategory,
  onRequestAddProducer,
  onRequestAddOrigin,
  onRequestAddSupplier,
  onResetFilters,
  onOpenCreate,
  onOpenAi,
  noteReady,
  onOpenDischargeNote
}: Props) {
  const setStockFilter = (stock: StockFilter) => onFiltersChange({ ...filters, stock });

  const buildExportFileBaseName = () => {
    const now = new Date();
    const day = new Intl.DateTimeFormat('it-IT', { day: 'numeric' }).format(now);
    const monthRaw = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(now);
    const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
    const year = new Intl.DateTimeFormat('it-IT', { year: 'numeric' }).format(now);
    return `archivio_vini_${day} ${month} ${year}`;
  };

  const exportExcel = async () => {
    const headers = [
      'Categoria',
      'Nome',
      'Anno',
      'Produttore',
      'Provenienza',
      'Fornitore',
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
      Fornitore: { min: 14, max: 34 },
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
      Fornitore: wine.supplier ?? '',
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
      // Add extra spacing so Excel filter icon never overlaps header text.
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
  };

  const exportPdf = async () => {
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
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve, reject) => {
            const img = new Image();
            img.onload = () =>
              resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
            img.onerror = () => reject(new Error('logo size read failed'));
            img.src = dataUrl;
          }
        );
        return { dataUrl, ...dimensions };
      } catch {
        return null;
      }
    };

    const logoDataUrl = await loadLogoDataUrl();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const dateLabel = new Date().toLocaleDateString('it-IT');
    const marginX = 24;
    const topY = 58;

    const body = wines.map((wine) => [
      wine.category?.trim() || '—',
      wine.name,
      wine.producer,
      wine.origin,
      wine.supplier?.trim() || '—',
      String(wine.qty),
      formatMoney(wine.purchasePrice),
      formatMoney(wine.salePrice)
    ]);

    autoTable(doc, {
      head: [
        [
          'Categoria',
          'Nome',
          'Produttore',
          'Provenienza',
          'Fornitore',
          'Q.tà',
          'Acquisto',
          'Vendita'
        ]
      ],
      body,
      startY: topY,
      margin: { top: topY, left: marginX, right: marginX, bottom: 30 },
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
        0: { cellWidth: 88 },
        1: { cellWidth: 118 },
        2: { cellWidth: 120 },
        3: { cellWidth: 110 },
        4: { cellWidth: 120 },
        5: { halign: 'right', cellWidth: 38 },
        6: { halign: 'right', cellWidth: 70 },
        7: { halign: 'right', cellWidth: 70 }
      },
      didParseCell(data) {
        if (data.section !== 'body' || data.column.index !== 5) return;
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
          doc.addImage(
            logoDataUrl.dataUrl,
            'PNG',
            (pageWidth - logoWidth) / 2,
            14,
            logoWidth,
            logoHeight
          );
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(124, 22, 74);
          doc.setFontSize(20);
          doc.text('Enoteca Italiana', pageWidth / 2, 40, { align: 'center' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(9);
        doc.text(`Data export: ${dateLabel}`, pageWidth - marginX, 52, { align: 'right' });
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(8);
      doc.text(
        `Enoteca Italiana · Export Archivio · ${page}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
    }

    doc.save(`${buildExportFileBaseName()}.pdf`);
  };

  return (
    <section className="archiveTopBar">
      <div className="archiveExportDock" aria-label="Esporta archivio">
        <button
          className="archiveExportButton archiveExportButtonIconOnly"
          type="button"
          onClick={() => void exportExcel()}
          aria-label="Esporta archivio in Excel"
          title="Esporta Excel"
        >
          <img
            className="archiveExportIconImage"
            src="/icons8-esportare-excel-48.png"
            alt=""
            aria-hidden="true"
          />
        </button>
        <button
          className="archiveExportButton archiveExportButtonIconOnly"
          type="button"
          onClick={() => void exportPdf()}
          aria-label="Esporta archivio in PDF"
          title="Esporta PDF"
        >
          <img
            className="archiveExportIconImage"
            src="/icons8-esporta-in-formato-pdf-60.png"
            alt=""
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="archiveFilters">
        <button
          className={`archiveNoteButton ${noteReady ? 'archiveNoteButtonReady' : ''}`}
          type="button"
          aria-label="Apri nota scarico"
          title="Nota scarico"
          onClick={onOpenDischargeNote}
        >
          Nota
        </button>

        <input
          className="input archiveFilterControl"
          placeholder="Cerca vino..."
          value={filters.term}
          onChange={(e) => onFiltersChange({ ...filters, term: e.target.value })}
        />

        <div className="archiveFilterGroup" role="group" aria-label="Filtri archivio">
          <div className="archiveFilterField">
            <div className="archiveFilterFieldLabel">Categoria</div>
            <select
              className={`input archiveFilterControl archiveFilterSelect ${
                filters.category !== 'all' ? 'archiveFilterSelectActive' : ''
              }`}
              aria-label="Filtro categoria"
              value={filters.category}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__add_category__') {
                  onRequestAddCategory((created) => {
                    if (!created) return;
                    onFiltersChange({ ...filters, category: created });
                  });
                  return;
                }
                onFiltersChange({ ...filters, category: value });
              }}
            >
              <option value="__add_category__">+ Aggiungi categoria…</option>
              <option value="all">Tutte</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="archiveFilterField">
            <div className="archiveFilterFieldLabel">Produttore</div>
            <select
              className={`input archiveFilterControl archiveFilterSelect ${
                filters.producer !== 'all' ? 'archiveFilterSelectActive' : ''
              }`}
              aria-label="Filtro produttore"
              value={filters.producer}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__add_producer__') {
                  onRequestAddProducer((created) => {
                    if (!created) return;
                    onFiltersChange({ ...filters, producer: created });
                  });
                  return;
                }
                onFiltersChange({ ...filters, producer: value });
              }}
            >
              <option value="__add_producer__">+ Aggiungi produttore…</option>
              <option value="all">Tutti</option>
              {producers.map((producer) => (
                <option key={producer} value={producer}>
                  {producer}
                </option>
              ))}
            </select>
          </div>

          <div className="archiveFilterField">
            <div className="archiveFilterFieldLabel">Provenienza</div>
            <select
              className={`input archiveFilterControl archiveFilterSelect ${
                filters.origin !== 'all' ? 'archiveFilterSelectActive' : ''
              }`}
              aria-label="Filtro provenienza"
              value={filters.origin}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__add_origin__') {
                  onRequestAddOrigin((created) => {
                    if (!created) return;
                    onFiltersChange({ ...filters, origin: created });
                  });
                  return;
                }
                onFiltersChange({ ...filters, origin: value });
              }}
            >
              <option value="__add_origin__">+ Aggiungi provenienza…</option>
              <option value="all">Tutte</option>
              {origins.map((origin) => (
                <option key={origin} value={origin}>
                  {origin}
                </option>
              ))}
            </select>
          </div>

          <div className="archiveFilterField">
            <div className="archiveFilterFieldLabel">Fornitore</div>
            <select
              className={`input archiveFilterControl archiveFilterSelect ${
                filters.supplier !== 'all' ? 'archiveFilterSelectActive' : ''
              }`}
              aria-label="Filtro fornitore"
              value={filters.supplier}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__add_supplier__') {
                  onRequestAddSupplier((created) => {
                    if (!created) return;
                    onFiltersChange({ ...filters, supplier: created });
                  });
                  return;
                }
                onFiltersChange({ ...filters, supplier: value });
              }}
            >
              <option value="__add_supplier__">+ Aggiungi fornitore…</option>
              <option value="all">Tutti</option>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="archiveStatsBox" aria-label="Riepilogo vini">
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemTotal ${
              filters.stock === 'all' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('all')}
            aria-pressed={filters.stock === 'all' ? 'true' : 'false'}
          >
            <div className="archiveStatLabel">Totale</div>
            <div className="archiveStatValue">{winesCount}</div>
          </button>
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemThreshold ${
              filters.stock === 'threshold' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('threshold')}
            aria-pressed={filters.stock === 'threshold' ? 'true' : 'false'}
          >
            <div className="archiveStatLabel">Soglia</div>
            <div className="archiveStatValue">{thresholdCount}</div>
          </button>
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemOut ${
              filters.stock === 'out' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('out')}
            aria-pressed={filters.stock === 'out' ? 'true' : 'false'}
          >
            <div className="archiveStatLabel">Esauriti</div>
            <div className="archiveStatValue">{outCount}</div>
          </button>
        </div>

        <button
          className="archiveResetButton"
          type="button"
          aria-label="Reset filtri"
          title="Reset filtri"
          onClick={onResetFilters}
        >
          <RefreshCcw size={18} strokeWidth={2.2} />
        </button>

        <button className="button buttonAuto archiveAddButton" type="button" onClick={onOpenCreate}>
          Aggiungi vino
        </button>

        <button
          className="archiveAiButton"
          type="button"
          aria-label="Apri assistente AI"
          title="AI"
          onClick={onOpenAi}
        >
          <img className="archiveAiButtonIcon" src="/icons%20ai.png" alt="" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { formatDate, formatCurrency } from './formatters';

/**
 * Export data as CSV file.
 * @param {Array<Object>} data - Array of objects to export
 * @param {Array<{key: string, label: string, format?: Function}>} columns - Column definitions
 * @param {string} filename - File name without extension
 */
export function exportToCSV(data, columns, filename = 'export') {
  const headers = columns.map((c) => c.label);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      if (col.format) return col.format(value, row);
      return value ?? '';
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str}"`
          : str;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export data as Excel file.
 * @param {Array<Object>} data - Array of objects to export
 * @param {Array<{key: string, label: string, format?: Function}>} columns - Column definitions
 * @param {string} filename - File name without extension
 * @param {string} sheetName - Excel sheet name
 */
export function exportToExcel(data, columns, filename = 'export', sheetName = 'Data') {
  const headers = columns.map((c) => c.label);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      if (col.format) return col.format(value, row);
      return value ?? '';
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-fit column widths
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export an HTML element as PDF.
 * @param {HTMLElement} element - DOM element to capture
 * @param {string} filename - File name without extension
 * @param {Object} options - PDF options
 */
export async function exportToPDF(element, filename = 'export', options = {}) {
  const { orientation = 'portrait', format = 'a4' } = options;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF(orientation, 'mm', format);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20; // 10mm margin each side
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10;

  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - 20;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;
  }

  pdf.save(`${filename}.pdf`);
}

/**
 * Export table data as PDF (data-based, not screenshot).
 */
export function exportTableToPDF(data, columns, filename = 'export', title = '') {
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Title
  if (title) {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, 14, 20);
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
  }

  const startY = title ? 32 : 14;
  const colWidth = (pageWidth - 28) / columns.length;
  const rowHeight = 8;

  // Headers
  pdf.setFillColor(15, 118, 110);
  pdf.rect(14, startY, pageWidth - 28, rowHeight, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont(undefined, 'bold');
  columns.forEach((col, i) => {
    pdf.text(col.label, 15 + i * colWidth, startY + 5.5);
  });

  // Rows
  pdf.setTextColor(51, 65, 85);
  pdf.setFont(undefined, 'normal');
  let y = startY + rowHeight;

  data.forEach((row, rowIdx) => {
    if (y > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage();
      y = 14;
    }

    if (rowIdx % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(14, y, pageWidth - 28, rowHeight, 'F');
    }

    columns.forEach((col, i) => {
      const value = col.format ? col.format(row[col.key], row) : String(row[col.key] ?? '');
      const truncated = value.length > 30 ? value.substring(0, 27) + '...' : value;
      pdf.text(truncated, 15 + i * colWidth, y + 5.5);
    });

    y += rowHeight;
  });

  pdf.save(`${filename}.pdf`);
}

/**
 * Print an HTML element.
 */
export function printElement(element) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; padding: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${element.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
}

// Internal helper
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

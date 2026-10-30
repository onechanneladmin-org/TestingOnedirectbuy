'use strict';

const ExcelJS = require('exceljs');

const URL_RE = /^https?:\/\//i;

// Writes one sheet: bold frozen header, auto-filter, wrapped text, URL cells as hyperlinks.
function addSheet(wb, name, rows, columns) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  const keys = columns || (rows[0] ? Object.keys(rows[0]) : ['(no rows)']);
  ws.columns = keys.map((k) => ({
    header: k,
    key: k,
    width: /description|specification|feature|documents|instructions|notes|error|other|part numbers|reasons|title/i.test(k) ? 60 : /url|image/i.test(k) ? 50 : Math.min(Math.max(k.length + 4, 14), 30),
  }));
  for (const r of rows) ws.addRow(keys.map((k) => (r[k] == null ? '' : r[k])));

  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' };
      if (rowNumber === 1) return;
      const v = cell.value;
      // Only a cell holding exactly one URL becomes a hyperlink; multi-line lists stay text.
      if (typeof v === 'string' && URL_RE.test(v) && !/\s/.test(v)) {
        cell.value = { text: v, hyperlink: v };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      }
      // Excel caps a cell at 32,767 characters.
      if (typeof cell.value === 'string' && cell.value.length > 32000) cell.value = `${cell.value.slice(0, 32000)}…`;
    });
  });
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  header.height = 22;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: keys.length } };
  return ws;
}

const FITMENT_COLS = ['MPN', 'Product URL', 'Year', 'Make', 'Model', 'Submodel', 'Engine', 'Cab Configuration', 'Bed Length', 'Drive Type', 'Body', 'Submodel Other', 'Fitment Text', 'Fitment Page URL', 'Source'];
const IMAGE_COLS = ['MPN', 'Product URL', 'Image #', 'Image URL', 'Thumbnail URL', 'Alt Text', 'HTTP Status', 'Content Type', 'Verified'];
const FAILED_COLS = ['Input MPN', 'Reason', 'Search Method', 'Search URL', 'Search Results Found', 'Returned Part Numbers', 'Candidates Checked', 'Candidate URLs', 'Error', 'Failed At'];

async function writeWorkbook(filePath, { products, fitment, images, failed, summary }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gibson Performance Exhaust scraper';
  wb.created = new Date();

  addSheet(wb, 'Products', products);
  addSheet(wb, 'Vehicle Fitment', fitment, FITMENT_COLS);
  addSheet(wb, 'Product Images', images, IMAGE_COLS);
  addSheet(wb, 'Failed Products', failed, FAILED_COLS);
  const ws = addSheet(wb, 'Summary', summary, ['Metric', 'Value']);
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 90;

  await wb.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { writeWorkbook };

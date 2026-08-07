import { escapeHtml } from "@/lib/format";

export const PRINT_CSS = `
@page { size: A4 landscape; margin: 15mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; background: white; }
.header { border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 8px; }
.header-usaha { font-size: 14pt; font-weight: bold; }
.header-judul { font-size: 12pt; font-weight: bold; margin-top: 2px; }
.fi-table { border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
.fi-label { font-weight: 600; padding-right: 8px; white-space: nowrap; }
.fi-colon { padding-right: 4px; }
.summary-box { border: 1px solid #bbb; border-radius: 3px; padding: 6px 10px; margin-bottom: 10px; background: #fafafa; font-size: 9pt; display: inline-block; }
.summary-title { font-weight: bold; margin-bottom: 4px; }
.sum-tbl { border-collapse: collapse; }
.sum-tbl td { padding: 1px 8px 1px 0; }
.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; margin-top: 4px; }
.data-table th { background: #eaeaea; font-weight: bold; border: 1px solid #bbb; padding: 5px 6px; text-align: left; }
.data-table th.right, .data-table td.right { text-align: right; }
.data-table td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; word-break: break-word; }
.data-table tfoot td { background: #eaeaea; font-weight: bold; border: 1px solid #bbb; padding: 5px 6px; }
.nowrap { white-space: nowrap; } .bold { font-weight: bold; } .muted { color: #555; }
.green { color: #1a7a4a; } .orange { color: #b45309; } .red { color: #b91c1c; } .right { text-align: right; }
.badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8pt; font-weight: 600; border: 1px solid; }
.badge-aktif { color: #92400e; border-color: #d97706; }
.badge-lunas { color: #065f46; border-color: #059669; }
.badge-masuk { color: #065f46; border-color: #059669; }
.badge-keluar { color: #b91c1c; border-color: #dc2626; }
.badge-aman { color: #065f46; border-color: #059669; }
.badge-habis { color: #92400e; border-color: #d97706; }
tr { page-break-inside: avoid; }
`;

export function printHead(judul: string) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>${escapeHtml(judul)}</title>
<style>${PRINT_CSS}</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600);});<\/script>
</head><body>`;
}

export function printFoot() {
  return `</body></html>`;
}

export function filterTableHtml(lines: { label: string; value: string }[]) {
  return `<table class="fi-table"><tbody>${lines.map(f =>
    `<tr><td class="fi-label">${escapeHtml(f.label)}</td><td class="fi-colon">:</td><td>${escapeHtml(f.value)}</td></tr>`
  ).join("")}</tbody></table>`;
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

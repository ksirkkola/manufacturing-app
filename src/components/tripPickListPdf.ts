// Builds a printable pick list PDF for one Trip / IHS or Work Order, to be packed in the box for the client.
// Generated in the browser (jsPDF) from the line items already loaded in the Parts Picking tab —
// no server round trip. Loaded lazily so the PDF library only downloads when someone clicks it.

export interface PickListLine {
  partNumber: string | null;
  invBinLocation: string | null;
  description: string | null;
  name: string;
  notes: string | null;
  quantityRequired: number | null;
  phase: string;
}

export interface PickListTrip {
  ticketCode: string | null;
  name: string;
  company: string | null;
  year: string;
  phase: string;
  // Extra header facts, e.g. serial number / build type for a Work Order.
  extra?: string[];
}

function safeFilePart(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function downloadTripPickList(trip: PickListTrip, lines: PickListLine[]): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Pick List', margin, 50);

  doc.setFontSize(12);
  doc.text([trip.ticketCode, trip.name].filter(Boolean).join('  -  ') || 'Trip', margin, 72);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const meta: string[] = [];
  if (trip.company) meta.push(`Client: ${trip.company}`);
  if (trip.extra) meta.push(...trip.extra);
  if (trip.year && trip.year !== 'Unknown') meta.push(`Year: ${trip.year}`);
  if (trip.phase) meta.push(`Status: ${trip.phase}`);
  doc.text(meta.join('   |   '), margin, 90);
  doc.setTextColor(120);
  doc.text(`Printed ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, pageW - margin, 50, { align: 'right' });
  doc.setTextColor(0);

  // Walk order: by bin location, then part number, so whoever packs the box goes shelf by shelf.
  const sorted = [...lines].sort((a, b) =>
    (a.invBinLocation || '~').localeCompare(b.invBinLocation || '~') ||
    (a.partNumber || '').localeCompare(b.partNumber || ''));

  const totalQty = sorted.reduce((sum, l) => sum + (Number(l.quantityRequired) || 1), 0);

  autoTable(doc, {
    startY: 108,
    margin: { left: margin, right: margin },
    head: [['Part Number', 'Bin', 'Description', 'Qty', 'Packed']],
    body: sorted.map(l => [
      l.partNumber || '-',
      l.invBinLocation || '-',
      [l.description || l.name || '-', l.notes ? `Note: ${l.notes}` : ''].filter(Boolean).join('\n'),
      String(Number(l.quantityRequired) || 1),
      '',
    ]),
    foot: [['', '', `${sorted.length} line${sorted.length === 1 ? '' : 's'}`, String(totalQty), '']],
    styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: [60, 60, 70] },
    footStyles: { fillColor: [235, 235, 238], textColor: 30, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 95, fontStyle: 'bold' },
      1: { cellWidth: 60 },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 50, halign: 'center' },
    },
    // Empty tick box in the Packed column, to be ticked by hand.
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const size = 12;
        doc.setDrawColor(80);
        doc.rect(data.cell.x + (data.cell.width - size) / 2, data.cell.y + (data.cell.height - size) / 2, size, size);
      }
    },
  });

  const name = ['PickList', trip.ticketCode || trip.name, trip.company].filter(Boolean).map(p => safeFilePart(String(p))).join('_');
  doc.save(`${name || 'PickList'}.pdf`);
}

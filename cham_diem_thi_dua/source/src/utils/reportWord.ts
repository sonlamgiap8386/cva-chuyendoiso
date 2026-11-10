import {
  AlignmentType, BorderStyle, Document, Header, Packer, PageNumber, PageOrientation,
  Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from 'docx';
import type { MonthlyScoreRecord, UserProfile } from '../types';

const mm = (value: number) => Math.round(value * 1440 / 25.4);
const pageWidth = mm(297) - mm(30) - mm(15);
const textOf = (node: Element) => (node.textContent ?? '').replace(/\s+/g, ' ').trim();
const centered = AlignmentType.CENTER;
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };

function paragraph(text: string, options: { center?: boolean; justify?: boolean; bold?: boolean; italics?: boolean; underline?: boolean; size?: number; after?: number; keepNext?: boolean; title?: boolean } = {}) {
  return new Paragraph({
    style: options.title ? 'Title' : undefined,
    alignment: options.center ? centered : options.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { before: 0, after: options.after ?? 0, line: 250 },
    keepNext: options.keepNext,
    children: [new TextRun({ text, font: 'Times New Roman', color: '000000', size: options.size ?? 24, bold: options.bold,
      italics: options.italics, underline: options.underline ? {} : undefined })],
  });
}

function columns(rows: Paragraph[][][], width = pageWidth) {
  const count = rows[0].length;
  const widths = rows[0].map((_, i) => Math.round(width * (i + 1) / count) - Math.round(width * i / count));
  return new Table({
    layout: TableLayoutType.FIXED, width: { size: width, type: WidthType.DXA }, columnWidths: widths, borders: noBorders,
    rows: rows.map(groups => new TableRow({ cantSplit: true, children: groups.map((children, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA }, children,
    })) })),
  });
}

function scoreTable(table: HTMLTableElement, compact: boolean) {
  const weights = [25, 43, 85, 72, 57, 35, 31, 30, 33, 36, 74, 145];
  const totalWeight = weights.reduce((sum, width) => sum + width, 0);
  const widths = weights.map(width => Math.round(pageWidth * width / totalWeight));
  widths[widths.length - 1] += pageWidth - widths.reduce((sum, width) => sum + width, 0);
  return new Table({
    layout: TableLayoutType.FIXED, width: { size: pageWidth, type: WidthType.DXA }, columnWidths: widths,
    margins: { top: 45, bottom: 45, left: 65, right: 65 },
    rows: Array.from(table.rows, row => {
      const header = row.parentElement === table.tHead;
      const total = row.parentElement === table.tFoot;
      let column = 0;
      return new TableRow({ tableHeader: header, cantSplit: header || total, children: Array.from(row.cells, cell => {
        const width = widths.slice(column, column + cell.colSpan).reduce((sum, value) => sum + value, 0);
        const text = paragraph(textOf(cell), {
          center: header || total || ![2, 3, 4, 11].includes(column),
          bold: header || total || column === 2 || column === 9,
          size: compact ? 18 : 20,
        });
        const fill = total && column === 9 ? 'FFF2CC' : header || total ? 'EEEEEE' : undefined;
        column += cell.colSpan;
        return new TableCell({ width: { size: width, type: WidthType.DXA }, columnSpan: cell.colSpan,
          shading: fill ? { type: ShadingType.CLEAR, fill } : undefined, children: [text],
        });
      }) });
    }),
  });
}

export function createReportWord(paper: HTMLElement, title: string, compact: boolean) {
  const table = paper.querySelector('table');
  if (!table) throw new Error('Không tìm thấy bảng điểm trong báo cáo.');
  const agency = Array.from(paper.querySelectorAll('[data-report-agency]'), column =>
    Array.from(column.children).filter(textOf).map((line, index) => paragraph(textOf(line), {
      center: true, bold: index < 2, underline: index === 1, italics: line.classList.contains('italic'), after: 45,
    })),
  );
  const headings = Array.from(paper.querySelectorAll('[data-report-title] > *'), (line, index) => paragraph(textOf(line), {
    center: true, title: index === 0, bold: index < 2, italics: line.classList.contains('italic'),
    size: index === 0 ? 32 : 24, after: 70, keepNext: true,
  }));
  const intro = Array.from(paper.querySelectorAll('[data-report-intro]'), node => paragraph(textOf(node), {
    bold: node.tagName === 'H2', justify: node.tagName === 'P',
    after: node.tagName === 'LI' ? 35 : 85,
    keepNext: node.tagName === 'H2',
  }));
  const scores = scoreTable(table, compact);
  const signatures = Array.from(paper.querySelectorAll('[data-report-signatures] > *'), column => {
    const labels = Array.from(column.firstElementChild?.children ?? [], node => paragraph(textOf(node), {
      center: true, bold: !textOf(node).startsWith('('), italics: textOf(node).startsWith('('), size: 22, keepNext: true,
    }));
    const name = textOf(column.lastElementChild!);
    return [...labels, paragraph('', { after: mm(15), keepNext: true }), paragraph(name, { center: true, bold: true })];
  });
  const document = new Document({
    title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24, color: '000000' } } } },
    sections: [{
      properties: { titlePage: true, page: {
        size: { width: mm(210), height: mm(297), orientation: PageOrientation.LANDSCAPE },
        margin: { left: mm(30), right: mm(15), top: mm(20), bottom: mm(20), header: mm(8) },
      } },
      headers: { first: new Header({ children: [new Paragraph('')] }), default: new Header({
        children: [new Paragraph({ alignment: centered, children: [new TextRun({ children: [PageNumber.CURRENT] })] })],
      }) },
      children: [columns([agency]), paragraph('', { after: 55, keepNext: true }), ...headings,
        ...intro, scores, paragraph('', { size: 8, after: 100, keepNext: true }), columns([signatures])],
    }],
  });
  return Packer.toBlob(document);
}

export async function downloadReportWord(paper: HTMLElement, filename: string, compact: boolean) {
  downloadWord(await createReportWord(paper, filename.replace(/\.docx$/, ''), compact), filename);
}

function downloadWord(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPersonalScoreWord(record: MonthlyScoreRecord, user: UserProfile) {
  const width = mm(210 - 30 - 15);
  const title = `PHIẾU ĐÁNH GIÁ THI ĐUA CÁ NHÂN THÁNG ${record.month}`;
  const signature = (label: string, instruction: string, name?: string) => [
    paragraph(label, { center: true, bold: true, size: 20, keepNext: true }),
    paragraph(instruction, { center: true, italics: true, size: 20, after: mm(14), keepNext: true }),
    paragraph(name || '..............................', { center: true, bold: true, size: 22 }),
  ];
  const signatures = [
    signature('NGƯỜI TỰ ĐÁNH GIÁ', '(Ký và ghi rõ họ tên)', record.staffName),
    signature('TỔ TRƯỞNG CHUYÊN MÔN', '(Ký và ghi rõ họ tên)', record.reviewedByName),
  ];
  if (user.role === 'bgh' || user.role === 'ttcm') {
    signatures.push(signature('HIỆU TRƯỞNG PHÊ DUYỆT', '(Ký tên và đóng dấu)', record.approvedByName));
  }
  const detail = (label: string, total: number, sign: '+' | '-', items: MonthlyScoreRecord['bonusItems']) => [
    paragraph(`${label}: ${sign}${total} điểm`, { bold: true, keepNext: items.length > 0 }),
    ...items.map(item => {
      const points = item.creditedPoints ?? item.points * item.quantity;
      const original = item.creditedPoints == null ? ' (điểm gốc)' : '';
      return paragraph(`• ${item.title}: ${sign}${points} điểm${original}${item.note ? ` · ${item.note}` : ''}`, { size: 22 });
    }),
  ];
  const doc = new Document({
    title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24, color: '000000' } } } },
    sections: [{
      properties: { page: {
        size: { width: mm(210), height: mm(297), orientation: PageOrientation.PORTRAIT },
        margin: { left: mm(30), right: mm(15), top: mm(20), bottom: mm(20) },
      } },
      children: [
        columns([[
          [paragraph('TRƯỜNG THPT CHU VĂN AN', { center: true, bold: true, size: 20 })],
          [paragraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { center: true, bold: true, size: 20 }),
            paragraph('Độc lập - Tự do - Hạnh phúc', { center: true, bold: true, size: 20, underline: true })],
        ]], width),
        paragraph(title, { center: true, bold: true, size: 29, after: 100, keepNext: true }),
        paragraph(`Năm học ${record.year}`, { center: true, italics: true, after: 150 }),
        paragraph(`Họ và tên: ${record.staffName} · Mã CB: ${record.staffCode}`, { bold: true }),
        paragraph(`Tổ chuyên môn: ${record.departmentName} · Chức vụ: ${record.position}`, { after: 120 }),
        paragraph(`Điểm chuẩn: ${record.baseScore} điểm`, { bold: true }),
        ...detail('Điểm cộng', record.totalBonus, '+', record.bonusItems ?? []),
        ...detail('Điểm trừ', record.totalPenalty, '-', record.penaltyItems ?? []),
        paragraph(`Điểm tự chấm: ${record.totalScore} điểm`, { bold: true }),
        paragraph(`Điểm BGH duyệt: ${record.bghApprovedScore == null ? 'Chưa chốt' : `${record.bghApprovedScore} điểm`}`, { bold: true }),
        ...(record.feedback ? [paragraph(`Ý kiến cá nhân: ${record.feedback}`)] : []),
        ...(record.bghNotes ? [paragraph(`Ghi chú BGH: ${record.bghNotes}`)] : []),
        paragraph('', { after: 150, keepNext: true }),
        columns([signatures], width),
      ],
    }],
  });
  const code = (record.staffCode ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  downloadWord(await Packer.toBlob(doc), `Phieu_Thi_Dua_${code || 'CBVC'}_Thang_${record.month}.docx`);
}

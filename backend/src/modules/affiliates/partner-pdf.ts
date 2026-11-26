// Partner documents as PDF files (owner, 2026-11-26): the partner application form, so the team can
// download and keep it, and the partner agreement (contract) sent on approval. Built with pdf-lib's
// standard fonts and the same dark VISTA CHASE band as the booking voucher (bookings/voucher-pdf.ts).
// A simple flowing layout: headings, label/value rows, paragraphs and numbered clauses, with page
// breaks and "Page n of m" footers.

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BAND, drawBand, emblemFor, safe, wrap } from "@/modules/bookings/voucher-pdf";

const INK = rgb(0.11, 0.12, 0.14);
const MUTED = rgb(0.4, 0.43, 0.47);
const OCEAN = rgb(0.145, 0.467, 0.502);
const RULE = rgb(0.86, 0.87, 0.88);

export type DocBlock =
  | { kind: "heading"; text: string }
  | { kind: "rows"; rows: [string, string | null | undefined][] }
  | { kind: "paragraph"; text: string; muted?: boolean }
  | { kind: "clauses"; items: { title: string; text: string }[] }
  | { kind: "signatures"; parties: { label: string; lines: string[] }[] };

export interface PartnerDocument {
  title: string;
  subtitle: string;
  /** Large faint word across each page, e.g. "DRAFT". */
  watermark?: string;
  blocks: DocBlock[];
}

const W = 595.28; // A4
const H = 841.89;
const M = 48;
const LABEL_W = 165;

export async function documentPdf(doc: PartnerDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(doc.title));
  pdf.setAuthor("Vista Chase");
  pdf.setCreator("vistachase.com");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const emblem = await emblemFor(pdf);

  let page: PDFPage = pdf.addPage([W, H]);
  drawBand(page, emblem, bold, regular, doc.subtitle, M);
  let y = H - BAND - 36;
  page.drawText(safe(doc.title), { x: M, y, size: 17, font: bold, color: INK });
  y -= 26;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawText(safe(`VISTA CHASE · ${doc.title}`), { x: M, y: H - 34, size: 8, font: bold, color: MUTED });
    page.drawLine({ start: { x: M, y: H - 42 }, end: { x: W - M, y: H - 42 }, thickness: 0.5, color: RULE });
    y = H - 64;
  };
  const room = (needed: number) => {
    if (y - needed < 56) newPage();
  };
  const lines = (text: string, font: PDFFont, size: number, x: number, width: number, color = INK, leading = size * 1.4) => {
    for (const paragraph of text.split(/\n+/)) {
      for (const line of wrap(paragraph, font, size, width)) {
        room(leading);
        page.drawText(line, { x, y, size, font, color });
        y -= leading;
      }
    }
  };

  for (const block of doc.blocks) {
    if (block.kind === "heading") {
      room(40);
      y -= 8;
      page.drawText(safe(block.text).toUpperCase(), { x: M, y, size: 9.5, font: bold, color: OCEAN });
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: RULE });
      y -= 16;
    } else if (block.kind === "rows") {
      for (const [label, value] of block.rows) {
        if (value == null || String(value).trim() === "") continue;
        const valueLines = String(value)
          .split(/\n+/)
          .flatMap((p) => wrap(p, regular, 10, W - M * 2 - LABEL_W));
        room(Math.min(valueLines.length, 3) * 14 + 4);
        page.drawText(safe(label), { x: M, y, size: 9, font: regular, color: MUTED });
        for (const line of valueLines) {
          room(14);
          page.drawText(line, { x: M + LABEL_W, y, size: 10, font: regular, color: INK });
          y -= 14;
        }
        y -= 3;
      }
    } else if (block.kind === "paragraph") {
      lines(block.text, regular, block.muted ? 9 : 10, M, W - M * 2, block.muted ? MUTED : INK);
      y -= 6;
    } else if (block.kind === "clauses") {
      block.items.forEach((item, i) => {
        room(34);
        page.drawText(safe(`${i + 1}. ${item.title}`), { x: M, y, size: 10.5, font: bold, color: INK });
        y -= 15;
        lines(item.text, regular, 9.5, M + 14, W - M * 2 - 14);
        y -= 6;
      });
    } else if (block.kind === "signatures") {
      room(120);
      y -= 10;
      const colW = (W - M * 2 - 24) / block.parties.length;
      const top = y;
      let lowest = y;
      block.parties.forEach((party, i) => {
        const x = M + i * (colW + 24);
        let yy = top;
        page.drawText(safe(party.label), { x, y: yy, size: 9.5, font: bold, color: INK });
        yy -= 36;
        page.drawLine({ start: { x, y: yy }, end: { x: x + colW, y: yy }, thickness: 0.6, color: INK });
        yy -= 12;
        page.drawText("Signature", { x, y: yy, size: 8, font: regular, color: MUTED });
        yy -= 16;
        for (const line of party.lines) {
          for (const l of wrap(line, regular, 9, colW)) {
            page.drawText(l, { x, y: yy, size: 9, font: regular, color: INK });
            yy -= 13;
          }
        }
        lowest = Math.min(lowest, yy);
      });
      y = lowest - 6;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (doc.watermark) {
      p.drawText(safe(doc.watermark), { x: W / 2 - 150, y: H / 2 - 60, size: 110, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.08, rotate: degrees(35) });
    }
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 60, y: 28, size: 8, font: regular, color: MUTED });
    p.drawText("D Tourist Inc., operating as Vista Chase · www.vistachase.com · support@vistachase.com", { x: M, y: 28, size: 8, font: regular, color: MUTED });
  });
  return pdf.save();
}

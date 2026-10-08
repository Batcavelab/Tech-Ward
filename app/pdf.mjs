// Devis and purchase orders as PDF, with no dependencies (replaces the reportlab version).
// Standard Helvetica fonts in WinAnsi encoding, the logo embedded as an RGB image with an alpha mask.
import LOGO_BASE64 from "./logo.mjs";
import { inflateSync, deflateSync } from "node:zlib";

const MM = 72 / 25.4;
const PAGE_W = 595.28, PAGE_H = 841.89;
const LEFT = 16 * MM, TOP = 14 * MM, BOTTOM = 18 * MM;
const WIDTH = PAGE_W - 2 * LEFT;

const NAVY = [0x0b, 0x1f, 0x3a], BLUE = [0x1d, 0x6f, 0xd8], LIGHT = [0xee, 0xf3, 0xfa];
const GREY = [0x5b, 0x65, 0x78], BLACK = [0, 0, 0], WHITE = [255, 255, 255];

// Text styles, as in the old version: font, size, leading, colour.
const ST = {
  n: { bold: false, size: 9, lead: 12, color: BLACK },
  s: { bold: false, size: 8, lead: 10.5, color: GREY },
  b: { bold: true, size: 9.5, lead: 12, color: BLACK },
  h: { bold: true, size: 20, lead: 24, color: NAVY },
  th: { bold: true, size: 8.5, lead: 11, color: WHITE },
  foot: { bold: false, size: 7.5, lead: 9, color: GREY },
};

// ---- Fonts: Helvetica / Helvetica-Bold glyph widths (AFM) for WinAnsi codes 32..255.
const W_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 350,
  556, 350, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350,
  350, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 350, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 350,
  556, 350, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350,
  350, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 350, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

// Unicode -> WinAnsi for the 0x80..0x9F range (the rest of 0xA0..0xFF is Latin-1 as is).
const WIN_EXTRA = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  0x202f: 0xa0, 0x2007: 0xa0, 0x2009: 0x20, 0x2002: 0x20, 0x2003: 0x20, 0x2212: 0x2d, 0x2011: 0x2d,
};

// Text -> string of WinAnsi byte codes (one char per byte); unknown characters become "?".
function win(text) {
  let out = "";
  for (const ch of String(text ?? "").normalize("NFC")) {
    const c = ch.codePointAt(0);
    if (c === 9) out += " ";
    else if ((c >= 32 && c < 127) || (c >= 0xa0 && c <= 0xff)) out += ch;
    else if (WIN_EXTRA[c]) out += String.fromCharCode(WIN_EXTRA[c]);
    else if (c === 0x200b || c === 0xfeff || c === 0x200e || c === 0x200f) continue; // invisible marks
    else out += "?";
  }
  return out;
}

// Width in points of an already encoded string.
function textWidth(s, st) {
  const table = st.bold ? W_BOLD : W_REGULAR;
  let w = 0;
  for (let i = 0; i < s.length; i++) w += table[s.charCodeAt(i) - 32] ?? 556;
  return (w * st.size) / 1000;
}

// Wrap encoded text to a width; "\n" forces a line break, over-long words are cut.
function wrap(text, st, width) {
  const lines = [];
  for (const para of String(text ?? "").split(/\r\n?|\n/).map(win)) {
    let line = "";
    for (let word of para.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (textWidth(candidate, st) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      while (textWidth(word, st) > width && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && textWidth(word.slice(0, cut), st) > width) cut--;
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      line = word;
    }
    lines.push(line);
  }
  return lines;
}

const pdfStr = (s) => "(" + s.replace(/[()\\]/g, (c) => "\\" + c).replace(/\r/g, "\\r") + ")";
const num = (v) => (Math.round(v * 100) / 100).toString();
const rgb = (c) => c.map((v) => num(v / 255)).join(" ");

// ---- Logo: decode the PNG once into RGB + alpha planes (8-bit RGB or RGBA, non-interlaced).
let logoCache;
function loadLogo() {
  if (logoCache !== undefined) return logoCache;
  logoCache = null;
  try {
    const png = Buffer.from(LOGO_BASE64, "base64");
    let pos = 8, width, height, depth, type, interlace;
    const idat = [];
    while (pos < png.length) {
      const len = png.readUInt32BE(pos), kind = png.toString("latin1", pos + 4, pos + 8);
      const data = png.subarray(pos + 8, pos + 8 + len);
      if (kind === "IHDR") [width, height, depth, type, interlace] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9], data[12]];
      else if (kind === "IDAT") idat.push(data);
      else if (kind === "IEND") break;
      pos += 12 + len;
    }
    if (depth !== 8 || interlace || (type !== 6 && type !== 2)) return logoCache;
    const bpp = type === 6 ? 4 : 3, stride = width * bpp;
    const raw = inflateSync(Buffer.concat(idat));
    const pix = Buffer.alloc(stride * height);
    // Undo the per-row filters (None, Sub, Up, Average, Paeth).
    for (let y = 0; y < height; y++) {
      const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, prev = row - stride;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? pix[row + x - bpp] : 0, b = y ? pix[prev + x] : 0;
        const c = x >= bpp && y ? pix[prev + x - bpp] : 0;
        let p = 0;
        if (f === 1) p = a;
        else if (f === 2) p = b;
        else if (f === 3) p = (a + b) >> 1;
        else if (f === 4) {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        pix[row + x] = (raw[src + x] + p) & 255;
      }
    }
    const rgbData = Buffer.alloc(width * height * 3), alpha = type === 6 ? Buffer.alloc(width * height) : null;
    for (let i = 0; i < width * height; i++) {
      pix.copy(rgbData, i * 3, i * bpp, i * bpp + 3);
      if (alpha) alpha[i] = pix[i * 4 + 3];
    }
    logoCache = { width, height, rgb: deflateSync(rgbData), alpha: alpha && deflateSync(alpha) };
  } catch {
    logoCache = null; // missing or unreadable logo: the company name is printed instead
  }
  return logoCache;
}

// ---- Page layout. y is measured from the top of the page; converted when drawing.
class Writer {
  constructor(doc) {
    this.doc = doc;
    this.pages = [];
    this.newPage();
  }
  newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = TOP;
    this.footer();
  }
  // Start a new page if `h` more points do not fit; returns true when it did.
  ensure(h) {
    if (this.y + h <= PAGE_H - BOTTOM) return false;
    this.newPage();
    return true;
  }
  text(s, x, baseline, st, align = "left") {
    if (align === "right") x -= textWidth(s, st);
    this.ops.push(`BT /${st.bold ? "F2" : "F1"} ${st.size} Tf ${rgb(st.color)} rg ${num(x)} ${num(PAGE_H - baseline)} Td ${pdfStr(s)} Tj ET`);
  }
  rect(x, top, w, h, color) {
    this.ops.push(`${rgb(color)} rg ${num(x)} ${num(PAGE_H - top - h)} ${num(w)} ${num(h)} re f`);
  }
  line(x1, y1, x2, y2, width, color) {
    this.ops.push(`${rgb(color)} RG ${width} w ${num(x1)} ${num(PAGE_H - y1)} m ${num(x2)} ${num(PAGE_H - y2)} l S`);
  }
  // Lines of text starting at `top`; returns the height used.
  lines(lines, x, top, st, align = "left") {
    lines.forEach((s, i) => this.text(s, x, top + i * st.lead + st.size, st, align));
    return lines.length * st.lead;
  }
  footer() {
    const { company, number } = this.doc, st = ST.foot;
    this.line(LEFT, PAGE_H - 12 * MM, PAGE_W - LEFT, PAGE_H - 12 * MM, 1.2, BLUE);
    const left = [company.name, "Smart Security. Safer Spaces.", company.phone_display, company.email].filter(Boolean).join(" · ");
    this.text(win(left), LEFT, PAGE_H - 8 * MM, st);
    this.text(win(`${number} · page ${this.pages.length}`), PAGE_W - LEFT, PAGE_H - 8 * MM, st, "right");
  }
}

function header(w, doc, logo) {
  const right = PAGE_W - LEFT, top = w.y + 3;
  // Left: logo (40 mm wide) and company lines.
  let left = top;
  if (logo) {
    const lw = 40 * MM, lh = (lw * logo.height) / logo.width;
    w.ops.push(`q ${num(lw)} 0 0 ${num(lh)} ${num(LEFT)} ${num(PAGE_H - left - lh)} cm /Logo Do Q`);
    left += lh + 4;
  } else {
    left += w.lines([win(doc.company.name)], LEFT, left, ST.h) + 4;
  }
  const company = (doc.company.lines || []).filter(Boolean).flatMap((s) => wrap(s, ST.s, WIDTH * 0.55));
  left += w.lines(company, LEFT, left, ST.s);
  // Right: title, number, dates.
  let r = top + w.lines(wrap(String(doc.title).toUpperCase(), ST.h, WIDTH * 0.45), right, top, ST.h, "right") + 2;
  const nb = { ...ST.n, bold: true }, number = win(doc.number), base = r + ST.n.size;
  w.text(win("N° "), right - textWidth(number, nb), base, ST.n, "right");
  w.text(number, right, base, nb, "right");
  r += ST.n.lead;
  for (const m of doc.meta || []) r += w.lines(wrap(m, ST.n, WIDTH * 0.45), right, r, ST.n, "right");
  w.y = Math.max(left, r) + 3;
}

function partyBox(w, doc) {
  const x = LEFT + WIDTH / 2, bw = WIDTH / 2, inner = bw - 14;
  const [first = "", ...rest] = (doc.party || []).filter((s) => s && String(s).trim());
  const title = wrap(doc.partyTitle, ST.s, inner), name = wrap(first, ST.b, inner);
  const body = rest.flatMap((s) => wrap(s, ST.n, inner));
  const h = 6 + title.length * ST.s.lead + 3 + 3 + name.length * ST.b.lead + 3 + 3 + body.length * ST.n.lead + 8;
  w.ensure(h);
  w.rect(x, w.y, bw, h, LIGHT);
  let y = w.y + 6;
  y += w.lines(title, x + 8, y, ST.s) + 6;
  y += w.lines(name, x + 8, y, ST.b) + 6;
  w.lines(body, x + 8, y, ST.n);
  w.y += h;
}

function linesTable(w, doc) {
  const widths = [0.52, 0.1, 0.19, 0.19].map((f) => f * WIDTH);
  const pad = 6, vpad = 5;
  const cell = { ...ST.n }, rows = doc.lines?.length ? doc.lines : [["—", "", "", ""]];
  // Draw one row; cells are arrays of wrapped lines, vertically centred.
  const drawRow = (cells, st, bg, h) => {
    w.rect(LEFT, w.y, WIDTH, h, bg);
    let x = LEFT;
    cells.forEach((lines, i) => {
      const top = w.y + (h - lines.length * st.lead) / 2;
      if (i === 0) w.lines(lines, x + pad, top, st);
      else w.lines(lines, x + widths[i] - pad, top, st, "right");
      x += widths[i];
    });
    w.y += h;
  };
  const head = (doc.head || []).map((s, i) => wrap(s, ST.th, widths[i] - 2 * pad));
  const headH = Math.max(...head.map((l) => l.length)) * ST.th.lead + 2 * vpad;
  const drawHead = () => drawRow(head, ST.th, NAVY, headH);
  rows.forEach((row, n) => {
    const cells = widths.map((cw, i) => wrap(row[i] ?? "", cell, cw - 2 * pad));
    const h = Math.max(...cells.map((l) => l.length)) * cell.lead + 2 * vpad;
    if (n === 0) w.ensure(headH + h);
    else if (w.ensure(h)) drawHead();
    if (n === 0) drawHead();
    drawRow(cells, cell, n % 2 ? LIGHT : WHITE, h);
  });
  w.line(LEFT, w.y, LEFT + WIDTH, w.y, 0.6, NAVY);
}

function totalsBlock(w, doc) {
  const x = LEFT + WIDTH * 0.55, lw = WIDTH * 0.25, vw = WIDTH * 0.2, pad = 6;
  const rows = (doc.totals || []).map(([label, value, strong]) => {
    const lst = strong ? ST.b : ST.n, vst = { ...ST.n, bold: !!strong };
    const l = wrap(label, lst, lw - 2 * pad), v = wrap(value, vst, vw - 2 * pad);
    return { l, v, lst, vst, strong, h: Math.max(l.length * lst.lead, v.length * vst.lead) + 6 };
  });
  w.ensure(rows.reduce((s, r) => s + r.h, 0));
  rows.forEach((r, i) => {
    const last = i === rows.length - 1;
    if (last) {
      w.rect(x, w.y, lw + vw, r.h, LIGHT);
      w.line(x, w.y, x + lw + vw, w.y, 1, NAVY);
    }
    w.lines(r.l, x + pad, w.y + 3, r.lst);
    w.lines(r.v, x + lw + vw - pad, w.y + 3, r.vst, "right");
    w.y += r.h;
  });
}

// A heading followed by wrapped lines, breaking across pages line by line.
function section(w, heading, lines, st) {
  w.y += 6 * MM;
  w.ensure(ST.b.lead + st.lead);
  w.y += w.lines([win(heading)], LEFT, w.y, ST.b);
  for (const s of lines) {
    w.ensure(st.lead);
    w.y += w.lines([s], LEFT, w.y, st);
  }
}

export function buildPdf(doc) {
  const logo = loadLogo();
  const w = new Writer(doc);
  header(w, doc, logo);
  w.y += 8 * MM;
  partyBox(w, doc);
  w.y += 7 * MM;
  linesTable(w, doc);
  w.y += 4 * MM;
  totalsBlock(w, doc);
  if (doc.notes && String(doc.notes).trim()) section(w, "Notes", wrap(String(doc.notes).trim(), ST.n, WIDTH), ST.n);
  if (doc.conditions?.length) section(w, "Conditions", doc.conditions.flatMap((c) => wrap(`• ${c}`, ST.s, WIDTH)), ST.s);
  return serialize(doc, w.pages, logo);
}

// UTF-16BE hex string for the document info (titles may hold any character).
const infoStr = (s) => "<FEFF" + Buffer.from(String(s), "utf16le").swap16().toString("hex").toUpperCase() + ">";

// ---- File assembly: numbered objects, cross-reference table, trailer.
function serialize(doc, pages, logo) {
  const objects = []; // Buffers or strings, object n is objects[n - 1]
  const add = (body) => objects.push(body) && objects.length;
  const stream = (dict, data) =>
    Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream")]);

  const catalog = add(""), pagesId = add("");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let xobject = "";
  if (logo) {
    const img = `/Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /BitsPerComponent 8 /Filter /FlateDecode`;
    const mask = logo.alpha ? add(stream(`${img} /ColorSpace /DeviceGray`, logo.alpha)) : 0;
    const im = add(stream(`${img} /ColorSpace /DeviceRGB${mask ? ` /SMask ${mask} 0 R` : ""}`, logo.rgb));
    xobject = ` /XObject << /Logo ${im} 0 R >>`;
  }
  const resources = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobject} >>`;
  const kids = pages.map((ops) => {
    const content = add(stream("/Filter /FlateDecode", deflateSync(Buffer.from(ops.join("\n"), "latin1"))));
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${resources} /Contents ${content} 0 R >>`);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${infoStr(`${doc.title} ${doc.number}`)} /Author ${infoStr(doc.company?.name ?? "")} /Producer (Tech-Ward) >>`);

  const parts = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let offset = parts[0].length;
  const offsets = objects.map((body, i) => {
    const buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"), Buffer.from("\nendobj\n")]);
    parts.push(buf);
    const at = offset;
    offset += buf.length;
    return at;
  });
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f ", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `)];
  parts.push(Buffer.from(`${xref.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`, "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}

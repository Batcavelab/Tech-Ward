// Tiny HTML templating: html`<p>${value}</p>` escapes every value unless it is
// already safe (another html`` result or raw()). Arrays are joined, null/false/undefined print nothing.

class Safe {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}

export const raw = (text) => new Safe(String(text ?? ""));

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESC[c]);

function piece(value) {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof Safe) return value.text;
  if (Array.isArray(value)) return value.map(piece).join("");
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += piece(values[i]) + strings[i + 1];
  return new Safe(out);
}

// Text with line breaks -> <br>, escaped.
export const linebreaksbr = (text) => raw(esc(text ?? "").replace(/\r?\n/g, "<br>"));

// Paragraphs like Django's |linebreaks.
export function linebreaks(text) {
  const paras = String(text ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/).filter((p) => p.trim());
  return raw(paras.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n"));
}

// <script type="application/json"> safe for inline use.
export function jsonScript(data, id) {
  const json = JSON.stringify(data).replace(/</g, "\\u003C").replace(/>/g, "\\u003E").replace(/&/g, "\\u0026");
  return raw(`<script id="${esc(id)}" type="application/json">${json}</script>`);
}

export const attrIf = (cond, text) => (cond ? raw(" " + text) : "");

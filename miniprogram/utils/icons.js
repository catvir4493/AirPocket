// A small set of 24px line icons, drawn as SVG and turned into base64 data URIs
// so they can be used as backgrounds without shipping image files.
const SHAPES = {
  home: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
  suitcase: '<rect x="5" y="7" width="14" height="13" rx="2.5"/><path d="M9 7V4.5h6V7M9.5 11v5M14.5 11v5"/>',
  plane: '<path d="M21 15.5v-1.8l-7.6-4.6V4a1.4 1.4 0 0 0-2.8 0v5.1L3 13.7v1.8l7.6-2.3v4.6l-2 1.5V21l3.4-1 3.4 1v-1.7l-2-1.5v-4.6z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  scale: '<path d="M5.5 20h13L17 10H7z"/><circle cx="12" cy="6.5" r="2.5"/>',
  shield: '<path d="M12 3.5 19.5 6.5V12c0 4.5-3.2 7.6-7.5 8.5-4.3-.9-7.5-4-7.5-8.5V6.5z"/><path d="m9 12 2 2 4-4"/>',
  chat: '<path d="M4.5 5.5h15V16H9l-4.5 3.5z"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5h6v2.5M3.5 13h17"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  swap: '<path d="M4 8.5h15l-3.5-3.5M20 15.5H5l3.5 3.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  alert: '<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.5M12 17.2v.2"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
};

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// The SVG source is plain ASCII, so a byte-per-char encoder is enough.
const toBase64 = (text) => {
  let out = "";
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i);
    const b = i + 1 < text.length ? text.charCodeAt(i + 1) : NaN;
    const c = i + 2 < text.length ? text.charCodeAt(i + 2) : NaN;
    const triple = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += CHARS[(triple >> 18) & 63] + CHARS[(triple >> 12) & 63];
    out += Number.isNaN(b) ? "=" : CHARS[(triple >> 6) & 63];
    out += Number.isNaN(c) ? "=" : CHARS[triple & 63];
  }
  return out;
};

const cache = {};

const svgDataUri = (svg) => `data:image/svg+xml;base64,${toBase64(svg)}`;

const iconSrc = (name, color = "#1c1c1a", stroke = 1.8) => {
  const key = `${name}|${color}|${stroke}`;
  if (!cache[key]) {
    const shape = SHAPES[name] || "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
    cache[key] = svgDataUri(svg);
  }
  return cache[key];
};

module.exports = { iconSrc, svgDataUri };

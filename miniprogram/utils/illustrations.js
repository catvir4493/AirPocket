// Line illustrations in the same 2px-stroke style as the icons, coloured per theme.
const { svgDataUri } = require("./icons");

const PLANE = "M21 15.5v-1.8l-7.6-4.6V4a1.4 1.4 0 0 0-2.8 0v5.1L3 13.7v1.8l7.6-2.3v4.6l-2 1.5V21l3.4-1 3.4 1v-1.7l-2-1.5v-4.6z";

const DRAWINGS = {
  // Empty lists: a suitcase with a yellow luggage tag and a dashed flight path.
  suitcase: {
    viewBox: "0 0 160 120",
    draw: (c) => `
      <ellipse cx="80" cy="108" rx="44" ry="5" fill="${c.fill}"/>
      <path d="M14 46 Q36 8 70 16" fill="none" stroke="${c["ink-3"]}" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>
      <g transform="translate(66 6) rotate(78 12 12) scale(0.9)"><path d="${PLANE}" fill="${c.ink}"/></g>
      <path d="M68 42V31a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v11" fill="none" stroke="${c.ink}" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="50" y="42" width="60" height="62" rx="11" fill="${c.card}" stroke="${c.ink}" stroke-width="2.5"/>
      <path d="M67 54v38M93 54v38" stroke="${c.ink}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="62" cy="108" r="3.5" fill="${c.ink}"/>
      <circle cx="98" cy="108" r="3.5" fill="${c.ink}"/>
      <path d="M92 30 Q104 32 111 46" fill="none" stroke="${c.ink}" stroke-width="2" stroke-linecap="round"/>
      <g transform="rotate(16 116 58)">
        <rect x="105" y="45" width="22" height="30" rx="4" fill="${c.yellow}" stroke="${c.ink}" stroke-width="2.2"/>
        <circle cx="116" cy="52" r="2.4" fill="#1c1c1a"/>
        <path d="M110 61h12M110 67h8" stroke="#1c1c1a" stroke-width="2" stroke-linecap="round"/>
      </g>
      <path d="M134 22v8M130 26h8" stroke="${c["ink-3"]}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="28" cy="84" r="2.5" fill="${c["ink-3"]}"/>`,
  },
  // Load failed: a cloud cutting the dashed flight path, plane waiting at the end.
  offline: {
    viewBox: "0 0 160 120",
    draw: (c) => `
      <ellipse cx="80" cy="108" rx="48" ry="5" fill="${c.fill}"/>
      <path d="M12 96 Q34 80 56 86" fill="none" stroke="${c["ink-3"]}" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>
      <path d="M104 86 Q124 80 140 88" fill="none" stroke="${c["ink-3"]}" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>
      <g transform="translate(130 76) rotate(100 12 12) scale(0.8)"><path d="${PLANE}" fill="${c.ink}"/></g>
      <path d="M50 80a17 17 0 0 1 2-34 24 24 0 0 1 45-8 18 18 0 0 1 22 20 15 15 0 0 1-4 22z" fill="${c.card}" stroke="${c.ink}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M66 60l8 8M74 60l-8 8M88 60l8 8M96 60l-8 8" stroke="${c["ink-3"]}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="116" cy="34" r="12" fill="${c.yellow}" stroke="${c.ink}" stroke-width="2.2"/>
      <path d="M116 27v8" stroke="#1c1c1a" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="116" cy="40.5" r="1.8" fill="#1c1c1a"/>
      <path d="M30 26v8M26 30h8" stroke="${c["ink-3"]}" stroke-width="2" stroke-linecap="round"/>`,
  },
  // Home greeting: two pins joined by a dashed arc, plane on the way.
  route: {
    viewBox: "0 0 200 120",
    draw: (c) => `
      <path d="M150 28h24a7 7 0 0 0-7-9 9 9 0 0 0-16 2 6 6 0 0 0-1 7z" fill="${c.card}" stroke="${c["ink-3"]}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M22 34h16a5 5 0 0 0-5-6 6 6 0 0 0-11 1z" fill="${c.card}" stroke="${c["ink-3"]}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M30 96 Q100 -4 172 78" fill="none" stroke="${c["ink-3"]}" stroke-width="2.2" stroke-dasharray="5 6" stroke-linecap="round"/>
      <g transform="translate(88 26) rotate(82 12 12)"><path d="${PLANE}" fill="${c.ink}"/></g>
      <path d="M30 108c-7-9-11-15-11-20a11 11 0 0 1 22 0c0 5-4 11-11 20z" fill="${c.yellow}" stroke="${c.ink}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="30" cy="88" r="3.5" fill="#1c1c1a"/>
      <path d="M172 90c-7-9-11-15-11-20a11 11 0 0 1 22 0c0 5-4 11-11 20z" fill="${c.card}" stroke="${c.ink}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="172" cy="70" r="3.5" fill="${c.ink}"/>
      <path d="M8 112h184" stroke="${c.fill}" stroke-width="3" stroke-linecap="round"/>`,
  },
};

const cache = {};

const illustrationSrc = (name, palette, theme) => {
  const drawing = DRAWINGS[name];
  if (!drawing) {
    return "";
  }
  const key = `${name}|${theme}`;
  if (!cache[key]) {
    const body = drawing.draw(palette).replace(/\s*\n\s*/g, "");
    cache[key] = svgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${drawing.viewBox}">${body}</svg>`
    );
  }
  return cache[key];
};

module.exports = { illustrationSrc };

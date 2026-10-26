// Current light/dark theme for things CSS cannot reach (SVG icons and illustrations).
const PALETTES = {
  light: {
    ink: "#1c1c1a",
    "ink-2": "#55534c",
    "ink-3": "#9a978c",
    faint: "#c4c2b9",
    card: "#ffffff",
    fill: "#f4f3ee",
    yellow: "#fff51f",
  },
  dark: {
    ink: "#f2f1ea",
    "ink-2": "#c3c1b6",
    "ink-3": "#8a887e",
    faint: "#5f5d55",
    card: "#1e1e1b",
    fill: "#2a2a26",
    yellow: "#fff51f",
  },
};

const readTheme = () => {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
    return info.theme === "dark" ? "dark" : "light";
  } catch (error) {
    return "light";
  }
};

let current = readTheme();
const listeners = [];

if (wx.onThemeChange) {
  wx.onThemeChange(({ theme }) => {
    current = theme === "dark" ? "dark" : "light";
    listeners.slice().forEach((listener) => listener(current));
  });
}

const getTheme = () => current;

const getPalette = () => PALETTES[current];

// Token names ("ink", "ink-2", ...) follow the theme; anything else is used as-is.
const resolveColor = (color) => getPalette()[color] || color;

const onThemeChange = (listener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
};

module.exports = { getTheme, getPalette, resolveColor, onThemeChange };

export const brandPalettes = [
  { name: "Supply blue", accent: "#008CC4" },
  { name: "Emerald", accent: "#16A34A" },
  { name: "Violet", accent: "#7C3AED" },
  { name: "Rose", accent: "#E11D48" },
  { name: "Amber", accent: "#D97706" },
  { name: "Slate", accent: "#334155" },
];

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hex: string) {
  const clean = hex.trim().replace("#", "");

  if (/^[0-9a-f]{3}$/i.test(clean)) {
    return `#${clean.split("").map((char) => `${char}${char}`).join("")}`;
  }

  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return `#${clean}`;
  }

  return "#008CC4";
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(from: Rgb, to: Rgb, weight: number) {
  return {
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
  };
}

export function deriveBrandTheme(accent: string) {
  const normalized = normalizeHex(accent);
  const rgb = hexToRgb(normalized);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  return {
    accent: normalized,
    rgb: `${rgb.r} ${rgb.g} ${rgb.b}`,
    dark: rgbToHex(mix(rgb, black, 0.22)),
    tint: rgbToHex(mix(rgb, white, 0.9)),
    tint2: rgbToHex(mix(rgb, white, 0.78)),
  };
}

export function applyBrandTheme(accent: string, root: HTMLElement = document.documentElement) {
  const theme = deriveBrandTheme(accent);

  root.style.setProperty("--se", theme.accent);
  root.style.setProperty("--se-rgb", theme.rgb);
  root.style.setProperty("--se-dark", theme.dark);
  root.style.setProperty("--se-tint", theme.tint);
  root.style.setProperty("--se-tint-2", theme.tint2);
}

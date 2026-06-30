import type { Config } from "tailwindcss";

const config = {
  content: {
    relative: true,
    files: [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
      "./data/**/*.{js,ts,jsx,tsx,mdx}",
      "./lib/**/*.{js,ts,jsx,tsx,mdx}",
      "./types/**/*.{js,ts,jsx,tsx,mdx}",
    ],
  },
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        card: "var(--shadow)",
        panel: "var(--shadow-lg)",
      },
      colors: {
        brand: {
          DEFAULT: "rgb(var(--se-rgb) / <alpha-value>)",
          solid: "var(--se)",
          dark: "var(--se-dark)",
          tint: "var(--se-tint)",
          "tint-2": "var(--se-tint-2)",
        },
        ink: "var(--ink)",
        graphite: "var(--graphite)",
        slate: "var(--slate)",
        muted: "var(--muted)",
        border: "var(--border)",
        chalk: "var(--chalk)",
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-2)",
        },
        success: {
          DEFAULT: "var(--green)",
          tint: "var(--green-tint)",
        },
        warning: {
          DEFAULT: "var(--amber)",
          tint: "var(--amber-tint)",
        },
        danger: {
          DEFAULT: "var(--red)",
          tint: "var(--red-tint)",
        },
        accent: {
          purple: "var(--purple)",
          "purple-tint": "var(--purple-tint)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      screens: {
        xs: "420px",
        "3xl": "1800px",
      },
      transitionTimingFunction: {
        productive: "cubic-bezier(.2, .8, .2, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;

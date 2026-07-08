import type { Config } from "tailwindcss";

/**
 * Paleta ZaionVest — cocoa profundo + creme com dourado suave.
 *
 * Estratégia: sobrescrevemos as escalas `emerald` (accent/BUY/success),
 * `zinc` (texto/neutros), `rose` (danger/SELL/LOSS) e `amber` (warning)
 * para que os componentes existentes assumam o novo tema sem precisar
 * trocar todas as classes.
 */
const cream = {
  50: "#FBF6E4",
  100: "#F5E8B7",
  200: "#F0DDB0", // creme da logo
  300: "#E8CE83",
  400: "#E0BC55",
  500: "#D4A03B", // dourado suave — accent principal
  600: "#B8871F",
  700: "#8F6712",
  800: "#664808",
  900: "#3D2A02",
  950: "#241902",
};

const cocoa = {
  50: "#EFE3D4",
  100: "#D4C0A0",
  200: "#B49B70",
  300: "#8F7A50",
  400: "#6B5A38",
  500: "#55401E",
  600: "#4A3418", // fundo principal, cor da logo
  700: "#3A2610",
  800: "#2C1E0C",
  900: "#1F1509",
  950: "#120C05",
};

const rust = {
  50: "#FBEBE3",
  100: "#F5D2C2",
  200: "#EDB49A",
  300: "#E39F84",
  400: "#D48468",
  500: "#C86A4F", // danger principal / VENDA / LOSS
  600: "#A85536",
  700: "#833F26",
  800: "#5E2C1B",
  900: "#3D1D12",
  950: "#241008",
};

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens de marca (nomes semânticos)
        brand: {
          bg: "#3A2610",
          "bg-deep": "#2A1D0A",
          "bg-elevated": "#4A3418",
          surface: "#55401E",
          cream: "#F0DDB0",
          gold: "#D4A03B",
          rust: "#C86A4F",
        },
        charcoal: {
          DEFAULT: "#3A2610",
          50: cocoa[500],
          100: cocoa[600],
          900: cocoa[900],
        },
        offwhite: "#F0DDB0",

        // Remaps das escalas base do Tailwind
        emerald: cream,
        zinc: {
          50: "#F0DDB0",
          100: "#E5D0A0",
          200: "#D4BE8A",
          300: "#B8A170",
          400: "#8F7B54",
          500: "#6B5A38",
          600: "#55401E",
          700: "#3A2610",
          800: "#2C1E0C",
          900: "#1F1509",
          950: "#0F0904",
        },
        rose: rust,
        red: rust,
        amber: {
          50: "#FBF3DE",
          100: "#F6E4B2",
          200: "#EFD182",
          300: "#E8BC55",
          400: "#DEA82F",
          500: "#C9911D", // gold-mustard, warning
          600: "#A47415",
          700: "#7E570F",
          800: "#563B0A",
          900: "#331F05",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Satoshi",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Roboto Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        terminal:
          "0 1px 0 rgba(240,221,176,0.05) inset, 0 0 0 1px rgba(240,221,176,0.08)",
        glow: "0 0 40px -10px rgba(212,160,59,0.35)",
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(240,221,176,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(240,221,176,0.045) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

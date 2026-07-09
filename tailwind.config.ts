import type { Config } from "tailwindcss";

/**
 * Paleta ZaionVest — preto profundo + branco puro + vermelho premium.
 *
 * Estratégia: sobrescrevemos as escalas `emerald` (accent/BUY), `zinc`
 * (neutros/texto), `rose`/`red` (danger/SELL) e `amber` (warning) para que
 * os componentes existentes assumam o novo tema sem precisar trocar todas
 * as classes.
 *
 * Semântica:
 *  - `emerald` (accent + BUY)  → escala clara off-white (positivo = luz)
 *  - `zinc`    (neutros)       → grayscale puro preto → branco
 *  - `rose`/`red` (SELL/danger) → escala vermelha premium (#DC1F2E)
 *  - `amber`   (warning)        → vermelho apagado (urgência controlada)
 */
const light = {
  50: "#FFFFFF",
  100: "#FAFAFA",
  200: "#F5F5F5", // off-white principal
  300: "#E5E5E5",
  400: "#D4D4D4",
  500: "#FFFFFF", // accent principal (CTA branco puro)
  600: "#F5F5F5",
  700: "#D4D4D4",
  800: "#A3A3A3",
  900: "#525252",
  950: "#171717",
};

const neutral = {
  50: "#FAFAFA",
  100: "#F5F5F5",
  200: "#E5E5E5",
  300: "#D4D4D4",
  400: "#A3A3A3",
  500: "#737373",
  600: "#525252",
  700: "#404040",
  800: "#262626",
  900: "#171717",
  950: "#0A0A0A",
};

const red = {
  50: "#FFF1F2",
  100: "#FFE1E4",
  200: "#FDBBC1",
  300: "#F9868F",
  400: "#F04A57",
  500: "#DC1F2E", // danger / SELL / accent vermelho premium
  600: "#B01623",
  700: "#8C111C",
  800: "#5F0B13",
  900: "#3A070C",
  950: "#1F0407",
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
        // Tokens semânticos de marca
        brand: {
          bg: "#0A0A0A",
          "bg-deep": "#000000",
          "bg-elevated": "#141414",
          surface: "#1F1F1F",
          white: "#F5F5F5",
          red: "#DC1F2E",
          "red-deep": "#B01623",
          // aliases legados (mantêm compatibilidade com classes antigas)
          cream: "#F5F5F5",
          gold: "#DC1F2E",
          rust: "#B01623",
        },
        charcoal: {
          DEFAULT: "#0A0A0A",
          50: neutral[600],
          100: neutral[700],
          900: neutral[950],
        },
        offwhite: "#F5F5F5",

        // Remaps das escalas base do Tailwind
        emerald: light,
        zinc: neutral,
        rose: red,
        red,
        amber: {
          50: "#FFF1F2",
          100: "#FFE1E4",
          200: "#FDBBC1",
          300: "#F9868F",
          400: "#F04A57",
          500: "#DC1F2E",
          600: "#B01623",
          700: "#8C111C",
          800: "#5F0B13",
          900: "#3A070C",
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
          "0 1px 0 rgba(245,245,245,0.05) inset, 0 0 0 1px rgba(245,245,245,0.08)",
        glow: "0 0 40px -10px rgba(220,31,46,0.45)",
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(245,245,245,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,245,0.04) 1px, transparent 1px)",
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

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: { 950: "#070b12", 900: "#0b1220", 850: "#0f1729", 800: "#131c31", 700: "#1c2740" },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(16,185,129,.25), 0 0 32px -8px rgba(16,185,129,.35)",
        cyan: "0 0 0 1px rgba(34,211,238,.25), 0 0 32px -8px rgba(34,211,238,.3)",
      },
    },
  },
  plugins: [],
};

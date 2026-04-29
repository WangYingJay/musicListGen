import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        panel: "#111118",
        surface: "#1a1a24",
        line: "#2a2a35",
        ink: "#e5e7eb",
        muted: "#9ca3af",
        electric: "#3b82f6",
        violet: "#8b5cf6",
        mint: "#10b981",
        amber: "#f59e0b",
        danger: "#ef4444"
      }
    }
  },
  plugins: []
} satisfies Config;

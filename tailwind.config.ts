import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c",
          500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12", 950: "#431407",
        },
        slate: {
          50: "#fbf7f1", 100: "#f5eee5", 200: "#eadfd3", 300: "#d6c6b6", 400: "#9b8b7d",
          500: "#6f746d", 600: "#4d5d55", 700: "#314a40", 800: "#223f35", 900: "#173b31", 950: "#0d2922",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" }
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      }
    }
  },
  plugins: [forms]
} satisfies Config;

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:     "#1B3A5C",
          blue:     "#2E75B6",
          light:    "#D5E8F0",
          mid:      "#AED6F1",
        },
        surface: {
          DEFAULT: "#F8FAFC",
          dark:    "#0F172A",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-in-out",
        "slide-up":   "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "typing":     "typing 1.2s steps(3,end) infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        typing:  { "0%,100%": { content: "." }, "33%": { content: ".." }, "66%": { content: "..." } },
      },
      boxShadow: {
        "card":  "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(27,58,92,0.08)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 8px 32px rgba(27,58,92,0.12)",
        "glow":  "0 0 24px rgba(46,117,182,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;

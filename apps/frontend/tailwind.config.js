/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          page: "#f9f8f6",       // Warm off-white/linen page background
          surface: "#ffffff",    // Pure white for panel containers
          elevated: "#f3efe9",   // Slightly deeper warm white for hover/elevated states
          muted: "#eae5dc",      // Warm grey for disabled/muted elements
          inverse: "#1d2024",    // Dark warm charcoal for high-contrast elements
        },
        border: {
          subtle: "#e6e1d6",     // Soft warm-grey border
          strong: "#ccc6ba",     // Defined border for structures
          focus: "#2563eb",      // Trustworthy blue accent for focus states
        },
        text: {
          primary: "#1c1f24",    // Readable dark charcoal
          secondary: "#535b69",  // Muted dark grey for metadata/descriptions
          muted: "#8c94a0",      // Light grey for captions/placeholders
          inverse: "#f9f8f6",    // Warm off-white for text on dark backgrounds
        },
        accent: {
          cyan: "#0284c7",       // Approachable sky/cadet blue
          green: "#15803d",      // Trustworthy emerald green
          amber: "#b45309",      // Warm bronze/amber
          red: "#b91c1c",        // Muted crimson red
          violet: "#4f46e5",     // Professional indigo/violet
        },
        panel: {
          editor: "#ffffff",
          terminal: "#fbfaf8",   // Sepia-tinted clean console background
          architecture: "#ffffff",
          metadata: "#ffffff",
          history: "#ffffff",
          warm: "#ffffff",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

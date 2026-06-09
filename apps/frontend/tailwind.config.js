/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          page: "#09111f",
          surface: "#0f1a2e",
          elevated: "#16223a",
          muted: "#1d2b46",
          inverse: "#f6f1e6",
        },
        border: {
          subtle: "#243652",
          strong: "#3a5278",
          focus: "#79d8ff",
        },
        text: {
          primary: "#eef5ff",
          secondary: "#a9bad3",
          muted: "#6f819b",
          inverse: "#172033",
        },
        accent: {
          cyan: "#49c7f5",
          green: "#74e3a2",
          amber: "#f7bf5e",
          red: "#ff6b7d",
          violet: "#b6a3ff",
        },
        panel: {
          editor: "#13223a",
          terminal: "#081525",
          architecture: "#182944",
          metadata: "#1f2f4d",
          history: "#21314e",
          warm: "#192846",
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

/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          page: "var(--bg-page)",
          surface: "var(--bg-card)",
          elevated: "var(--bg-editor)",
          muted: "var(--bg-terminal)",
          inverse: "var(--text-primary)",
        },
        border: {
          subtle: "var(--border)",
          strong: "var(--border)",
          focus: "var(--accent)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-secondary)",
          inverse: "var(--bg-page)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          cyan: "var(--status-pending)",
          green: "var(--status-completed)",
          amber: "var(--status-running)",
          red: "var(--status-failed)",
          violet: "var(--accent)",
        },
        status: {
          pending: "var(--status-pending)",
          running: "var(--status-running)",
          completed: "var(--status-completed)",
          failed: "var(--status-failed)",
          cancelled: "var(--status-cancelled)",
        },
        panel: {
          editor: "var(--bg-card)",
          terminal: "var(--bg-terminal)",
          architecture: "var(--bg-card)",
          metadata: "var(--bg-card)",
          history: "var(--bg-card)",
          warm: "var(--bg-card)",
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

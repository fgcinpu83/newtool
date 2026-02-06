import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                background: "#0f172a", // Darker blue-ish slate
                foreground: "#f8fafc",
                "primary": "#3b82f6", // Bright blue
                "primary-dark": "#1d4ed8",
                "secondary": "#6366f1", // Indigo
                "background-light": "#f1f5f9",
                "background-dark": "#0f172a", // Slate 900
                "surface-dark": "#1e293b", // Slate 800
                "border-dark": "#334155", // Slate 700
                "success": "#22c55e",
                "danger": "#ef4444",
                "warning": "#f59e0b",
                "profit-blue": "#0ea5e9",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"],
                "mono": ["Roboto Mono", "monospace"],
            },
            borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1rem", "full": "9999px" },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
};
export default config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crm: {
          bg: '#0b0f19',
          card: '#111827',
          border: '#1f2937',
          accent: '#3b82f6',
          hover: '#1e293b',
          text: '#f3f4f6',
          muted: '#9ca3af',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}

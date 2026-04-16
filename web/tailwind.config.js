/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        surface: '#181818',
        surfaceHighlight: '#282828',
        primary: '#eb40a9', // Tussi Pink
        textPrimary: '#ffffff',
        textSecondary: '#a7a7a7'
      }
    },
  },
  plugins: [],
}

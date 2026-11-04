/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "#F6F7F4",
        ink: "#1B1C19",
        mute: "#3D463F",
        line: "#D5D9D2",
        surface: "#FFFFFF",
        primary: "#123A63",
        onPrimary: "#FFFFFF",
        danger: "#8C1D18",
      },
    },
  },
  plugins: [],
};

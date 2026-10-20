export const themeBootScript = `
(function () {
  function applySavedTheme() {
  try {
    var saved = JSON.parse(window.localStorage.getItem("supplyed_tweaks") || "{}");
    var accent = String(saved.accent || "#008CC4").trim();
    if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) accent = "#008CC4";
    if (accent.charAt(0) !== "#") accent = "#" + accent;
    if (accent.length === 4) accent = "#" + accent[1] + accent[1] + accent[2] + accent[2] + accent[3] + accent[3];
    var rgb = {
      r: parseInt(accent.slice(1, 3), 16),
      g: parseInt(accent.slice(3, 5), 16),
      b: parseInt(accent.slice(5, 7), 16)
    };
    function mix(to, weight) {
      var from = rgb;
      return "#" + [from.r + (to.r - from.r) * weight, from.g + (to.g - from.g) * weight, from.b + (to.b - from.b) * weight]
        .map(function (value) { return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"); })
        .join("");
    }
    function luminance(hex) {
      var channels = [1, 3, 5].map(function (index) {
        var value = parseInt(hex.slice(index, index + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }
    var tint = mix({ r: 255, g: 255, b: 255 }, 0.9);
    var darkWeight = 0.22;
    var dark = mix({ r: 0, g: 0, b: 0 }, darkWeight);
    while ((luminance(tint) + 0.05) / (luminance(dark) + 0.05) < 4.6 && darkWeight < 1) {
      darkWeight = Math.min(1, darkWeight + 0.02);
      dark = mix({ r: 0, g: 0, b: 0 }, darkWeight);
    }
    var root = document.documentElement.style;
    root.setProperty("--se", accent);
    root.setProperty("--se-rgb", rgb.r + " " + rgb.g + " " + rgb.b);
    root.setProperty("--se-dark", dark);
    root.setProperty("--se-tint", tint);
    root.setProperty("--se-tint-2", mix({ r: 255, g: 255, b: 255 }, 0.78));
  } catch (error) {}
  }
  applySavedTheme();
  window.addEventListener?.("storage", function (event) {
    if (event.key === "supplyed_tweaks" || event.key === null) applySavedTheme();
  });
  window.addEventListener?.("focus", applySavedTheme);
})();
`;

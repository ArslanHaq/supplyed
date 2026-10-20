import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: ["tmp/**", "public/vendor/**"] }, ...nextVitals];

export default config;

import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: ["tmp/**"] }, ...nextVitals];

export default config;

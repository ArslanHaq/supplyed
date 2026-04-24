import "./globals.css";

export const metadata = {
  title: "SupplyED Prototype",
  description: "Next.js port of the SupplyED prototype",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

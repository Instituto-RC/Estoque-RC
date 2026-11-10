import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Estoque RC", template: "%s · Estoque RC" },
  description: "Controle de estoque do Instituto RC Odontologia",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Estoque RC", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-32.png", sizes: "32x32" }], apple: "/icons/apple-touch-icon.png" },
  openGraph: { title: "Estoque RC", description: "Controle de estoque do Instituto RC Odontologia", images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#23272f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Clash Display (tipografia principal da marca) - Fontshare */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500&display=swap"
        />
      </head>
      <body className={`${hanken.variable} antialiased`}>{children}</body>
    </html>
  );
}

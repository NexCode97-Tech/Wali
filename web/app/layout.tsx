import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import { CabeceraWali } from "@/components/cabecera";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  title: "Wali | El CRM de tus conversaciones",
  description: "WhatsApp, Instagram, Messenger y correo en una sola bandeja, con agentes de IA. Hecho por NexCode97.",
  icons: { icon: [{ url: "/wali-32.png", sizes: "32x32", type: "image/png" }], apple: "/wali-180.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        <CabeceraWali />
        {children}
      </body>
    </html>
  );
}

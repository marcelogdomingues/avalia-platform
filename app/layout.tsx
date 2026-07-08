import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Avalia — Avaliação Automática",
  description: "Plataforma de pré-avaliação de trabalhos com IA e validação humana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.variable} data-theme="light" data-look="warm">
      <body>{children}</body>
    </html>
  );
}

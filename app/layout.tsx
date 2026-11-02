import "./globals.css";
import { Inter, Newsreader } from "next/font/google";
import LiquidBackdrop from "@/components/LiquidBackdrop";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata = {
  title: "Avalia — Avaliação Automática",
  description: "Plataforma de pré-avaliação de trabalhos com IA e validação humana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${inter.variable} ${newsreader.variable}`} data-theme="light" data-look="warm">
      <body>
        <LiquidBackdrop />
        {children}
      </body>
    </html>
  );
}

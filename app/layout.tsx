import "./globals.css";
import { Inter } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import ParticleField from "@/components/ParticleField";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Avalia — Avaliação Automática",
  description: "Plataforma de pré-avaliação de trabalhos com IA e validação humana.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ParticleField />
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}

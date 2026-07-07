export const metadata = {
  title: "Avalia — Avaliação Automática",
  description: "Plataforma de pré-avaliação de trabalhos com IA e validação humana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}

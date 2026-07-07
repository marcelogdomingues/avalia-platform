import "./globals.css";

export const metadata = {
  title: "Avalia — Avaliação Automática",
  description: "Plataforma de pré-avaliação de trabalhos com IA e validação humana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <header className="site-header">
          <div className="inner">
            <a href="/" className="brand" style={{ color: "inherit", textDecoration: "none" }}>
              <span className="logo">A</span>
              <span>Avalia</span>
            </a>
            <nav>
              <a className="nav-link" href="/professor">Painel do professor</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

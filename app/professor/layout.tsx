import { requireProfessor } from "@/lib/auth";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  // Garante sessão em toda a área do professor; o chrome (sidebar) é por página:
  // páginas de navegação usam <ProfShell>, a de trabalho usa o portal completo.
  await requireProfessor();
  return <>{children}</>;
}

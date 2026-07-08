import { getCurrentProfessor } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuthPanel from "@/components/AuthPanel";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await getCurrentProfessor()) redirect("/professor");
  const { erro } = await searchParams;
  return <AuthPanel initialMode="signin" erro={erro} />;
}

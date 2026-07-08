import { getCurrentProfessor } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuthPanel from "@/components/AuthPanel";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await getCurrentProfessor()) redirect("/professor");
  const { erro } = await searchParams;
  const locale = await getLocale();
  return <AuthPanel initialMode="signin" erro={erro} locale={locale} />;
}

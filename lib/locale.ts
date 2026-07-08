import { cookies } from "next/headers";
import type { Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  return c.get("locale")?.value === "en" ? "en" : "pt";
}

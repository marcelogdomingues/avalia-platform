"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions";
import { LOCALES, type Locale } from "@/lib/i18n";

export default function LangSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(code: Locale) {
    if (code === locale || pending) return;
    startTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  }

  return (
    <div className="langsw" role="group" aria-label="Idioma">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          className={locale === l.code ? "active" : ""}
          onClick={() => pick(l.code)}
          aria-pressed={locale === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

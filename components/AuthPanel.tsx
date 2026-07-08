"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, registar } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import LangSwitcher from "./LangSwitcher";

function Mark({ size = 30, stroke = "#faf7f1", w = 11 }: { size?: number; stroke?: string; w?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 84 L48 14 L80 84" />
      <path d="M28 54 L42 68 L64 40" />
    </svg>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center", padding: "13px", opacity: pending ? 0.85 : 1 }}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export default function AuthPanel({
  initialMode = "signin",
  erro,
  locale = "pt",
}: {
  initialMode?: "signin" | "signup";
  erro?: string;
  locale?: Locale;
}) {
  const t = getDict(locale).auth;
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const isUp = mode === "signup";

  return (
    <div className="auth2">
      {/* Painel de marca */}
      <div className="auth2-brand">
        <a href="/" className="auth2-brandlink">
          <Mark />
          <span className="auth2-wordmark">Avalia</span>
        </a>
        <div className="auth2-mark">
          <Mark size={120} stroke="rgba(250,247,241,0.9)" w={10} />
        </div>
        <div>
          <div className="auth2-eyebrow">{t.eyebrow}</div>
          <p className="auth2-quote">{t.quote}</p>
          <div className="auth2-badges">
            {t.badges.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="auth2-formwrap">
        <div className="auth2-lang">
          <LangSwitcher locale={locale} />
        </div>
        <div className="auth2-card">
          <div className="seg auth2-toggle">
            <button type="button" className={!isUp ? "active" : ""} onClick={() => setMode("signin")}>{t.signin}</button>
            <button type="button" className={isUp ? "active" : ""} onClick={() => setMode("signup")}>{t.signup}</button>
          </div>

          <h1 className="auth2-title">{isUp ? t.createTitle : t.welcomeTitle}</h1>
          <p className="auth2-sub">{isUp ? t.createSub : t.welcomeSub}</p>

          {erro && (
            <div className="err-banner" style={{ marginBottom: 20 }}>
              {erro === "email" ? t.errEmail : erro === "campos" ? t.errFields : t.errCreds}
            </div>
          )}

          <form action={isUp ? registar : entrar}>
            {/* Campo Nome — expande com pop no modo criar conta */}
            <div className={`auth2-expand ${isUp ? "open" : ""}`}>
              <div className="field">
                <label>{t.name}</label>
                <input name="nome" required={isUp} placeholder={t.namePh} />
              </div>
            </div>

            <div className="field">
              <label>{t.email}</label>
              <input name="email" type="email" required autoComplete="email" placeholder={t.emailPh} />
            </div>
            <div className="field">
              <label>{t.password}</label>
              <input name="password" type="password" required minLength={6} autoComplete={isUp ? "new-password" : "current-password"} placeholder="••••••••" />
            </div>

            <SubmitButton
              label={isUp ? t.signupBtn : t.signinBtn}
              pendingLabel={isUp ? t.signupPending : t.signinPending}
            />
          </form>

          <p className="auth2-switch">
            {isUp ? (
              <>{t.switchToInQ} <a onClick={() => setMode("signin")}>{t.switchToIn}</a></>
            ) : (
              <>{t.switchToUpQ} <a onClick={() => setMode("signup")}>{t.switchToUp}</a></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

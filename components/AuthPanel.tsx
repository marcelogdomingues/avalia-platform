"use client";

import { useState } from "react";
import { entrar, registar } from "@/lib/actions";

function Mark({ size = 30, stroke = "#faf7f1", w = 11 }: { size?: number; stroke?: string; w?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 84 L48 14 L80 84" />
      <path d="M28 54 L42 68 L64 40" />
    </svg>
  );
}

export default function AuthPanel({
  initialMode = "signin",
  erro,
}: {
  initialMode?: "signin" | "signup";
  erro?: string;
}) {
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
          <div className="auth2-eyebrow">Avaliação com IA · validação humana</div>
          <p className="auth2-quote">“A primeira passagem é automática. O juízo continua humano.”</p>
          <div className="auth2-badges">
            <span>Avaliação por rubrica</span>
            <span>Revisão humana</span>
            <span>Sinais anti-IA</span>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="auth2-formwrap">
        <div className="auth2-card">
          <div className="seg auth2-toggle">
            <button type="button" className={!isUp ? "active" : ""} onClick={() => setMode("signin")}>Entrar</button>
            <button type="button" className={isUp ? "active" : ""} onClick={() => setMode("signup")}>Criar conta</button>
          </div>

          <h1 className="auth2-title">{isUp ? "Cria a tua conta" : "Bem-vindo de volta"}</h1>
          <p className="auth2-sub">
            {isUp ? "Configura em menos de um minuto — sem cartão." : "Entra para continuar a rever as tuas avaliações."}
          </p>

          {erro && (
            <div className="err-banner" style={{ marginBottom: 20 }}>
              {erro === "email"
                ? "Já existe uma conta com esse email."
                : erro === "campos"
                ? "Preenche todos os campos (password com 6+ caracteres)."
                : "Email ou password incorretos."}
            </div>
          )}

          <form action={isUp ? registar : entrar}>
            {isUp && (
              <div className="field">
                <label>Nome completo</label>
                <input name="nome" required placeholder="Prof. Elena Ramos" />
              </div>
            )}
            <div className="field">
              <label>Email institucional</label>
              <input name="email" type="email" required autoComplete="email" placeholder="tu@universidade.pt" />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={isUp ? "new-password" : "current-password"}
                placeholder="••••••••"
              />
            </div>
            <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center", padding: "13px" }}>
              {isUp ? "Criar conta" : "Entrar"}
            </button>
          </form>

          <p className="auth2-switch">
            {isUp ? (
              <>Já tens conta? <a onClick={() => setMode("signin")}>Entrar</a></>
            ) : (
              <>Novo na Avalia? <a onClick={() => setMode("signup")}>Criar conta</a></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

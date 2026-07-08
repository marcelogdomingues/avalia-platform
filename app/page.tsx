import { getCurrentProfessor } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import SiteMotion from "@/components/SiteMotion";
import LangSwitcher from "@/components/LangSwitcher";

export const dynamic = "force-dynamic";

function Mark({ size = 30, stroke = "#0f766e", w = 11 }: { size?: number; stroke?: string; w?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 84 L48 14 L80 84" />
      <path d="M28 54 L42 68 L64 40" />
    </svg>
  );
}

function Bar({ label, score, pct }: { label: string; score: string; pct: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span className="mono" style={{ color: "var(--faint)" }}>{score}</span>
      </div>
      <div className="mbar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default async function Home() {
  const [prof, locale] = await Promise.all([getCurrentProfessor(), getLocale()]);
  const d = getDict(locale);

  return (
    <div className="site">
      <SiteMotion />

      {/* NAV */}
      <nav className="site-nav">
        <div className="inner">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Mark />
            <span className="serif" style={{ fontSize: 24, color: "var(--heading)" }}>Avalia</span>
          </div>
          <div className="site-navlinks">
            <a href="#how">{d.nav.how}</a>
            <a href="#safeguards">{d.nav.safeguards}</a>
            <a href="#security">{d.nav.security}</a>
            <a href="#educators">{d.nav.educators}</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LangSwitcher locale={locale} />
            {prof ? (
              <a className="btn sm" href="/professor">{d.nav.panel}</a>
            ) : (
              <>
                <a href="/login" style={{ fontSize: 14.5, color: "var(--muted)" }}>{d.nav.signin}</a>
                <a className="btn" href="/registo" style={{ padding: "10px 18px" }}>{d.nav.start}</a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="site-wrap site-hero">
        <div className="reveal">
          <div className="kicker" style={{ marginBottom: 24 }}>{d.hero.kicker}</div>
          <h1 className="site-h1">{d.hero.h1a}<br />{d.hero.h1b}</h1>
          <p className="site-lead">{d.hero.lead}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 34, flexWrap: "wrap" }}>
            <a className="btn btn-lg" href="/registo">{d.hero.start}</a>
            <a className="btn secondary btn-lg" href="#how">{d.hero.how}</a>
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.7 }}>{d.hero.sub}</div>
        </div>

        {/* Mock do produto */}
        <div className="reveal mock" style={{ transitionDelay: "150ms" }}>
          <div className="mock-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mark size={18} w={12} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.mock.title}</span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{d.mock.sub}</span>
          </div>
          <div style={{ padding: "22px 22px 24px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>{d.mock.aiScore}</div>
                <div className="serif" style={{ fontSize: 38, lineHeight: 1 }}>88<span style={{ fontSize: 20, color: "var(--faint)" }}> / 100</span></div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(15,118,110,0.1)", color: "#0f766e", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 999 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0f766e" }} />{d.mock.awaiting}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <Bar label={d.mock.c1} score="27/30" pct={90} />
              <Bar label={d.mock.c2} score="22/30" pct={73} />
              <Bar label={d.mock.c3} score="24/25" pct={96} />
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 15px", marginBottom: 18 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 7 }}>{d.mock.feedbackLabel}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>{d.mock.feedback}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn sm" style={{ flex: 1 }}>{d.mock.approve}</button>
              <button className="btn secondary sm" style={{ flex: 1 }}>{d.mock.adjust}</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 11.5, color: "var(--faint)" }}>
              <span style={{ width: 14, height: 14, border: "1.5px solid var(--faint)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
              {d.mock.integrity}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — cena de scroll fixo */}
      <section id="how" className="band">
        <div data-story className="story-wrap">
          <div className="story-sticky">
            <div className="site-wrap" style={{ width: "100%" }}>
              <div className="kicker" style={{ marginBottom: 6 }}>{d.how.kicker}</div>
              <div className="serif" style={{ fontSize: 30, lineHeight: 1.15, margin: "0 0 40px", maxWidth: 520, color: "var(--heading)" }}>{d.how.title}</div>
              <div className="story-grid">
                <div className="story-left">
                  <div className="story-rail"><span data-rail-fill /></div>
                  <div className="story-texts">
                    <div className="phase-text" data-phase-text="0">
                      <div className="serif" style={{ fontSize: 22, color: "#0f766e", marginBottom: 12 }}>01</div>
                      <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px", color: "var(--heading)" }}>{d.how.p1t}</h3>
                      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, maxWidth: 400 }}>{d.how.p1d}</p>
                    </div>
                    <div className="phase-text abs" data-phase-text="1">
                      <div className="serif" style={{ fontSize: 22, color: "#0f766e", marginBottom: 12 }}>02</div>
                      <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px", color: "var(--heading)" }}>{d.how.p2t}</h3>
                      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, maxWidth: 400 }}>{d.how.p2d}</p>
                    </div>
                    <div className="phase-text abs" data-phase-text="2">
                      <div className="serif" style={{ fontSize: 22, color: "#0f766e", marginBottom: 12 }}>03</div>
                      <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px", color: "var(--heading)" }}>{d.how.p3t}</h3>
                      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, maxWidth: 400 }}>{d.how.p3d}</p>
                    </div>
                  </div>
                </div>

                <div className="story-mocks">
                  {/* Fase 0 — rubrica */}
                  <div className="phase-mock" data-phase-mock="0">
                    <div className="mock">
                      <div className="mock-head">
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{d.how.rubricTitle}</span>
                        <span className="mono" style={{ fontSize: 11, color: "#0f766e" }}>{d.how.criteria}</span>
                      </div>
                      <div style={{ padding: "10px 20px 18px" }}>
                        {[[d.mock.c1, "/ 30"], [d.mock.c2, "/ 30"], [d.mock.c3, "/ 25"], [d.mock.c4, "/ 15"]].map(([n, m], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                            <span style={{ fontSize: 14.5 }}>{n}</span>
                            <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>{m}</span>
                          </div>
                        ))}
                        <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--faint)" }}>{d.how.imported}</div>
                      </div>
                    </div>
                  </div>
                  {/* Fase 1 — IA rascunha */}
                  <div className="phase-mock dim" data-phase-mock="1">
                    <div className="mock">
                      <div className="mock-head">
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{d.mock.title}</span>
                        <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#0f766e" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0f766e" }} />{d.how.drafting}
                        </span>
                      </div>
                      <div style={{ padding: "18px 20px 20px" }}>
                        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>{d.how.draftScore}</div>
                        <div className="serif" style={{ fontSize: 36, lineHeight: 1, marginBottom: 16 }}>88<span style={{ fontSize: 19, color: "var(--faint)" }}> / 100</span></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
                          <Bar label={d.mock.c1} score="27/30" pct={90} />
                          <Bar label={d.mock.c2} score="22/30" pct={73} />
                          <Bar label={d.mock.c3} score="24/25" pct={96} />
                        </div>
                        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>{d.mock.feedbackLabel}</div>
                          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>{d.mock.feedback}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Fase 2 — publicado */}
                  <div className="phase-mock dim" data-phase-mock="2">
                    <div className="mock">
                      <div className="mock-head">
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{d.mock.title}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(15,118,110,0.12)", color: "#0f766e", fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 999 }}>{d.how.published}</span>
                      </div>
                      <div style={{ padding: "18px 20px 20px" }}>
                        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>{d.how.finalScore}</div>
                        <div className="serif" style={{ fontSize: 36, lineHeight: 1, marginBottom: 16 }}>90<span style={{ fontSize: 19, color: "var(--faint)" }}> / 100</span></div>
                        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>{d.how.editedFeedbackLabel}</div>
                          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>{d.how.editedFeedback}</div>
                        </div>
                        <div style={{ background: "#0f766e", color: "#faf7f1", fontSize: 13.5, fontWeight: 500, padding: 11, borderRadius: 9, textAlign: "center" }}>{d.how.approvedReleased}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, fontSize: 11.5, color: "var(--faint)" }}>
                          <span style={{ width: 14, height: 14, border: "1.5px solid #0f766e", color: "#0f766e", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
                          {d.how.audit}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="site-wrap site-section">
        <div className="reveal kicker" style={{ marginBottom: 18 }}>{d.features.kicker}</div>
        <h2 className="reveal serif" style={{ fontSize: 44, lineHeight: 1.1, margin: "0 0 52px", maxWidth: 600, color: "var(--heading)" }}>{d.features.title}</h2>
        <div data-reveal-group className="feat-grid">
          {d.features.items.map(([ic, t, desc]) => (
            <div key={t} className="reveal">
              <div className="feat-ic">{ic}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAFEGUARDS */}
      <section id="safeguards" className="teal-band">
        <div className="site-wrap" style={{ padding: "96px 40px", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 64, alignItems: "center" }}>
          <div className="reveal left">
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(250,247,241,0.7)", marginBottom: 18 }}>{d.safeguards.kicker}</div>
            <h2 className="serif" style={{ fontSize: 44, lineHeight: 1.12, margin: "0 0 20px" }}>{d.safeguards.title}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "rgba(250,247,241,0.82)", margin: 0 }}>{d.safeguards.lead}</p>
          </div>
          <div data-reveal-group style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {d.safeguards.items.map(([t, desc]) => (
              <div key={t} className="reveal teal-card">
                <h3 className="serif" style={{ fontSize: 20, margin: "0 0 9px" }}>{t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(250,247,241,0.78)", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR EDUCATORS */}
      <section id="educators" className="site-wrap site-section">
        <div className="reveal kicker" style={{ marginBottom: 18 }}>{d.educators.kicker}</div>
        <h2 className="reveal serif" style={{ fontSize: 44, lineHeight: 1.1, margin: "0 0 52px", maxWidth: 600, color: "var(--heading)" }}>{d.educators.title}</h2>
        <div data-reveal-group style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {d.educators.items.map(([t, desc]) => (
            <div key={t} className="reveal" style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 32, background: "var(--surface)" }}>
              <h3 className="serif" style={{ fontSize: 24, margin: "0 0 10px", color: "var(--heading)" }}>{t}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="band">
        <div className="site-wrap" style={{ padding: "88px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div className="reveal left">
            <div className="kicker" style={{ marginBottom: 18 }}>{d.security.kicker}</div>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.12, margin: "0 0 18px", color: "var(--heading)" }}>{d.security.title}</h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: 0 }}>{d.security.lead}</p>
          </div>
          <div data-reveal-group style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {d.security.items.map((s, i) => (
              <div key={s} className="reveal" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 4px", borderBottom: i < d.security.items.length - 1 ? "1px solid var(--border-strong)" : "none" }}>
                <span style={{ fontSize: 15.5, fontWeight: 500 }}>{s}</span>
                <span className="mono" style={{ fontSize: 12, color: "#0f766e" }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PULL QUOTE */}
      <section className="site-wrap" style={{ maxWidth: 900, padding: "100px 40px", textAlign: "center" }}>
        <div className="reveal" style={{ display: "inline-block", marginBottom: 28 }}><Mark size={40} /></div>
        <p className="reveal serif" style={{ fontWeight: 400, fontStyle: "italic", fontSize: 33, lineHeight: 1.35, margin: "0 0 24px", color: "var(--heading)" }}>{d.quote.text}</p>
        <div className="reveal mono" style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>{d.quote.author}</div>
      </section>

      {/* FINAL CTA */}
      <section id="demo" className="dark-band">
        <div data-reveal-group className="site-wrap" style={{ padding: "96px 40px", textAlign: "center" }}>
          <h2 className="reveal serif" style={{ fontSize: 48, lineHeight: 1.1, margin: "0 0 18px" }}>{d.cta.title}</h2>
          <p className="reveal" style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(250,247,241,0.72)", margin: "0 auto 36px", maxWidth: 520 }}>{d.cta.lead}</p>
          <div className="reveal" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <a className="btn btn-lg" href="/registo">{d.cta.start}</a>
            <a className="btn-lg" href="/login" style={{ border: "1px solid rgba(250,247,241,0.3)", color: "#faf7f1" }}>{d.cta.have}</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-foot">
        <div className="site-wrap" style={{ padding: "52px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <Mark size={26} />
              <span className="serif" style={{ fontSize: 22, color: "var(--heading)" }}>Avalia</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--faint)", margin: 0 }}>{d.footer.tagline}</p>
          </div>
          <div style={{ display: "flex", gap: 64, fontSize: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>{d.footer.product}</span>
              <a href="#how" style={{ color: "var(--muted)" }}>{d.nav.how}</a>
              <a href="#safeguards" style={{ color: "var(--muted)" }}>{d.nav.safeguards}</a>
              <a href="#security" style={{ color: "var(--muted)" }}>{d.nav.security}</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>{d.footer.account}</span>
              <a href="/login" style={{ color: "var(--muted)" }}>{d.footer.signin}</a>
              <a href="/registo" style={{ color: "var(--muted)" }}>{d.footer.signup}</a>
              <a href="/aluno" style={{ color: "var(--muted)" }}>{d.footer.student}</a>
            </div>
          </div>
        </div>
        <div className="site-wrap mono" style={{ padding: "20px 40px 40px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--faint)" }}>{d.footer.copyright}</div>
      </footer>
    </div>
  );
}

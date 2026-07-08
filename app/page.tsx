import { getCurrentProfessor } from "@/lib/auth";
import SiteMotion from "@/components/SiteMotion";

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

const FEATURES = [
  ["§", "Notas ancoradas na rubrica", "Cada ponto está ligado a um critério que escreveste, com uma justificação que podes ler e editar."],
  ["⌘", "Fila com o docente no ciclo", "Aprova numa tecla, ajusta em segundos. Trata os fáceis em lote, abranda nos que precisam de ti."],
  ["≈", "Feedback consistente e explicável", "O mesmo critério na submissão um e na duzentos — com comentários acionáveis para o aluno."],
  ["◇", "Sinais de integridade, não veredictos", "As flags dão contexto ao docente para pesar — a Avalia nunca decide sozinha sobre má conduta."],
  ["⇄", "Integração com o LMS", "Moodle e afins. Notas e comentários sincronizam para onde o aluno já olha."],
  ["▤", "Análises de departamento", "Tempo de resposta, distribuição de notas e taxas de ajuste — visão sem vigiar o docente."],
];

const EDUCATORS = [
  ["Docentes", "Recupera as tuas noites. Avalia uma pilha inteira numa fração do tempo, com a palavra final em cada nota."],
  ["Direção & compras", "Um processo defensável e auditável, com tratamento de dados alinhado e controlos institucionais claros."],
  ["Alunos", "Feedback mais rápido e consistente, revisto por um humano, com um caminho transparente para questionar."],
  ["Design instrucional", "Rubricas baseadas em padrões, adoção nativa no LMS e análises que respeitam a autonomia do docente."],
];

const SAFEGUARDS = [
  ["Sem decisões autónomas", "Cada nota e cada flag exige confirmação humana antes de contar."],
  ["Transparência total", "Alunos e docentes veem que a IA ajudou, e qual foi a justificação."],
  ["Monitorização de viés", "A avaliação é auditada para padrões díspares entre turmas e cohortes."],
  ["Caminho de recurso claro", "Cada resultado traz o registo que o aluno precisa para o contestar — e um humano para responder."],
];

const SECURITY = [
  "Tratamento de dados alinhado com a proteção de dados",
  "Sem treino de modelos sobre os trabalhos dos alunos",
  "SSO & acesso por papel",
  "Encriptação em trânsito e em repouso",
  "Registo de auditoria completo por nota",
];

export default async function Home() {
  const prof = await getCurrentProfessor();

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
            <a href="#how">Como funciona</a>
            <a href="#safeguards">Salvaguardas</a>
            <a href="#security">Segurança</a>
            <a href="#educators">Para docentes</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {prof ? (
              <a className="btn sm" href="/professor">O meu painel</a>
            ) : (
              <>
                <a href="/login" style={{ fontSize: 14.5, color: "var(--muted)" }}>Entrar</a>
                <a className="btn" href="/registo" style={{ padding: "10px 18px" }}>Começar</a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="site-wrap site-hero">
        <div className="reveal">
          <div className="kicker" style={{ marginBottom: 24 }}>Avaliação com IA · validação humana</div>
          <h1 className="site-h1">A primeira passagem é automática.<br />O juízo continua humano.</h1>
          <p className="site-lead">
            A Avalia avalia os trabalhos contra a tua rubrica em minutos e encaminha cada resultado por revisão do docente e
            salvaguardas de integridade — feedback mais rápido sem nunca abdicar do critério.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 34, flexWrap: "wrap" }}>
            <a className="btn btn-lg" href="/registo">Começar</a>
            <a className="btn secondary btn-lg" href="#how">Ver como funciona</a>
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.7 }}>
            Genérico para qualquer cadeira — tu defines a rubrica.
          </div>
        </div>

        {/* Mock do produto */}
        <div className="reveal mock" style={{ transitionDelay: "150ms" }}>
          <div className="mock-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mark size={18} w={12} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>AED · Trabalho 3</span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>Submissão 14 / 32</span>
          </div>
          <div style={{ padding: "22px 22px 24px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
                  Nota da IA · a aguardar revisão
                </div>
                <div className="serif" style={{ fontSize: 38, lineHeight: 1 }}>
                  88<span style={{ fontSize: 20, color: "var(--faint)" }}> / 100</span>
                </div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(15,118,110,0.1)", color: "#0f766e", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 999 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0f766e" }} />A aguardar o docente
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <Bar label="Tese & argumento" score="27/30" pct={90} />
              <Bar label="Evidência & fontes" score="22/30" pct={73} />
              <Bar label="Estrutura & clareza" score="24/25" pct={96} />
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 15px", marginBottom: 18 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 7 }}>Feedback rascunhado</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>
                Tese forte e bem enquadrada. Aperta o terceiro parágrafo — a afirmação ultrapassa a evidência. Cita a fonte primária diretamente.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn sm" style={{ flex: 1 }}>Aprovar & publicar</button>
              <button className="btn secondary sm" style={{ flex: 1 }}>Ajustar</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 11.5, color: "var(--faint)" }}>
              <span style={{ width: 14, height: 14, border: "1.5px solid var(--faint)", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
              Verificação de integridade limpa · originalidade dentro do esperado
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — cena de scroll fixo */}
      <section id="how" className="band">
        <div data-story className="story-wrap">
          <div className="story-sticky">
            <div className="site-wrap" style={{ width: "100%" }}>
              <div className="kicker" style={{ marginBottom: 6 }}>Como funciona</div>
              <div className="serif" style={{ fontSize: 30, lineHeight: 1.15, margin: "0 0 40px", maxWidth: 520, color: "var(--heading)" }}>
                O docente nunca sai do ciclo.
              </div>
              <div className="story-grid">
                <div className="story-left">
                  <div className="story-rail"><span data-rail-fill /></div>
                  <div className="story-texts">
                    <div className="phase-text" data-phase-text="0">
                      <div className="serif" style={{ fontSize: 22, color: "#0f766e", marginBottom: 12 }}>01</div>
                      <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px", color: "var(--heading)" }}>Alinha à tua rubrica</h3>
                      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, maxWidth: 400 }}>
                        Importa uma rubrica ou cria uma na Avalia. Cada nota mapeia para um critério que definiste — nada é caixa preta.
                      </p>
                    </div>
                    <div className="phase-text abs" data-phase-text="1">
                      <div className="serif" style={{ fontSize: 22, color: "#0f766e", marginBottom: 12 }}>02</div>
                      <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px", color: "var(--heading)" }}>A IA rascunha notas & feedback</h3>
                      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, maxWidth: 400 }}>
                        Cada submissão é avaliada critério a critério, com nota provisória, justificação legível e comentários — mais um sinal de integridade, nunca uma acusação.
                      </p>
                    </div>
                    <div className="phase-text abs" data-phase-text="2">
                      <div className="serif" style={{ fontSize: 22, color: "#0f766e", marginBottom: 12 }}>03</div>
                      <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px", color: "var(--heading)" }}>Revisão e publicação pelo docente</h3>
                      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, maxWidth: 400 }}>
                        O docente confirma, ajusta ou sobrepõe numa fila rápida. Nada chega ao aluno sem um humano assinar por baixo.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="story-mocks">
                  {/* Fase 0 — rubrica */}
                  <div className="phase-mock" data-phase-mock="0">
                    <div className="mock">
                      <div className="mock-head">
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Rubrica · AED Trabalho 3</span>
                        <span className="mono" style={{ fontSize: 11, color: "#0f766e" }}>4 critérios</span>
                      </div>
                      <div style={{ padding: "10px 20px 18px" }}>
                        {[["Tese & argumento", "/ 30"], ["Evidência & fontes", "/ 30"], ["Estrutura & clareza", "/ 25"], ["Mecânica", "/ 15"]].map(([n, m], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                            <span style={{ fontSize: 14.5 }}>{n}</span>
                            <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>{m}</span>
                          </div>
                        ))}
                        <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--faint)" }}>Rubrica importada ✓</div>
                      </div>
                    </div>
                  </div>
                  {/* Fase 1 — IA rascunha */}
                  <div className="phase-mock dim" data-phase-mock="1">
                    <div className="mock">
                      <div className="mock-head">
                        <span style={{ fontSize: 13, fontWeight: 600 }}>AED · Trabalho 3</span>
                        <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#0f766e" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0f766e" }} />IA a rascunhar…
                        </span>
                      </div>
                      <div style={{ padding: "18px 20px 20px" }}>
                        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>Nota rascunhada</div>
                        <div className="serif" style={{ fontSize: 36, lineHeight: 1, marginBottom: 16 }}>88<span style={{ fontSize: 19, color: "var(--faint)" }}> / 100</span></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
                          <Bar label="Tese & argumento" score="27/30" pct={90} />
                          <Bar label="Evidência & fontes" score="22/30" pct={73} />
                          <Bar label="Estrutura & clareza" score="24/25" pct={96} />
                        </div>
                        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>Feedback rascunhado</div>
                          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>Tese forte e bem enquadrada. Aperta o terceiro parágrafo — a afirmação ultrapassa a evidência.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Fase 2 — publicado */}
                  <div className="phase-mock dim" data-phase-mock="2">
                    <div className="mock">
                      <div className="mock-head">
                        <span style={{ fontSize: 13, fontWeight: 600 }}>AED · Trabalho 3</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(15,118,110,0.12)", color: "#0f766e", fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 999 }}>Publicado ao aluno</span>
                      </div>
                      <div style={{ padding: "18px 20px 20px" }}>
                        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>Nota final · confirmada pela Prof. Ramos</div>
                        <div className="serif" style={{ fontSize: 36, lineHeight: 1, marginBottom: 16 }}>90<span style={{ fontSize: 19, color: "var(--faint)" }}> / 100</span></div>
                        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>Feedback · ligeiramente editado pelo docente</div>
                          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>Tese forte e bem enquadrada. Aperta o terceiro parágrafo — e passa no meu horário de atendimento sobre a fonte. Bom progresso.</div>
                        </div>
                        <div style={{ background: "#0f766e", color: "#faf7f1", fontSize: 13.5, fontWeight: 500, padding: 11, borderRadius: 9, textAlign: "center" }}>Aprovado & publicado ✓</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, fontSize: 11.5, color: "var(--faint)" }}>
                          <span style={{ width: 14, height: 14, border: "1.5px solid #0f766e", color: "#0f766e", borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
                          Assinatura humana registada · auditoria guardada
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
        <div className="reveal kicker" style={{ marginBottom: 18 }}>O que recebes</div>
        <h2 className="reveal serif" style={{ fontSize: 44, lineHeight: 1.1, margin: "0 0 52px", maxWidth: 600, color: "var(--heading)" }}>
          Feito para a realidade de uma carga de avaliação real.
        </h2>
        <div data-reveal-group className="feat-grid">
          {FEATURES.map(([ic, t, d]) => (
            <div key={t} className="reveal">
              <div className="feat-ic">{ic}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAFEGUARDS */}
      <section id="safeguards" className="teal-band">
        <div className="site-wrap" style={{ padding: "96px 40px", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 64, alignItems: "center" }}>
          <div className="reveal left">
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(250,247,241,0.7)", marginBottom: 18 }}>Integridade académica</div>
            <h2 className="serif" style={{ fontSize: 44, lineHeight: 1.12, margin: "0 0 20px" }}>Salvaguardas desenhadas por quem já esteve em conselhos de integridade.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "rgba(250,247,241,0.82)", margin: 0 }}>
              A forma mais rápida de perder a confiança do corpo docente é deixar um modelo decidir quem copiou. A Avalia é construída ao contrário: informa o docente e fica fora do veredicto.
            </p>
          </div>
          <div data-reveal-group style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {SAFEGUARDS.map(([t, d]) => (
              <div key={t} className="reveal teal-card">
                <h3 className="serif" style={{ fontSize: 20, margin: "0 0 9px" }}>{t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(250,247,241,0.78)", margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR EDUCATORS */}
      <section id="educators" className="site-wrap site-section">
        <div className="reveal kicker" style={{ marginBottom: 18 }}>Para quem é</div>
        <h2 className="reveal serif" style={{ fontSize: 44, lineHeight: 1.1, margin: "0 0 52px", maxWidth: 600, color: "var(--heading)" }}>
          Uma plataforma, quatro pontos de vista.
        </h2>
        <div data-reveal-group style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {EDUCATORS.map(([t, d]) => (
            <div key={t} className="reveal" style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 32, background: "var(--surface)" }}>
              <h3 className="serif" style={{ fontSize: 24, margin: "0 0 10px", color: "var(--heading)" }}>{t}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="band">
        <div className="site-wrap" style={{ padding: "88px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div className="reveal left">
            <div className="kicker" style={{ marginBottom: 18 }}>Segurança & conformidade</div>
            <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.12, margin: "0 0 18px", color: "var(--heading)" }}>Dados dos alunos tratados como o registo que são.</h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: 0 }}>
              A Avalia é construída para requisitos institucionais desde o dia um — e nunca treina modelos com o trabalho dos teus alunos.
            </p>
          </div>
          <div data-reveal-group style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {SECURITY.map((s, i) => (
              <div key={s} className="reveal" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 4px", borderBottom: i < SECURITY.length - 1 ? "1px solid var(--border-strong)" : "none" }}>
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
        <p className="reveal serif" style={{ fontWeight: 400, fontStyle: "italic", fontSize: 33, lineHeight: 1.35, margin: "0 0 24px", color: "var(--heading)" }}>
          “Construímos a Avalia sobre uma convicção simples: a automação deve dar aos docentes mais tempo para o juízo — nunca menos.”
        </p>
        <div className="reveal mono" style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>A equipa Avalia</div>
      </section>

      {/* FINAL CTA */}
      <section id="demo" className="dark-band">
        <div data-reveal-group className="site-wrap" style={{ padding: "96px 40px", textAlign: "center" }}>
          <h2 className="reveal serif" style={{ fontSize: 48, lineHeight: 1.1, margin: "0 0 18px" }}>Vê a Avalia avaliar um trabalho real.</h2>
          <p className="reveal" style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(250,247,241,0.72)", margin: "0 auto 36px", maxWidth: 520 }}>
            Traz uma das tuas rubricas. Avaliamos uma pilha de exemplo ao vivo — e ficas com a palavra final.
          </p>
          <div className="reveal" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <a className="btn btn-lg" href="/registo">Começar agora</a>
            <a className="btn-lg" href="/login" style={{ border: "1px solid rgba(250,247,241,0.3)", color: "#faf7f1" }}>Já tenho conta</a>
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
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--faint)", margin: 0 }}>
              Avaliação com IA e validação humana, para o ensino superior.
            </p>
          </div>
          <div style={{ display: "flex", gap: 64, fontSize: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>Produto</span>
              <a href="#how" style={{ color: "var(--muted)" }}>Como funciona</a>
              <a href="#safeguards" style={{ color: "var(--muted)" }}>Salvaguardas</a>
              <a href="#security" style={{ color: "var(--muted)" }}>Segurança</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>Conta</span>
              <a href="/login" style={{ color: "var(--muted)" }}>Entrar</a>
              <a href="/registo" style={{ color: "var(--muted)" }}>Criar conta</a>
              <a href="/aluno" style={{ color: "var(--muted)" }}>Área do aluno</a>
            </div>
          </div>
        </div>
        <div className="site-wrap mono" style={{ padding: "20px 40px 40px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--faint)" }}>
          © 2026 Avalia. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

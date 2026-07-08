"use client";

import { useRef, useState } from "react";
import { criarTrabalho, analisarEnunciadoAction } from "@/lib/actions";
import type { AnaliseEnunciado } from "@/lib/evaluate";

interface Crit {
  nome: string;
  descricao: string;
  peso: number;
  pontosMax: number;
}

const TIPOS = ["pdf", "docx", "txt", "zip"];

// Critérios que a IA tende a fazer mal — reforçam a autoria humana.
const CRITERIOS_IA_HARD: Crit[] = [
  { nome: "Reflexão pessoal", descricao: "Ligação a experiência própria, opinião fundamentada ou aprendizagem pessoal.", peso: 0, pontosMax: 20 },
  { nome: "Defesa de escolhas", descricao: "Justifica as decisões tomadas e porque não escolheu as alternativas.", peso: 0, pontosMax: 20 },
  { nome: "Ligação ao contexto da aula", descricao: "Refere conteúdos, exemplos ou dados específicos dados na aula ou pela turma.", peso: 0, pontosMax: 20 },
];

export default function CriarTrabalho({ courseId }: { courseId: string }) {
  const [criterios, setCriterios] = useState<Crit[]>([
    { nome: "Correção técnica", descricao: "", peso: 50, pontosMax: 20 },
    { nome: "Clareza e estrutura", descricao: "", peso: 30, pontosMax: 20 },
    { nome: "Exemplo / aplicação", descricao: "", peso: 20, pontosMax: 20 },
  ]);

  // Análise de resistência do enunciado à IA
  const enunciadoRef = useRef<HTMLTextAreaElement>(null);
  const [analise, setAnalise] = useState<AnaliseEnunciado | null>(null);
  const [aLoading, setALoading] = useState(false);
  const [aTentou, setATentou] = useState(false);

  async function analisar() {
    const enun = enunciadoRef.current?.value?.trim() ?? "";
    if (!enun) return;
    setALoading(true);
    setATentou(true);
    try {
      setAnalise(await analisarEnunciadoAction(enun));
    } catch {
      setAnalise(null);
    } finally {
      setALoading(false);
    }
  }

  const somaPesos = criterios.reduce((s, c) => s + (Number(c.peso) || 0), 0);

  function update(i: number, campo: keyof Crit, valor: string) {
    setCriterios((cs) =>
      cs.map((c, j) =>
        j === i ? { ...c, [campo]: campo === "nome" || campo === "descricao" ? valor : Number(valor) } : c,
      ),
    );
  }
  function add() {
    setCriterios((cs) => [...cs, { nome: "", descricao: "", peso: 0, pontosMax: 20 }]);
  }
  function remove(i: number) {
    setCriterios((cs) => cs.filter((_, j) => j !== i));
  }
  function addIAHard() {
    setCriterios((cs) => {
      const nomes = new Set(cs.map((c) => c.nome.trim().toLowerCase()));
      const novos = CRITERIOS_IA_HARD.filter((c) => !nomes.has(c.nome.toLowerCase()));
      return [...cs, ...novos];
    });
  }

  return (
    <form action={criarTrabalho}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="rubrica" value={JSON.stringify(criterios)} />

      <div className="field">
        <label>Título do trabalho</label>
        <input name="titulo" placeholder="ex: Relatório sobre ordenação O(n log n)" required />
      </div>

      <div className="field">
        <label>Enunciado</label>
        <textarea ref={enunciadoRef} name="enunciado" required placeholder="O que os alunos têm de fazer..." />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn secondary sm" onClick={analisar} disabled={aLoading}>
            {aLoading ? "A analisar…" : "🛡️ Analisar resistência à IA"}
          </button>
          <span className="faint" style={{ fontSize: 12 }}>
            Vê quão facilmente uma IA resolve este enunciado e como o reforçar.
          </span>
        </div>

        {aTentou && !aLoading && !analise && (
          <p className="hint" style={{ marginTop: 10 }}>
            Análise indisponível — precisa de LLM configurado (<code>LLM_API_KEY</code>).
          </p>
        )}

        {analise && (
          <div className="card" style={{ marginTop: 12, background: "var(--surface-2)" }}>
            <div className="row-between">
              <span className="eyebrow">Resistência à IA</span>
              <span
                className={`badge ${
                  analise.nivel === "alta" ? "s-aprovado" : analise.nivel === "média" ? "s-rascunho" : "s-erro"
                }`}
              >
                Resistência {analise.nivel}
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="criterion-top">
                <span className="criterion-name">Resolubilidade por IA</span>
                <span className="criterion-score">{analise.resolubilidade}%</span>
              </div>
              <div className="bar">
                <span
                  style={{
                    width: `${analise.resolubilidade}%`,
                    background:
                      analise.resolubilidade >= 70
                        ? "var(--red)"
                        : analise.resolubilidade >= 40
                        ? "var(--amber)"
                        : "var(--green)",
                  }}
                />
              </div>
            </div>
            {analise.diagnostico && <p className="justif" style={{ marginTop: 10 }}>{analise.diagnostico}</p>}
            {analise.sugestoes.length > 0 && (
              <>
                <p className="eyebrow" style={{ marginTop: 14 }}>Como o tornar à prova de IA</p>
                <ul className="justif" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {analise.sugestoes.map((s, i) => (
                    <li key={i} style={{ marginBottom: 5 }}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label>Tipos de ficheiro aceites</label>
        <div className="chips">
          {TIPOS.map((t) => (
            <label key={t} className="chip">
              <input type="checkbox" name="tiposFicheiro" value={t} defaultChecked={t !== "zip"} /> {t.toUpperCase()}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Rubrica <span className="help">(critério, peso % e escala de pontos)</span></label>
        {criterios.map((c, i) => (
          <div key={i} className="rubric-row">
            <div>
              <div className="lbl">Critério</div>
              <input value={c.nome} onChange={(e) => update(i, "nome", e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <div className="lbl">Descrição (guia p/ a IA)</div>
              <textarea value={c.descricao} onChange={(e) => update(i, "descricao", e.target.value)} placeholder="O que avaliar neste critério" />
            </div>
            <div>
              <div className="lbl">Peso %</div>
              <input type="number" value={c.peso} onChange={(e) => update(i, "peso", e.target.value)} min={0} max={100} />
            </div>
            <div>
              <div className="lbl">Máx</div>
              <input type="number" value={c.pontosMax} onChange={(e) => update(i, "pontosMax", e.target.value)} min={1} />
            </div>
            <button type="button" className="btn ghost sm" onClick={() => remove(i)} title="Remover" style={{ marginTop: 20 }}>✕</button>
          </div>
        ))}
        <div className="row-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="btn-row">
            <button type="button" className="btn secondary sm" onClick={add}>+ Adicionar critério</button>
            <button type="button" className="btn secondary sm" onClick={addIAHard} title="Critérios que a IA faz mal">
              🛡️ + Critérios resistentes a IA
            </button>
          </div>
          <span className={`weight-note ${somaPesos === 100 ? "ok" : "warn"}`}>
            Soma dos pesos: {somaPesos}% {somaPesos === 100 ? "✓" : "(recomendado 100%)"}
          </span>
        </div>
      </div>

      <details className="disclosure">
        <summary>Opções avançadas</summary>
        <div style={{ marginTop: 14 }}>
          <div className="field">
            <label>Instruções extra de avaliação <span className="help">(opcional)</span></label>
            <textarea name="instrucoes" placeholder="ex: penaliza afirmações incorretas sobre complexidade" />
          </div>
          <div className="field">
            <label>Solução-modelo <span className="help">(opcional — a IA compara contra isto)</span></label>
            <textarea name="solucaoModelo" placeholder="Resposta de referência" />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="feedbackImediato" /> Mostrar feedback ao aluno logo após submeter
          </label>
        </div>
      </details>

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button className="btn" type="submit">Criar trabalho</button>
      </div>
    </form>
  );
}

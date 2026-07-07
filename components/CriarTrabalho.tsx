"use client";

import { useState } from "react";
import { criarTrabalho } from "@/lib/actions";

interface Crit {
  nome: string;
  descricao: string;
  peso: number;
  pontosMax: number;
}

const TIPOS = ["pdf", "docx", "txt", "zip"];

export default function CriarTrabalho({ courseId }: { courseId: string }) {
  const [criterios, setCriterios] = useState<Crit[]>([
    { nome: "Correção técnica", descricao: "", peso: 50, pontosMax: 20 },
    { nome: "Clareza e estrutura", descricao: "", peso: 30, pontosMax: 20 },
    { nome: "Exemplo / aplicação", descricao: "", peso: 20, pontosMax: 20 },
  ]);

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
        <textarea name="enunciado" required placeholder="O que os alunos têm de fazer..." />
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
        <div className="row-between">
          <button type="button" className="btn secondary sm" onClick={add}>+ Adicionar critério</button>
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

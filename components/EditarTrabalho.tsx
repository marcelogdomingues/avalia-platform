"use client";

import { useState } from "react";
import { editarTrabalho } from "@/lib/actions";
import TestSuiteEditor, { type TestSuiteValor } from "./TestSuiteEditor";
import { ESCALAS } from "@/lib/escala";

interface Crit { nome: string; descricao: string; peso: number; pontosMax: number; }
const TIPOS = ["pdf", "docx", "txt", "zip"];

export default function EditarTrabalho({
  assignmentId, titulo, enunciado, tipos, instrucoes, solucaoModelo, feedbackImediato, escala, prazo, politicaAtraso, penalizacaoAtraso, grupo, avaliacaoPares, rubrica, testSuite,
}: {
  assignmentId: string;
  titulo: string;
  enunciado: string;
  tipos: string[];
  instrucoes: string;
  solucaoModelo: string;
  feedbackImediato: boolean;
  escala: string;
  prazo: string; // datetime-local ("" se nenhum)
  politicaAtraso: string;
  penalizacaoAtraso: number;
  grupo: boolean;
  avaliacaoPares: boolean;
  rubrica: Crit[];
  testSuite: TestSuiteValor | null;
}) {
  const [criterios, setCriterios] = useState<Crit[]>(rubrica.length ? rubrica : [{ nome: "", descricao: "", peso: 100, pontosMax: 20 }]);
  const soma = criterios.reduce((s, c) => s + (Number(c.peso) || 0), 0);

  const update = (i: number, campo: keyof Crit, v: string) =>
    setCriterios((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: campo === "nome" || campo === "descricao" ? v : Number(v) } : c)));
  const add = () => setCriterios((cs) => [...cs, { nome: "", descricao: "", peso: 0, pontosMax: 20 }]);
  const remove = (i: number) => setCriterios((cs) => cs.filter((_, j) => j !== i));

  return (
    <form action={editarTrabalho}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="rubrica" value={JSON.stringify(criterios)} />

      <div className="field"><label>Título do trabalho</label><input name="titulo" defaultValue={titulo} required /></div>
      <div className="field"><label>Enunciado</label><textarea name="enunciado" defaultValue={enunciado} required /></div>

      <div className="field">
        <label>Tipos de ficheiro aceites</label>
        <div className="chips">
          {TIPOS.map((t) => (
            <label key={t} className="chip">
              <input type="checkbox" name="tiposFicheiro" value={t} defaultChecked={tipos.includes(t)} /> {t.toUpperCase()}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Rubrica</label>
        {criterios.map((c, i) => (
          <div key={i} className="rubric-row">
            <div><div className="lbl">Critério</div><input value={c.nome} onChange={(e) => update(i, "nome", e.target.value)} /></div>
            <div><div className="lbl">Descrição</div><textarea value={c.descricao} onChange={(e) => update(i, "descricao", e.target.value)} /></div>
            <div><div className="lbl">Peso %</div><input type="number" value={c.peso} onChange={(e) => update(i, "peso", e.target.value)} /></div>
            <div><div className="lbl">Máx</div><input type="number" value={c.pontosMax} onChange={(e) => update(i, "pontosMax", e.target.value)} /></div>
            <button type="button" className="btn ghost sm" onClick={() => remove(i)} style={{ marginTop: 20 }}>✕</button>
          </div>
        ))}
        <div className="row-between">
          <button type="button" className="btn secondary sm" onClick={add}>+ Adicionar critério</button>
          <span className={`weight-note ${soma === 100 ? "ok" : "warn"}`}>Soma dos pesos: {soma}%</span>
        </div>
      </div>

      <TestSuiteEditor inicial={testSuite} />

      <details className="disclosure">
        <summary>Opções avançadas</summary>
        <div style={{ marginTop: 14 }}>
          <div className="field"><label>Instruções extra</label><textarea name="instrucoes" defaultValue={instrucoes} /></div>
          <div className="field"><label>Solução-modelo</label><textarea name="solucaoModelo" defaultValue={solucaoModelo} /></div>
          <div className="field">
            <label>Escala de notação</label>
            <select name="escala" defaultValue={escala}>
              {ESCALAS.map((e) => <option key={e.v} value={e.v}>{e.l} — ex: {e.ex}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Prazo de entrega <span className="help">(opcional)</span></label>
            <input name="prazo" type="datetime-local" defaultValue={prazo} />
          </div>
          <div className="field">
            <label>Fora de prazo</label>
            <select name="politicaAtraso" defaultValue={politicaAtraso}>
              <option value="aceitar">Aceitar, marcando como fora de prazo</option>
              <option value="bloquear">Bloquear entregas após o prazo</option>
            </select>
          </div>
          <div className="field">
            <label>Penalização por dia de atraso <span className="help">(%)</span></label>
            <input name="penalizacaoAtraso" type="number" min={0} max={100} defaultValue={penalizacaoAtraso} />
          </div>
          <label className="checkbox"><input type="checkbox" name="grupo" defaultChecked={grupo} /> Trabalho de grupo (o aluno indica os membros)</label>
          <label className="checkbox"><input type="checkbox" name="avaliacaoPares" defaultChecked={avaliacaoPares} /> Ativar avaliação por pares</label>
          <label className="checkbox"><input type="checkbox" name="feedbackImediato" defaultChecked={feedbackImediato} /> Mostrar feedback ao aluno logo após submeter</label>
        </div>
      </details>

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button className="btn" type="submit">Guardar alterações</button>
        <a className="btn secondary" href={`/professor/trabalho/${assignmentId}`}>Cancelar</a>
      </div>
    </form>
  );
}

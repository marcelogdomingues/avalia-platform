"use client";

// Botão que dispara a impressão do navegador (guardar como PDF). Escondido na impressão.
export default function PrintButton() {
  return (
    <button className="btn no-print" onClick={() => window.print()} style={{ padding: "10px 18px" }}>
      ⎙ Imprimir / Guardar PDF
    </button>
  );
}

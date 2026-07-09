# Segurança

Resumo do modelo de ameaças e das defesas do Avalia. O caso mais sensível é
**correr código de alunos** (não confiável) e **lidar com dados de estudantes**.

## Execução de código não confiável (autograder)

Cada submissão de código corre num **contentor Docker efémero e isolado**:

| Controlo | Flag | Protege contra |
|---|---|---|
| Sem rede | `--network none` | exfiltração de dados, chamadas a serviços externos |
| Memória limitada | `--memory 512m` | *memory bombs*, esgotar a RAM do host |
| CPU limitada | `--cpus 1` | monopolizar o CPU |
| Limite de processos | `--pids-limit 128` | *fork bombs* |
| Timeout | `timeout` no comando + timeout do `docker run` | loops infinitos |
| Testes read-only | montados `:ro` | o aluno adulterar os testes |
| Efémero | `--rm` | persistência entre execuções |
| Sem privilégios | `USER runner` nas imagens | escalada dentro do contentor |
| Concorrência | semáforo (`RUNNER_CONCURRENCY`) | esgotar recursos com muitas submissões |

**Cenários provados** (bloqueados, ver `scripts/seed.ts` → "Cenários de sandbox"):
loop infinito, *fork storm*, *memory bomb*, acesso à rede e erros de compilação.

**Produção:** o web app (ex.: Vercel) não corre Docker. Usa `RUNNER_MODE=remote`
para delegar num *grader* isolado (VPS, servidor da faculdade, Piston/Judge0),
ou `RUNNER_MODE=off` para desativar. Ver `grader/README.md`.

## Sessões e autenticação

- Passwords com **scrypt** (salt aleatório por utilizador), comparação *timing-safe*.
- Sessões em **cookie assinado por HMAC-SHA256** — `httpOnly`, `sameSite=lax`,
  `secure` em produção.
- **`AUTH_SECRET` é obrigatório em produção** — sem ele a app recusa arrancar
  (evita que o segredo de dev, público, permita forjar sessões). Gera um forte:
  `openssl rand -base64 32`.

## Isolamento e privacidade de dados

- **Multi-tenant:** tudo pende de `Professor`; cada query filtra por `professorId`
  / `courseId`. Um professor nunca vê dados de outro.
- **Alunos** veem apenas as próprias submissões; a nota só aparece após o professor
  **publicar** (validação humana obrigatória).
- **LLM:** o conteúdo submetido é enviado ao fornecedor de LLM configurado. Para
  dados que não podem sair da instituição, usa um modelo **on-prem** (vLLM/Ollama)
  — basta trocar `LLM_BASE_URL`, sem mudar código.

## Segredos

- `.env` está no `.gitignore` e nunca é versionado.
- Chaves de API (LLM, `RUNNER_TOKEN`) só em variáveis de ambiente.
- Se uma chave for exposta (ex.: partilhada em chat), **roda-a** — considera-a comprometida.

## Checklist de produção

- [ ] `AUTH_SECRET` forte e único definido no ambiente.
- [ ] `DATABASE_URL` para Postgres (não o SQLite de dev).
- [ ] `RUNNER_MODE=remote` com um grader isolado, ou `off`.
- [ ] Chaves de LLM/grader rodadas e fora do repositório.
- [ ] HTTPS à frente da app (cookies `secure`).
- [ ] Backups da base de dados.

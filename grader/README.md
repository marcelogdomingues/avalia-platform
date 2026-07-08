# Avalia — grader remoto

Serviço isolado que corre os testes do professor contra o código do aluno em
contentores Docker, com limite de concorrência. É o backend do modo
`RUNNER_MODE=remote` do web app (que **não** corre Docker — ex.: Vercel).

```
web app (Vercel)  ──POST /run──►  grader (VPS/faculdade, com Docker)  ──►  contentor isolado
```

## Correr localmente

```bash
# 1. Construir a(s) imagem(ns) de runner (uma vez)
docker build -t avalia-runner-python -f runner/Dockerfile.python runner

# 2. Arrancar o grader
RUNNER_TOKEN=um-segredo RUNNER_CONCURRENCY=2 node grader/server.mjs
# → Avalia grader :4000

# 3. No web app (.env):
#    RUNNER_MODE=remote
#    RUNNER_URL=http://localhost:4000/run
#    RUNNER_TOKEN=um-segredo
```

## Deploy (grátis / barato, long-term)

O grader precisa de **Docker**. Opções:

- **VPS pequeno (~5€/mês)** ou **servidor da faculdade**: instala Docker, corre
  `node grader/server.mjs` como serviço (systemd/pm2), atrás de HTTPS. Constrói as
  imagens de runner uma vez. É a opção mais barata e controlada.
- **Fly.io / Render**: containeriza o grader **com acesso ao Docker daemon**
  (montar `/var/run/docker.sock`) ou usa uma VM dedicada.
- **Modal / serverless-container**: adaptar o `run()` para lançar a execução na
  plataforma (tier grátis, escala a pedido).
- **Piston / Judge0** self-host: alternativa pronta multi-linguagem — troca o
  `run()` por uma chamada à API deles (o contrato do web app não muda).

## Segurança
Cada execução corre com `--network none`, `--memory 512m`, `--cpus 1`,
`--pids-limit 128`, timeout, e os testes montados **read-only**. Concorrência
limitada por `RUNNER_CONCURRENCY`. Protege com `RUNNER_TOKEN` e HTTPS.

## Juntar linguagens
Em `server.mjs`, adiciona ao `LANGS` a imagem Docker + o comando + o parser
(ex.: Java/JUnit → imagem com JDK+JUnit; Dart → `dart test`).

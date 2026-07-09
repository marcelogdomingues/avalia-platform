# Autograder para C (convenção TAP: o teste do professor imprime 'ok/not ok - nome').
# docker build -t avalia-runner-c -f runner/Dockerfile.c runner
# Isolado em runtime: --network none --memory 512m --cpus 1 --pids-limit 128.
FROM alpine:3.20
RUN apk add --no-cache gcc musl-dev && adduser -D runner
USER runner
WORKDIR /work

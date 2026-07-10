# Autograder para PHP (convenção TAP: o teste imprime 'ok/not ok - nome').
# docker build -t avalia-runner-php -f runner/Dockerfile.php runner
# Isolado em runtime: --network none --memory 512m --cpus 1 --pids-limit 128.
FROM php:8.3-cli-alpine
RUN adduser -D runner
USER runner
WORKDIR /work

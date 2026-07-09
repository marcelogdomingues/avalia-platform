# Autograder para C++ (convenção TAP: o teste imprime 'ok/not ok - nome').
# docker build -t avalia-runner-cpp -f runner/Dockerfile.cpp runner
# Isolado em runtime: --network none --memory 512m --cpus 1 --pids-limit 128.
FROM alpine:3.20
RUN apk add --no-cache g++ && adduser -D runner
USER runner
WORKDIR /work

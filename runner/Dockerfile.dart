# Autograder para Dart (convenção TAP: o teste imprime 'ok/not ok - nome').
# docker build -t avalia-runner-dart -f runner/Dockerfile.dart runner
# Isolado em runtime: --network none --memory 512m --cpus 1 --pids-limit 128.
FROM dart:stable
RUN useradd -m runner || adduser -D runner
USER runner
WORKDIR /work

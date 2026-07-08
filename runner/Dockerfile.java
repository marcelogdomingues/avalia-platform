# Imagem do autograder para Java (JUnit 5).
# Construir uma vez:  docker build -t avalia-runner-java -f runner/Dockerfile.java runner
# O lib/runner.ts corre esta imagem por submissão, isolada:
#   --network none --memory 512m --cpus 1 --pids-limit 128, testes montados read-only.
#
# Traz o JDK + o junit-platform-console-standalone (compila e corre sem rede em runtime;
# o jar é embebido na imagem, por isso a execução do aluno nunca acede à internet).
FROM eclipse-temurin:21-jdk-jammy
ARG JUNIT_VERSION=1.11.3
RUN mkdir -p /opt/junit && \
    curl -fsSL -o /opt/junit/junit.jar \
      "https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/${JUNIT_VERSION}/junit-platform-console-standalone-${JUNIT_VERSION}.jar"
RUN useradd -m runner
USER runner
WORKDIR /work

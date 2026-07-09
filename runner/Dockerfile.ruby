# Autograder para Ruby (minitest, na stdlib).
# docker build -t avalia-runner-ruby -f runner/Dockerfile.ruby runner
# Isolado em runtime: --network none --memory 512m --cpus 1 --pids-limit 128.
FROM ruby:3.3-slim
RUN useradd -m runner
USER runner
WORKDIR /work

# Autograder para Go (go test).
# docker build -t avalia-runner-go -f runner/Dockerfile.go runner
# Isolado em runtime: --network none --memory 512m --cpus 1 --pids-limit 128.
FROM golang:1.22-alpine
RUN adduser -D runner
USER runner
ENV GOCACHE=/tmp/gocache GOPATH=/tmp/gopath GOPROXY=off GOFLAGS=-mod=mod
WORKDIR /work

FROM ghcr.io/lavalink-devs/lavalink:4

USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl wget && rm -rf /var/lib/apt/lists/*
USER lavalink

COPY application.yml /opt/Lavalink/application.yml


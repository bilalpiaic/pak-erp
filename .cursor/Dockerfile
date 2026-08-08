# Base image for the GarmentLoop ERP Cloud Agent environment.
# Pins Node 22 and provides a local PostgreSQL server for development.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       git \
       postgresql \
       postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*

USER node

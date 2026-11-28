FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends qpdf && rm -rf /var/lib/apt/lists/*
RUN install -d -m 0700 -o node -g node /var/lib/vesselwatch/files
WORKDIR /app
COPY package.json ./
# A lockfile must be generated and reviewed before a release.
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node","src/server.js"]

FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
# A lockfile must be generated and reviewed before a release.
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node","src/server.js"]

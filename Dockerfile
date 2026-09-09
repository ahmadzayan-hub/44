# RailMind Agent OS: static preview + decision API. No build step; Node strips types at runtime.
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs index.html ./
COPY src ./src
COPY web ./web
COPY infra/sql ./infra/sql
EXPOSE 4173
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4173/api/health || exit 1
CMD ["node", "--experimental-strip-types", "server.mjs"]

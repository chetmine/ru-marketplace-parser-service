FROM node:20-bookworm AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY . .
RUN npm run build

FROM node:20-bookworm AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

RUN echo "Installing firefox for playwright..." && npx playwright install firefox
RUN echo "Installing camoufox..." && npx camoufox-js fetch

RUN echo "Installing additional dependencies for camoufox..."
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libgtk-3-0 \
    libasound2 \
    libx11-xcb1

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

COPY --from=builder /app/scripts/entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN ls -la

ENTRYPOINT ["./entrypoint.sh"]

RUN echo "Container started."
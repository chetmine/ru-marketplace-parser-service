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

CMD ["echo", "Installing firefox for playwright..."]
RUN npx playwright install firefox
CMD ["echo", "Installing camoufox..."]
RUN npx camoufox-js fetch

CMD ["echo", "Installing additional dependencies for camoufox..."]
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

ENTRYPOINT ["./entrypoint.sh"]

CMD ["echo", "Container started."]
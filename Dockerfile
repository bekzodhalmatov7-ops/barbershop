FROM node:20-alpine

WORKDIR /app

# Устанавливаем зависимости отдельным слоем для кэша.
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && apk del .build-deps

# Копируем исходники и статику
COPY src ./src
COPY public ./public

# Директория для SQLite — смонтируем как volume
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/barbershop.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
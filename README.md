# Marketplace Parser Service

[![Node.js Version](https://img.shields.io/badge/Node.js-v22.22.1-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

Готовый к production микросервис для автоматизированного сбора (парсинга) данных о товарах с российских маркетплейсов. Построен на базе Node.js, TypeScript, Express, Playwright (со stealth-плагинами) и использует RabbitMQ для асинхронного взаимодействия.

Поддерживаемые площадки: **Ozon**, **Wildberries**, **Yandex Market**, **MegaMarket**, **Magnit Market**, **Alikson**.

Для подробного изучения архитектуры и внутреннего устройства микросервиса обратитесь к [Документации проекта (DOCUMENTATION.md)](DOCUMENTATION.md).

---

## 🛠 Технологический стек

* **Core:** Node.js v22.22.1, TypeScript 5.5, Express 5.2
* **Автоматизация:** Playwright, playwright-extra, puppeteer-extra-plugin-stealth, camoufox-js
* **БД и Кэш:** PostgreSQL (с Prisma ORM), Redis (ioredis)
* **Очереди сообщений:** RabbitMQ (amqplib)
* **Архитектура:** Service-Repository, Dependency Injection (Awilix)

---

## ⚙️ Требования к окружению

Для успешного запуска проекта локально или на сервере требуются:
- **Node.js**: v22.22.0 или выше (с поддержкой `--experimental-strip-types`)
- **Docker** и **Docker Compose** (для быстрого развертывания инфраструктуры)

---

## 📦 Конфигурация (.env)

Для конфигурации сервиса создайте файл `.env` в корне проекта (или скопируйте `.env.example`).
Основные переменные окружения:

```env
# Project env
SERVER_PORT=1488

# Redis
REDIS_HOST=0.0.0.0
REDIS_PORT=6379
REDIS_USER=parser_service
REDIS_PASSWORD=PASSWORD

# Database
# DB Url. Here's example for Postgres SQL
DATABASE_URL=postgresql://parser_service:ENCODED_URL_PASSWORD@0.0.0.0:5432/parser_db

# RabbitMQ
RABBITMQ_CONNECTION_URL=amqp://parser_service:ENCODED_URL_PASSWORD@0.0.0.0:5672

# JWT Secret
JWT_SECRET=STRONG_JWT_HASH
```

---

## 🚀 Установка и запуск

Проект предоставляет готовые `docker-compose` файлы для удобного развертывания.

### Запуск через Docker (Production)
```bash
docker-compose -f docker-compose-prod.yml up -d --build
```

### Запуск через Docker (Development)
```bash
docker-compose -f docker-compose-dev.yml up -d --build
```

### Локальный запуск (без Docker)
Если инфраструктура (Redis, PostgreSQL, RabbitMQ) развернута отдельно, вы можете запустить сервис напрямую:

1. Установите зависимости (если необходимо):
   ```bash
   npm install
   ```
2. Примените миграции базы данных и сгенерируйте Prisma клиент:
   ```bash
   npm run db:deploy
   ```
3. Запустите проект в режиме разработки:
   ```bash
   npm run dev
   ```
4. Либо соберите и запустите проект для production:
   ```bash
   npm run build
   npm run prod
   ```

---

## 🧪 Тестирование
Для запуска модульных тестов, написанных с использованием встроенного тест-раннера Node.js (`node:test`), выполните:
```bash
npm run test
```
*Обратите внимание: тесты запускаются с флагом `--experimental-strip-types` для прямой поддержки TypeScript.*

---

## 📄 Лицензия
Этот проект распространяется по лицензии [ISC](LICENSE).

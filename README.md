# ✂️ Барбершоп — система онлайн-записи

REST API + SPA для онлайн-записи в барбершоп и админ-панель для управления
услугами, мастерами, рабочими часами и записями. Плюс Telegram-бот для
записи и уведомлений.

## Возможности

**Клиент** (`/`)
- Запись через веб: услуга → дата → время → контакты → подтверждение
- Ссылка для самоотмены (`/booking/?id=..&token=..`)
- Подписка на уведомления в Telegram (deep-link)

**Telegram-бот**
- `/book` — запись прямо в чате (услуга → дата → время → имя → телефон)
- `/my` — список предстоящих записей с кнопками отмены
- `/cancel` — отмена текущего диалога
- Кнопка «📱 Поделиться контактом» — телефон одним тапом
- Inline-кнопки, rate limit, дедуп

**Админ** (`/admin/`)
- Логин по паролю → JWT
- Записи с фильтрами (дата / статус / телефон), перенос, отмена, ручное создание
- CRUD услуг (мягкое удаление) и мастеров
- Глобальные рабочие часы + **индивидуальное расписание мастера**
- Тест Telegram-уведомлений

## Стек

- **Backend:** Node.js 20 + Express
- **БД:** SQLite (`better-sqlite3`), WAL
- **Auth:** JWT + bcrypt
- **Валидация:** zod
- **Frontend:** vanilla HTML/CSS/JS
- **Уведомления:** Telegram Bot API (webhook + callbacks)

## Быстрый старт

```bash
npm install
cp .env.example .env
# отредактируйте .env (JWT_SECRET, ADMIN_PASSWORD, TELEGRAM_*)
npm run migrate
npm run dev
```

- Клиент: <http://localhost:3000/>
- Админка: <http://localhost:3000/admin/>
- Healthcheck: <http://localhost:3000/health>

**Логин админа по умолчанию:** `admin` / `admin123`. Смените после первого входа.

## Настройка Telegram

1. Создайте бота через **@BotFather** (`/newbot`) → получите токен.
2. Узнайте свой `chat_id` через **@userinfobot**.
3. Заполните `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=1234567890:AAH-xxx...
   TELEGRAM_BOT_USERNAME=MyBarberBot
   TELEGRAM_ADMIN_CHAT_IDS=123456789
   ```
4. Для приёма апдейтов нужен публичный HTTPS — используйте ngrok в dev:
   ```bash
   ngrok http 3000
   ```
   и в `.env`:
   ```env
   PUBLIC_BASE_URL=https://xxxx.ngrok-free.app
   TELEGRAM_WEBHOOK_URL=https://xxxx.ngrok-free.app/api/telegram/webhook
   TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 24>
   ```
5. Перезапустите сервер — он сам установит webhook.

## Запуск через Docker

```bash
cp .env.example .env
# заполните JWT_SECRET, ADMIN_PASSWORD, TELEGRAM_*
docker compose up -d --build
docker compose logs -f app
```

Данные БД сохраняются в volume `barbershop_data`.

## Структура

```
.
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .dockerignore
├── package.json
├── README.md
├── data/                        # SQLite (автосоздаётся)
├── public/                      # SPA клиента + админка + страница отмены
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── admin/
│   └── booking/
├── scripts/
│   └── check-race.sh
└── src/
    ├── server.js
    ├── db.js
    ├── routes/
    ├── controllers/
    ├── services/
    ├── middlewares/
    └── utils/
```

## API

### Публичные

| Метод | Путь |
|---|---|
| GET | `/api/services` |
| GET | `/api/masters` |
| GET | `/api/slots?service_id=&date=&master_id=` |
| POST | `/api/bookings` (rate limit 5/мин/IP) |
| GET | `/api/bookings/:id?token=` |
| DELETE | `/api/bookings/:id?token=` |
| POST | `/api/telegram/webhook` |

### Админские (JWT)

| Метод | Путь |
|---|---|
| POST | `/api/admin/login` |
| GET | `/api/admin/me` |
| GET/POST/PATCH | `/api/admin/bookings[/:id]` |
| GET/POST/PUT/DELETE | `/api/admin/services[/:id]` |
| GET/POST/PUT/DELETE | `/api/admin/masters[/:id]` |
| GET/PUT/DELETE | `/api/admin/masters/:id/working-hours[/:day]` |
| GET/PUT | `/api/admin/working-hours[/:day]` |
| POST | `/api/admin/telegram/test` |

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `PORT` | нет | HTTP-порт (3000) |
| `PUBLIC_BASE_URL` | для ссылок | Публичный URL |
| `DB_PATH` | нет | SQLite |
| `JWT_SECRET` | **да в prod** | Секрет JWT |
| `JWT_EXPIRES_IN` | нет | TTL токена (8h) |
| `CORS_ORIGIN` | нет | Origin фронта |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | нет | Создаётся при migrate |
| `TELEGRAM_ENABLED` | нет | `false` — полностью выключить |
| `TELEGRAM_BOT_TOKEN` | для TG | Токен бота |
| `TELEGRAM_BOT_USERNAME` | для deep-link | Username без `@` |
| `TELEGRAM_ADMIN_CHAT_IDS` | для TG-админов | Список через запятую |
| `TELEGRAM_WEBHOOK_URL` | для /start и callback | Публичный HTTPS |
| `TELEGRAM_WEBHOOK_SECRET` | реком. | Проверка заголовка |
| `TELEGRAM_CLIENT_NOTIFICATIONS` | нет | `false` — не писать клиентам |
| `TELEGRAM_RATE_LIMIT_PER_MIN` | нет | Лимит сообщений на чат в минуту |
| `TELEGRAM_DEDUP_WINDOW_SECONDS` | нет | Окно дедупа |

## Безопасность

- Пароли админов — bcrypt-хэши
- JWT с ограниченным TTL
- Rate limit: логин 10/5 мин, публичные брони 5/мин на IP, Telegram per-chat
- Webhook защищён `X-Telegram-Bot-Api-Secret-Token`
- HTML-escape всех пользовательских полей в сообщениях
- Валидация через zod
- Защита от race condition: `BEGIN IMMEDIATE` + повторная проверка пересечений
- Токен самоотмены — 32 hex-символа, проверяется на сервере
- Публичная проекция брони не содержит телефона и chat_id
- В prod: HTTPS + уникальный `JWT_SECRET`

## Проверка race condition

```bash
chmod +x scripts/check-race.sh
./scripts/check-race.sh
```

5 параллельных `POST /api/bookings` на один слот → ожидается **1×201** и **4×409**.

## Скрипты npm

| Команда | Что делает |
|---|---|
| `npm run migrate` | Схема БД + сиды |
| `npm run dev` | nodemon |
| `npm start` | production-запуск |

## Лицензия

MIT.
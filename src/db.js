const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './data/barbershop.db';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          VARCHAR(100) NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price         DECIMAL(10,2) NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT 1,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS masters (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      VARCHAR(100) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id    INTEGER NOT NULL,
      master_id     INTEGER,
      client_name   VARCHAR(100) NOT NULL,
      client_phone  VARCHAR(20)  NOT NULL,
      client_email  VARCHAR(100),
      booking_date  DATE NOT NULL,
      start_time    TIME NOT NULL,
      end_time      TIME NOT NULL,
      status        TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed','cancelled')),
      comment       TEXT,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (master_id)  REFERENCES masters(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_date_master
      ON bookings(booking_date, master_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_phone
      ON bookings(client_phone);

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      login         VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      day_of_week INTEGER PRIMARY KEY,
      open_time   TIME NOT NULL,
      close_time  TIME NOT NULL,
      is_day_off  BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS master_working_hours (
      master_id   INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      open_time   TIME NOT NULL,
      close_time  TIME NOT NULL,
      is_day_off  BOOLEAN NOT NULL DEFAULT 0,
      PRIMARY KEY (master_id, day_of_week),
      FOREIGN KEY (master_id) REFERENCES masters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mwh_master
      ON master_working_hours(master_id);

    -- Каталог стрижек и стилей
    CREATE TABLE IF NOT EXISTS portfolio (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        VARCHAR(120) NOT NULL,
      description  TEXT,
      image_url    VARCHAR(500) NOT NULL,
      service_id   INTEGER,
      tags         TEXT,
      price_hint   DECIMAL(10,2),
      sort_order   INTEGER NOT NULL DEFAULT 0,
      is_active    BOOLEAN NOT NULL DEFAULT 1,
      created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_active_sort
      ON portfolio(is_active, sort_order, id);
  `);

  ensureColumn('bookings', 'client_link_token', 'TEXT');
  ensureColumn('bookings', 'client_telegram_chat_id', 'TEXT');

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_link_token
      ON bookings(client_link_token)
      WHERE client_link_token IS NOT NULL;
  `);

  seedDefaults();
  require('./utils/seedAdmin').seedDefaultAdmin();
}

function seedDefaults() {
  const whCount = db.prepare('SELECT COUNT(*) AS c FROM working_hours').get().c;
  if (whCount === 0) {
    const insertWh = db.prepare(
      `INSERT INTO working_hours (day_of_week, open_time, close_time, is_day_off)
       VALUES (?, ?, ?, ?)`
    );
    const seed = db.transaction(() => {
      for (let d = 0; d <= 6; d++) {
        insertWh.run(d, '10:00', '20:00', d === 0 ? 1 : 0);
      }
    });
    seed();
  }

  const svcCount = db.prepare('SELECT COUNT(*) AS c FROM services').get().c;
  if (svcCount === 0) {
    const insertSvc = db.prepare(
      `INSERT INTO services (name, duration_minutes, price, is_active)
       VALUES (?, ?, ?, 1)`
    );
    const seed = db.transaction(() => {
      insertSvc.run('Стрижка', 30, 150);
      insertSvc.run('Стрижка + борода', 60, 250);
      insertSvc.run('Оформление бороды', 30, 120);
    });
    seed();
  }

  const pfCount = db.prepare('SELECT COUNT(*) AS c FROM portfolio').get().c;
  if (pfCount === 0) {
    const insertPf = db.prepare(
      `INSERT INTO portfolio
         (title, description, image_url, service_id, tags, price_hint, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    );
    const seed = db.transaction(() => {
      const items = [
        {
          title: 'Классический фейд',
          description: 'Плавный переход от коротких висков к длинной верхней части. Универсальный вариант для делового и повседневного стиля.',
          image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80',
          tags: 'фейд,классика,короткие',
          price: 180,
        },
        {
          title: 'Crop / Текстурная стрижка',
          description: 'Короткие бока и текстурная верхняя часть. Смотрится стильно с укладкой помадой или глиной.',
          image: 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?w=800&q=80',
          tags: 'crop,текстура,молодёжные',
          price: 200,
        },
        {
          title: 'Помпадур',
          description: 'Классика 50-х с объёмной передней частью. Требует ежедневной укладки, но выглядит безупречно.',
          image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
          tags: 'помпадур,классика,ретро',
          price: 220,
        },
        {
          title: 'Buzz Cut',
          description: 'Максимально короткая стрижка машинкой. Минимум ухода, максимум практичности.',
          image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80',
          tags: 'короткие,машинка,спорт',
          price: 100,
        },
        {
          title: 'Андеркат',
          description: 'Контрастная стрижка: выбритые виски и длинная верхняя часть. Отлично сочетается с бородой.',
          image: 'https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?w=800&q=80',
          tags: 'андеркат,контраст,борода',
          price: 200,
        },
        {
          title: 'Оформление бороды',
          description: 'Моделирование формы, работа с контурами и уход. Идеально дополняет любую стрижку.',
          image: 'https://images.unsplash.com/photo-1622286346003-c5c7e63b1088?w=800&q=80',
          tags: 'борода,уход,контуры',
          price: 120,
        },
        {
          title: 'Side Part',
          description: 'Аккуратный боковой пробор — строгий деловой стиль. Смотрится элегантно в любой ситуации.',
          image: 'https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=800&q=80',
          tags: 'side part,деловой,классика',
          price: 180,
        },
        {
          title: 'Мужские короткие с выбритым пробором',
          description: 'Современная интерпретация классики с чётким выбритым пробором.',
          image: 'https://images.unsplash.com/photo-1593702288056-f5348f5e0f0f?w=800&q=80',
          tags: 'пробор,короткие,современные',
          price: 200,
        },
      ];
      items.forEach((it, i) => {
        insertPf.run(
          it.title,
          it.description,
          it.image,
          null,
          it.tags,
          it.price,
          i
        );
      });
    });
    seed();
  }
}

if (require.main === module) {
  initSchema();
  console.log('✅ Схема БД инициализирована:', DB_PATH);
  process.exit(0);
}

initSchema();
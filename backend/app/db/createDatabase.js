const sqlite3 = require("sqlite3").verbose();
const DBSOURCE = "usersdb.sqlite";
const bcrypt = require("bcryptjs");
const { open } = require("sqlite");

let db = new sqlite3.Database(DBSOURCE, (err) => {
  if (err) {
    console.error(err.message);
    throw err;
  } else {
    // ابتدا جدول users را ایجاد می‌کنیم
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        token TEXT,
        role TEXT DEFAULT 'operator',
        loggedin_at TIMESTAMP,
        created_at TIMESTAMP
      )`,
      (err) => {
        if (err) {
          console.log("خطا در ایجاد جدول users:", err.message);
        } else {
          console.log("✅ جدول users ایجاد شد");

          // بعد از اطمینان از وجود جدول، ادمین پیش‌فرض را اضافه می‌کنیم
          db.get(
            `SELECT * FROM users WHERE phone = '09392421805'`,
            (err, row) => {
              if (err) {
                console.log("خطا در بررسی ادمین:", err.message);
              } else if (!row) {
                db.run(
                  `INSERT INTO users (name, phone, role, created_at) VALUES (?, ?, ?, ?)`,
                  ["admin", "09392421805", "admin", Date.now()],
                  (err) => {
                    if (err) console.log("خطا در ایجاد ادمین:", err.message);
                    else
                      console.log(
                        "✅ ادمین پیش‌فرض با شماره 09392421805 ایجاد شد",
                      );
                  },
                );
              } else {
                console.log("ℹ️ ادمین پیش‌فرض قبلاً وجود دارد");
              }
            },
          );
        }
      },
    );

    db.run(`CREATE TABLE IF NOT EXISTS phone_verification (
      id TEXT UNIQUE,
      phone TEXT,
      code TEXT UNIQUE,
      created_at TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      category TEXT,
      body TEXT,
      price INTEGER,
      user_id INTEGER,
      created_at TIMESTAMP
    )`);

    // جداول پارکینگ
    db.run(`CREATE TABLE IF NOT EXISTS parked_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_code TEXT NOT NULL UNIQUE,
      plate TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      entry_time TIMESTAMP NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS parking_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_code TEXT NOT NULL,
  plate TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP NOT NULL,
  cost INTEGER NOT NULL,
  hourly_rate INTEGER NOT NULL,
  operator_id INTEGER,   -- ← NOT NULL را حذف کن تا NULL پذیر شود
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);
    db.run(
      `CREATE TABLE IF NOT EXISTS tariff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hourly_rate INTEGER NOT NULL DEFAULT 15000,
      base_cost INTEGER NOT NULL DEFAULT 10000,
      updated_at TIMESTAMP NOT NULL,
      updated_by TEXT
    )`,
      (err) => {
        if (!err) {
          db.get(`SELECT COUNT(*) as count FROM tariff`, (err, row) => {
            if (!err && row && row.count === 0) {
              db.run(
                `INSERT INTO tariff (hourly_rate, base_cost, updated_at, updated_by) VALUES (?, ?, ?, ?)`,
                [15000, 10000, new Date().toISOString(), "system"],
              );
            }
          });
        }
      },
    );

    // جدول اعلانات
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      duration_hours INTEGER DEFAULT 24,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    )`);

    // جدول حذف موقت اعلان توسط اپراتورها
    db.run(`CREATE TABLE IF NOT EXISTS notification_dismissals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER,
      user_id INTEGER,
      dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notification_id, user_id)
    )`);

    // جدول شیفت‌های کاری اپراتورها
    db.run(`CREATE TABLE IF NOT EXISTS operator_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      shift_start TIMESTAMP NOT NULL,
      shift_end TIMESTAMP,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )`);
  }
});

// توابع کمکی
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return query(sql, params);
}

async function openDb() {
  return open({
    filename: DBSOURCE,
    driver: sqlite3.Database,
  });
}

module.exports = { db, query, queryOne, run, all, openDb };


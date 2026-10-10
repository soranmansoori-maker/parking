const { openDb } = require('../createDatabase.js');

class PhoneVerify {
  async create(data) {
    const db = await openDb();
    const result = await db.run(
      'INSERT INTO phone_verification (id, phone, code, created_at) VALUES (?, ?, ?, ?)',
      [data.id, data.phone, data.code, data.created_at]
    );
    await db.close();
    return result;
  }

  async findBy(field, value) {
    const db = await openDb();
    const result = await db.get(`SELECT * FROM phone_verification WHERE ${field} = ?`, [value]);
    await db.close();
    return result;
  }

  async delete(id) {
    const db = await openDb();
    const result = await db.run('DELETE FROM phone_verification WHERE id = ?', [id]);
    await db.close();
    return result;
  }

  async getUniqueCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const db = await openDb();
    const existing = await db.get('SELECT * FROM phone_verification WHERE code = ?', [code]);
    await db.close();
    
    if (existing) {
      return this.getUniqueCode();
    }
    return code;
  }
}

module.exports = new PhoneVerify();
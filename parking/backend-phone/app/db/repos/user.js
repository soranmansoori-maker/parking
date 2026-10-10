const { openDb } = require('../createDatabase.js');

class User {
  async create(data) {
    const db = await openDb();
    const result = await db.run(
      'INSERT INTO users (name, phone, created_at) VALUES (?, ?, ?)',
      [data.name, data.phone, data.created_at]
    );
    await db.close();
    return result;
  }

  async findBy(field, value) {
    const db = await openDb();
    const result = await db.get(`SELECT * FROM users WHERE ${field} = ?`, [value]);
    await db.close();
    return result;
  }

  async update(id, data) {
    const db = await openDb();
    const fields = [];
    const values = [];
    
    for (const [key, val] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    values.push(id);
    
    const result = await db.run(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    await db.close();
    return result;
  }

  async delete(id) {
    const db = await openDb();
    const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
    await db.close();
    return result;
  }

  async findAll() {
    const db = await openDb();
    const result = await db.all('SELECT * FROM users');
    await db.close();
    return result;
  }
}

module.exports = new User();
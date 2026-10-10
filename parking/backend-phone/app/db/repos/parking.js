const { openDb } = require("../createDatabase.js");

class ParkingRepo {
  // دریافت همه ماشین‌های داخل پارکینگ
  static async getAllParked() {
    const db = await openDb();
    const result = await db.all("SELECT * FROM parked_vehicles");
    await db.close();
    return result;
  }

  // دریافت یک جایگاه خاص
  static async getBySlotCode(slotCode) {
    const db = await openDb();
    const result = await db.get(
      "SELECT * FROM parked_vehicles WHERE slot_code = ?",
      [slotCode],
    );
    await db.close();
    return result;
  }

  // ثبت ورود
  static async insertEntry(slotCode, plate, vehicleType, entryTime) {
    const db = await openDb();
    const result = await db.run(
      "INSERT INTO parked_vehicles (slot_code, plate, vehicle_type, entry_time) VALUES (?, ?, ?, ?)",
      [slotCode, plate, vehicleType, entryTime],
    );
    await db.close();
    return result;
  }

  // حذف و ثبت خروج (تراکنشی)
static async exitAndSaveHistory(slotCode, exitTime, cost, hourlyRate, operatorId) {
    const db = await openDb();
    await db.run("BEGIN TRANSACTION");
    try {
        const vehicle = await db.get(
            "SELECT * FROM parked_vehicles WHERE slot_code = ?",
            [slotCode],
        );
        if (!vehicle) {
            await db.run("ROLLBACK");
            return null;
        }
        console.log("📝 operatorId دریافتی:", operatorId);
        await db.run(
            `INSERT INTO parking_history 
             (slot_code, plate, vehicle_type, entry_time, exit_time, cost, hourly_rate, operator_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [slotCode, vehicle.plate, vehicle.vehicle_type, vehicle.entry_time, exitTime, cost, hourlyRate, operatorId],
        );
        await db.run("DELETE FROM parked_vehicles WHERE slot_code = ?", [slotCode]);
        await db.run("COMMIT");
        return vehicle;
    } catch (error) {
        await db.run("ROLLBACK");
        throw error;
    } finally {
        await db.close();
    }
}

  // دریافت تعرفه فعلی
  static async getCurrentTariff() {
    const db = await openDb();
    const result = await db.get(
      "SELECT * FROM tariff ORDER BY id DESC LIMIT 1",
    );
    await db.close();
    console.log("💰 تعرفه فعلی از دیتابیس:", result);
    return result;
  }

  // بروزرسانی تعرفه
  static async updateTariff(hourlyRate, baseCost, updatedBy) {
    const db = await openDb();
    const result = await db.run(
      "INSERT INTO tariff (hourly_rate, base_cost, updated_at, updated_by) VALUES (?, ?, ?, ?)",
      [hourlyRate, baseCost, new Date().toISOString(), updatedBy],
    );
    await db.close();
    console.log("✅ تعرفه جدید ذخیره شد:", { hourlyRate, baseCost, updatedBy });
    return result;
  }

  // حذف ماشین از پارکینگ
  static async deleteBySlotCode(slotCode) {
    console.log("🗑️ در حال حذف جایگاه:", slotCode);
    const db = await openDb();
    const result = await db.run(
      "DELETE FROM parked_vehicles WHERE slot_code = ?",
      [slotCode],
    );
    await db.close();
    console.log("✅ حذف انجام شد:", result.changes, "ردیف");
    return result;
  }
}

module.exports = { ParkingRepo };
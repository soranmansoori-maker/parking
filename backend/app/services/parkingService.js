const { ParkingRepo } = require("../db/repos/parking.js");

class ParkingService {
  // دریافت وضعیت کامل پارکینگ (۲۰۰ جایگاه)
  static async getFullStatus() {
    const parked = await ParkingRepo.getAllParked();

    const floors = ["A", "B", "C", "D", "E"];
    const slots = {};

    for (const floor of floors) {
      for (let i = 1; i <= 40; i++) {
        const code = `${floor}${i}`;
        const vehicle = parked.find((v) => v.slot_code === code);

        if (vehicle) {
          slots[code] = {
            status: "occupied",
            vehicleType: vehicle.vehicle_type,
            plate: vehicle.plate,
            entryTime: vehicle.entry_time,
          };
        } else {
          slots[code] = { status: "free" };
        }
      }
    }

    return slots;
  }

  // ثبت ورود
  static async entry(slotCode, plate, vehicleType) {
    const existing = await ParkingRepo.getBySlotCode(slotCode);
    if (existing) {
      throw new Error("این جایگاه قبلاً پر شده است");
    }

    const entryTime = new Date().toISOString();
    await ParkingRepo.insertEntry(slotCode, plate, vehicleType, entryTime);

    return { slotCode, plate, vehicleType, entryTime };
  }

  // ثبت خروج و محاسبه هزینه (با operatorId)
  static async exit(slotCode, operatorId) {
    const exitTime = new Date();

    const tariff = await ParkingRepo.getCurrentTariff();
    const hourlyRate = tariff?.hourly_rate || 15000;
    const baseCost = tariff?.base_cost || 10000;

    const vehicle = await ParkingRepo.getBySlotCode(slotCode);
    if (!vehicle) {
      throw new Error("خودرویی در این جایگاه یافت نشد");
    }

    // محاسبه هزینه
    const costDetails = this.calculateExactCost(
      vehicle.entry_time,
      exitTime,
      hourlyRate,
      baseCost,
    );

    console.log("📝 ارسال به exitAndSaveHistory:", { slotCode, cost: costDetails.cost, hourlyRate, operatorId });
    // ذخیره در تاریخچه با operatorId
    await ParkingRepo.exitAndSaveHistory(
      slotCode,
      exitTime.toISOString(),
      costDetails.cost,
      hourlyRate,
      operatorId,
    );

    // حذف از پارکینگ فعلی
    await ParkingRepo.deleteBySlotCode(slotCode);

    return {
      success: true,
      data: {
        slotCode: slotCode,
        plate: vehicle.plate,
        vehicleType: vehicle.vehicle_type,
        entryTime: vehicle.entry_time,
        exitTime: exitTime.toISOString(),
        costDetails: costDetails,
      },
    };
  }

  // دریافت تاریخچه (برای گزارش)
  static async getHistory(limit = 100, offset = 0) {
    const { openDb } = require("../db/createDatabase.js");
    const db = await openDb();
    const result = await db.all(
      "SELECT * FROM parking_history ORDER BY exit_time DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    await db.close();
    return result;
  }

  // محاسبه دقیق هزینه (طبق سناریوی جدید)
  static calculateExactCost(entryTime, exitTime, hourlyRate, baseCost) {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);

    const diffMs = exit - entry;

    if (diffMs < 0) {
      throw new Error("زمان خروج نمی‌تواند از زمان ورود کمتر باشد");
    }

    const totalMinutes = Math.ceil(diffMs / (1000 * 60));

    const BASE_COST = baseCost;
    const ratePerMinute = hourlyRate / 60;
    const freeMinutes = 30;

    let extraCost = 0;
    let extraMinutes = 0;

    if (totalMinutes > freeMinutes) {
      extraMinutes = totalMinutes - freeMinutes;
      extraCost = Math.ceil(extraMinutes * ratePerMinute);
    }

    const totalCost = BASE_COST + extraCost;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const extraHours = Math.floor(extraMinutes / 60);
    const extraMinutesRemainder = extraMinutes % 60;

    return {
      cost: totalCost,
      baseCost: BASE_COST,
      totalMinutes: totalMinutes,
      hours: hours,
      minutes: minutes,
      extraMinutes: extraMinutes,
      extraHours: extraHours,
      extraMinutesRemainder: extraMinutesRemainder,
      extraCost: extraCost,
      ratePerHour: hourlyRate,
      ratePerMinute: Math.round(ratePerMinute),
      freeMinutes: freeMinutes,
      entryTime: entryTime,
      exitTime: exitTime.toISOString(),
    };
  }
}

module.exports = { ParkingService };

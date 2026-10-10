const express = require("express");
const { ParkingService } = require("../app/services/parkingService.js");
const { queryOne, run } = require("../app/db/createDatabase");

const router = express.Router();

// همه مسیرهای پارکینگ نیاز به احراز هویت دارند (authMiddleware در index.js اضافه شده)

// دریافت وضعیت کامل پارکینگ
router.get("/status", async (req, res) => {
  try {
    const status = await ParkingService.getFullStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ثبت ورود
router.post("/entry", async (req, res) => {
  try {
    const { slotCode, plate, vehicleType } = req.body;

    if (!slotCode || !plate || !vehicleType) {
      return res.status(400).json({
        success: false,
        error: "slotCode, plate و vehicleType الزامی هستند",
      });
    }

    const result = await ParkingService.entry(slotCode, plate, vehicleType);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ثبت خروج (آپدیت شده با operatorId)
router.post("/exit", async (req, res) => {
  try {
    const { slotCode } = req.body;

    console.log("📥 درخواست خروج دریافت شد:", { slotCode });

    if (!slotCode) {
      console.log("❌ slotCode وجود ندارد");
      return res.status(400).json({
        success: false,
        error: "slotCode الزامی است",
      });
    }

    const result = await ParkingService.exit(slotCode, req.user.id);
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.log("❌ خطای کامل:", error);
    console.log("❌ پیام خطا:", error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// دریافت تعرفه فعلی
router.get("/tariff", async (req, res) => {
  try {
    const { ParkingRepo } = require("../app/db/repos/parking.js");
    const tariff = await ParkingRepo.getCurrentTariff();
    console.log("💰 تعرفه ارسال شد:", tariff);
    res.json({ success: true, data: tariff });
  } catch (error) {
    console.error("❌ خطا در دریافت تعرفه:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// بروزرسانی تعرفه (فقط ادمین و مدیر)
router.put("/tariff", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        error: "شما مجاز به تغییر تعرفه نیستید",
      });
    }

    const { hourlyRate, baseCost } = req.body;

    if (!hourlyRate || hourlyRate <= 0) {
      return res.status(400).json({
        success: false,
        error: "نرخ ساعتی معتبر وارد کنید",
      });
    }

    if (!baseCost || baseCost <= 0) {
      return res.status(400).json({
        success: false,
        error: "هزینه پایه معتبر وارد کنید",
      });
    }

    const { ParkingRepo } = require("../app/db/repos/parking.js");
    await ParkingRepo.updateTariff(hourlyRate, baseCost, req.user.phone || req.user.name);

    res.json({ success: true, message: "تعرفه با موفقیت بروزرسانی شد" });
  } catch (error) {
    console.error("❌ خطا در بروزرسانی تعرفه:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// دریافت تاریخچه (برای گزارش)
router.get("/history", async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const history = await ParkingService.getHistory(
      parseInt(limit),
      parseInt(offset),
    );
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ثبت شروع شیفت اپراتور
router.post('/shift/start', async (req, res) => {
    try {
        const operatorId = req.user.id;
        
        const activeShift = await queryOne(
            'SELECT * FROM operator_shifts WHERE operator_id = ? AND status = "active"',
            [operatorId]
        );
        
        if (activeShift) {
            return res.status(400).json({ success: false, error: 'شما قبلاً شیفت خود را شروع کرده‌اید' });
        }
        
        const now = new Date().toISOString();
        await run(
            'INSERT INTO operator_shifts (operator_id, shift_start, status) VALUES (?, ?, ?)',
            [operatorId, now, 'active']
        );
        
        res.json({ success: true, message: 'شیفت کاری با موفقیت شروع شد' });
    } catch (error) {
        console.error("❌ خطا در شروع شیفت:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ثبت پایان شیفت اپراتور
router.post('/shift/end', async (req, res) => {
    try {
        const operatorId = req.user.id;
        
        const activeShift = await queryOne(
            'SELECT * FROM operator_shifts WHERE operator_id = ? AND status = "active"',
            [operatorId]
        );
        
        if (!activeShift) {
            return res.status(400).json({ success: false, error: 'شما شیفت فعالی ندارید' });
        }
        
        const now = new Date().toISOString();
        await run(
            'UPDATE operator_shifts SET shift_end = ?, status = "closed" WHERE id = ?',
            [now, activeShift.id]
        );
        
        res.json({ success: true, message: 'شیفت کاری با موفقیت پایان یافت' });
    } catch (error) {
        console.error("❌ خطا در پایان شیفت:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// دریافت وضعیت شیفت فعلی اپراتور
router.get('/shift/status', async (req, res) => {
    try {
        const operatorId = req.user.id;
        
        const activeShift = await queryOne(
            'SELECT * FROM operator_shifts WHERE operator_id = ? AND status = "active"',
            [operatorId]
        );
        
        res.json({ success: true, data: { isActive: !!activeShift, shift: activeShift } });
    } catch (error) {
        console.error("❌ خطا در دریافت وضعیت شیفت:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;


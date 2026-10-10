const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../app/db/createDatabase'); // ← اضافه شدن queryOne
const authMiddleware = require('./middlewares/auth');

router.use(authMiddleware);

// گزارش کامل (فقط ادمین/مدیر)
router.get('/', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده گزارش نیستید' });
        }
        
        const { start_date, end_date, operator_id } = req.query;
        
        let dateFilter = '';
        let params = [];
        
        if (start_date && end_date) {
            dateFilter = 'AND h.exit_time BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        
        let operatorFilter = '';
        if (operator_id) {
            operatorFilter = 'AND h.operator_id = ?';
            params.push(operator_id);
        }
        
        // 1. خلاصه آماری
        const summarySql = `
            SELECT 
                COUNT(*) as total_exits,
                SUM(h.cost) as total_income,
                COUNT(DISTINCT DATE(h.exit_time)) as total_days
            FROM parking_history h
            WHERE 1=1 ${dateFilter} ${operatorFilter}
        `;
        
        const summary = await queryOne(summarySql, params);
        
        // 2. جزئیات تراکنش‌ها
        const detailsSql = `
            SELECT 
                h.id,
                h.slot_code,
                h.plate,
                h.vehicle_type,
                h.entry_time,
                h.exit_time,
                h.cost,
                h.hourly_rate,
                u.name as operator_name
            FROM parking_history h
            LEFT JOIN users u ON h.operator_id = u.id
            WHERE 1=1 ${dateFilter} ${operatorFilter}
            ORDER BY h.exit_time DESC
        `;
        
        const details = await query(detailsSql, params);
        
        // 3. گزارش شیفت‌های اپراتورها
        const shiftsSql = `
            SELECT 
                u.name as operator_name,
                COUNT(s.id) as total_shifts,
                SUM((julianday(s.shift_end) - julianday(s.shift_start)) * 24) as total_hours
            FROM operator_shifts s
            JOIN users u ON s.operator_id = u.id
            WHERE s.status = 'closed'
            ${start_date && end_date ? 'AND s.shift_start BETWEEN ? AND ?' : ''}
            GROUP BY s.operator_id
        `;
        
        const shifts = await query(shiftsSql, start_date && end_date ? [start_date, end_date] : []);
        
        res.json({
            success: true,
            data: {
                summary: {
                    total_exits: summary?.total_exits || 0,
                    total_income: summary?.total_income || 0,
                    avg_income_per_day: summary?.total_days ? (summary.total_income / summary.total_days).toFixed(0) : 0
                },
                details: details,
                shifts: shifts
            }
        });
        
    } catch (error) {
        console.error("❌ خطا در دریافت گزارش:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// گزارش ورود/خروج اپراتورها (شیفت‌ها)
router.get('/shifts', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده گزارش شیفت نیستید' });
        }
        
        const { start_date, end_date } = req.query;
        
        let dateFilter = '';
        let params = [];
        
        if (start_date && end_date) {
            dateFilter = 'WHERE s.shift_start BETWEEN ? AND ?';
            params = [start_date, end_date];
        }
        
        const sql = `
            SELECT 
                s.id,
                u.name as operator_name,
                s.shift_start,
                s.shift_end,
                s.status,
                (julianday(s.shift_end) - julianday(s.shift_start)) * 24 as duration_hours
            FROM operator_shifts s
            JOIN users u ON s.operator_id = u.id
            ${dateFilter}
            ORDER BY s.shift_start DESC
        `;
        
        const shifts = await query(sql, params);
        
        res.json({ success: true, data: shifts });
    } catch (error) {
        console.error("❌ خطا در دریافت گزارش شیفت:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
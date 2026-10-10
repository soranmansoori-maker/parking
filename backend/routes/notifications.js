const express = require('express');
const router = express.Router();
const { query, run } = require('../app/db/createDatabase');
const authMiddleware = require('./middlewares/auth');

router.use(authMiddleware);

// دریافت اعلان‌های فعال برای کاربر جاری (اپراتور)
router.get('/active', async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date().toISOString();
        
        // اعلان‌های فعال که منقضی نشده و کاربر آنها را dismiss نکرده
        const sql = `
            SELECT n.* FROM notifications n
            WHERE n.expires_at > ?
            AND NOT EXISTS (
                SELECT 1 FROM notification_dismissals nd
                WHERE nd.notification_id = n.id AND nd.user_id = ?
            )
            ORDER BY n.created_at DESC
        `;
        
        const notifications = await query(sql, [now, userId]);
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error("❌ خطا در دریافت اعلان‌ها:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ایجاد اعلان جدید (فقط ادمین/مدیر)
router.post('/', async (req, res) => {
    try {
        // فقط ادمین یا مدیر مجاز است
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به ایجاد اعلان نیستید' });
        }
        
        const { title, body, duration_hours } = req.body;
        
        if (!title || !body) {
            return res.status(400).json({ success: false, error: 'عنوان و متن اعلان الزامی است' });
        }
        
        const duration = duration_hours || 24; // پیش‌فرض 24 ساعت
        const expires_at = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
        
        const result = await run(
            'INSERT INTO notifications (title, body, duration_hours, expires_at, created_by) VALUES (?, ?, ?, ?, ?)',
            [title, body, duration, expires_at, req.user.id]
        );
        
        res.json({ success: true, message: 'اعلان با موفقیت ارسال شد', data: { id: result.lastID } });
    } catch (error) {
        console.error("❌ خطا در ایجاد اعلان:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// حذف موقت اعلان برای اپراتور جاری (dismiss)
router.post('/:id/dismiss', async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;
        
        // بررسی وجود اعلان
        const notification = await query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
        if (!notification || notification.length === 0) {
            return res.status(404).json({ success: false, error: 'اعلان یافت نشد' });
        }
        
        // ثبت dismiss
        await run(
            'INSERT OR REPLACE INTO notification_dismissals (notification_id, user_id, dismissed_at) VALUES (?, ?, ?)',
            [notificationId, userId, new Date().toISOString()]
        );
        
        res.json({ success: true, message: 'اعلان حذف شد' });
    } catch (error) {
        console.error("❌ خطا در dismiss اعلان:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// حذف اعلان از دیتابیس (فقط ادمین/مدیر)
router.delete('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به حذف اعلان نیستید' });
        }
        
        const notificationId = req.params.id;
        
        // حذف از notification_dismissals اول
        await run('DELETE FROM notification_dismissals WHERE notification_id = ?', [notificationId]);
        // سپس حذف اعلان
        await run('DELETE FROM notifications WHERE id = ?', [notificationId]);
        
        res.json({ success: true, message: 'اعلان با موفقیت حذف شد' });
    } catch (error) {
        console.error("❌ خطا در حذف اعلان:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// دریافت لیست همه اعلان‌ها (برای ادمین/مدیر - صفحه مدیریت)
router.get('/', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده اعلان‌ها نیستید' });
        }
        
        const notifications = await query(`
            SELECT n.*, u.name as created_by_name 
            FROM notifications n
            LEFT JOIN users u ON n.created_by = u.id
            ORDER BY n.created_at DESC
        `);
        
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error("❌ خطا در دریافت اعلان‌ها:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
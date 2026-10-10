const express = require('express');
const router = express.Router();
const { query, run } = require('../app/db/createDatabase');
const authMiddleware = require('./middlewares/auth');

router.use(authMiddleware);

// دریافت لیست کاربران
router.get('/', async (req, res) => {
    console.log("🔍 req.user در users.js:", req.user);
    try {
        const currentUserRole = req.user.role;
        const { role } = req.query;
        
        console.log("👤 کاربر درخواست‌دهنده:", req.user);
        
        let sql = 'SELECT id, name, phone, role, created_at FROM users';
        let params = [];
        
        // ادمین یا مدیر: همه کاربران را می‌بیند (یا فقط اپراتورها بر اساس نقش)
        if (currentUserRole === 'admin' || currentUserRole === 'manager') {
            if (role === 'operator') {
                sql += ' WHERE role = ?';
                params.push('operator');
            } else if (role === 'manager' && currentUserRole === 'admin') {
                sql += ' WHERE role = ?';
                params.push('manager');
            }
            // اگر role مشخص نشده، همه کاربران (برای ادمین) یا فقط اپراتورها (برای مدیر)
            else if (currentUserRole === 'manager') {
                sql += ' WHERE role = "operator"';
            }
        } 
        // اپراتور: دسترسی ندارد
        else {
            return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده کاربران نیستید' });
        }
        
        sql += ' ORDER BY created_at DESC';
        
        console.log("📝 SQL:", sql);
        const users = await query(sql, params);
        console.log("🔍 تعداد کاربران یافت شده:", users.length);
        
        res.json({ success: true, data: users || [] });
    } catch (error) {
        console.error("❌ خطا در دریافت کاربران:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// بروزرسانی کاربر (ادمین و مدیر مجاز)
router.post('/:id/update', async (req, res) => {
    try {
        const { name, phone, role } = req.body;
        const userId = req.params.id;
        const currentUserRole = req.user.role;
        const currentUserId = req.user.id;
        
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به ویرایش کاربران نیستید' });
        }
        
        const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
        const existingUser = users[0];
        
        if (!existingUser) {
            return res.status(404).json({ success: false, error: 'کاربر یافت نشد' });
        }
        
        // مدیر فقط می‌تواند اپراتورها را ویرایش کند
        if (currentUserRole === 'manager' && existingUser.role !== 'operator') {
            return res.status(403).json({ success: false, error: 'شما فقط می‌توانید اپراتورها را ویرایش کنید' });
        }
        
        // بررسی شماره تلفن تکراری
        if (phone && phone !== existingUser.phone) {
            const phoneUsers = await query('SELECT * FROM users WHERE phone = ? AND id != ?', [phone, userId]);
            if (phoneUsers.length > 0) {
                return res.status(400).json({ success: false, error: 'این شماره تلفن قبلاً ثبت شده است' });
            }
        }
        
        if (role && currentUserRole === 'admin') {
            await run('UPDATE users SET name = ?, phone = ?, role = ? WHERE id = ?', [
                name || existingUser.name,
                phone || existingUser.phone,
                role,
                userId
            ]);
        } else {
            await run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [
                name || existingUser.name,
                phone || existingUser.phone,
                userId
            ]);
        }
        
        res.json({ success: true, message: 'کاربر با موفقیت بروزرسانی شد' });
    } catch (error) {
        console.error("❌ خطا در بروزرسانی کاربر:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// حذف کاربر (ادمین و مدیر مجاز)
router.delete('/:id/delete', async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserRole = req.user.role;
        const currentUserId = req.user.id;
        
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return res.status(403).json({ success: false, error: 'شما مجاز به حذف کاربران نیستید' });
        }
        
        const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'کاربر یافت نشد' });
        }
        
        // مدیر فقط می‌تواند اپراتورها را حذف کند
        if (currentUserRole === 'manager' && user.role !== 'operator') {
            return res.status(403).json({ success: false, error: 'شما فقط می‌توانید اپراتورها را حذف کنید' });
        }
        
        // جلوگیری از حذف خود کاربر
        if (parseInt(userId) === currentUserId) {
            return res.status(403).json({ success: false, error: 'امکان حذف حساب کاربری خودتان وجود ندارد' });
        }
        
        await run('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ success: true, message: 'کاربر با موفقیت حذف شد' });
    } catch (error) {
        console.error("❌ خطا در حذف کاربر:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { queryOne, run } = require('../app/db/createDatabase');

// بررسی وجود مالک (مدیر)
router.get('/check-owner', async (req, res) => {
    try {
        const owner = await queryOne('SELECT id, name, phone FROM users WHERE role = "manager"');
        
        if (owner) {
            res.json({ hasOwner: true, owner: { name: owner.name, phone: owner.phone } });
        } else {
            res.json({ hasOwner: false });
        }
    } catch (error) {
        console.error("❌ خطا در بررسی وجود مالک:", error);
        res.status(500).json({ hasOwner: false, error: error.message });
    }
});

// ثبت‌نام مالک (بدون احراز هویت)
router.post('/register-owner', async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        // بررسی اینکه قبلاً مالکی وجود نداشته باشد
        const existingOwner = await queryOne('SELECT id FROM users WHERE role = "manager"');
        if (existingOwner) {
            return res.status(403).json({ success: false, error: 'مالک قبلاً ثبت شده است' });
        }
        
        // بررسی تکراری نبودن شماره
        const existingUser = await queryOne('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'این شماره تلفن قبلاً ثبت شده است' });
        }
        
        // ثبت‌نام با نقش manager
        await run(
            'INSERT INTO users (name, phone, role, created_at) VALUES (?, ?, ?, ?)',
            [name, phone, 'manager', Date.now()]
        );
        
        res.json({ success: true, message: 'مالک با موفقیت ثبت شد' });
    } catch (error) {
        console.error("❌ خطا در ثبت مالک:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

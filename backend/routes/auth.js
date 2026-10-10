const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const yup = require("yup");
const { createToken } = require('../app/services/token');
const userRepo = require('../app/db/repos/user');
const validate = require('./middlewares/validate');
const phoneVerifyRepo = require('../app/db/repos/phoneVerify');
const phoneRegExp = /^09[0-9]{9}$/; // ← تغییر اصلی

const loginSchema = yup.object({
    body: yup.object({
        phone: yup.string().required().matches(phoneRegExp, 'شماره تلفن نامعتبر است')
            .test('check-phone-exists', 'the phone not exists', async (value) => {
                let user = await userRepo.findBy('phone', value);
                return user !== undefined;
            })
    })
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const { phone } = req.body;
        let user = await userRepo.findBy('phone', phone);

        let phoneVerifyData = {
            'id': crypto.randomUUID(),
            'phone': user.phone,
            'code': await phoneVerifyRepo.getUniqueCode(),
            'created_at': Date.now()
        };

        console.log("📱 کد تایید:", phoneVerifyData.code);

        try {
            await phoneVerifyRepo.create(phoneVerifyData);
        } catch (error) {
            return res.status(500).json({
                'status': 'error',
                'message': 'we cant create phone verify code'
            });
        }

        return res.status(200).json({
            'status': 'success',
            'token': phoneVerifyData.id,
        });

    } catch (err) {
        next(err);
    }
});

const loginStepTwoSchema = yup.object({
    body: yup.object({
        token: yup.string().required()
            .test('check-token-exists', 'the token not exists', async (value) => {
                let phoneVerify = await phoneVerifyRepo.findBy('id', value);
                return phoneVerify !== undefined;
            }),
        code: yup.string().required()
            .test('check-code-right', 'the code is not correct', async (value, { parent }) => {
                let phoneVerify = await phoneVerifyRepo.findBy('id', parent?.token);
                return phoneVerify?.code === value;
            })
    })
});

router.post('/login/verify-phone', validate(loginStepTwoSchema), async (req, res, next) => {
    try {
        const { token } = req.body;

        let phoneVerify = await phoneVerifyRepo.findBy('id', token);
        let user = await userRepo.findBy('phone', phoneVerify.phone);

        const tokenJWT = createToken({
            user_id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role || 'operator'
        });
        
        user.token = tokenJWT;
        await userRepo.update(user.id, { token: tokenJWT });
        console.log("✅ توکن در دیتابیس ذخیره شد برای کاربر:", user.id);

        await phoneVerifyRepo.delete(phoneVerify.id);

        return res.status(200).json({
            'status': 'success',
            'user': {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role || 'operator',
                token: tokenJWT
            }
        });

    } catch (err) {
        console.error("❌ خطا در verify-phone:", err);
        next(err);
    }
});

router.post('/register', async (req, res, next) => {
    try {
        const { name, phone, role } = req.body;

        console.log("📥 درخواست ثبت‌نام:", { name, phone, role });

        if (!name || name.length < 2) {
            return res.status(422).json({
                status: 'error',
                message: { name: ["نام باید حداقل ۲ کاراکتر باشد"] }
            });
        }

        if (!phone || !phoneRegExp.test(phone)) {
            return res.status(422).json({
                status: 'error',
                message: { phone: ["شماره تلفن نامعتبر است"] }
            });
        }

        let existingUser = await userRepo.findBy('phone', phone);
        if (existingUser) {
            return res.status(422).json({
                status: 'error',
                message: { phone: ["این شماره تلفن قبلاً ثبت شده است"] }
            });
        }

        let data = {
            name,
            phone,
            role: role || 'operator',
            created_at: Date.now()
        };

        await userRepo.create(data);

        console.log("✅ کاربر جدید ثبت شد:", phone, "نقش:", data.role);

        return res.status(201).json({ status: 'success' });

    } catch (err) {
        console.error("❌ خطا در ثبت‌نام:", err);
        next(err);
    }
});

module.exports = router;
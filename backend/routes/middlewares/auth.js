const jwt = require('jsonwebtoken');
const { queryOne } = require('../../app/db/createDatabase');

const auth = async (req, res, next) => {
    let token = req.headers?.authorization || req.cookies?.shopy;

    console.log("🔑 توکن خام دریافتی:", token?.substring(0, 50) + "...");

    if (!token) {
        return res.status(401).json({ status: 'fail', message: 'unauthorized - no token' });
    }

    if (token.startsWith('Bearer ')) {
        token = token.slice(7);
        console.log("✅ 'Bearer ' حذف شد");
    }

    try {
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        console.log("✅ توکن معتبر شد:", decoded);

        // فقط با id کاربر را پیدا کن (بدون چک توکن)
        const user = await queryOne(
            'SELECT id, name, phone, role FROM users WHERE id = ?',
            [decoded.user_id]
        );

        if (!user) {
            console.log("❌ کاربر یافت نشد");
            return res.status(401).json({ status: 'fail', message: 'unauthenticated' });
        }

        req.user = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role || 'operator',
        };

        console.log("👤 کاربر احراز شده:", req.user);
        next();
    } catch (err) {
        console.error('❌ JWT verify error:', err.message);
        return res.status(401).json({ status: 'fail', message: 'unauthenticated' });
    }
};

module.exports = auth;
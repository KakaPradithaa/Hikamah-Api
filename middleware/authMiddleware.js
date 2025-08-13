// middleware/authMiddleware.js

const verifyAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.peran === 'Admin') return next();
    res.status(403).json({ message: 'Akses ditolak. Rute ini hanya untuk Admin.' });
};

const verifyGuru = (req, res, next) => {
    if (req.session.user && req.session.user.peran === 'Guru') return next();
    res.status(403).json({ message: 'Akses ditolak. Rute ini hanya untuk Guru.' });
};

// Ini adalah satu-satunya middleware yang kita butuhkan untuk dashboard santri.
// Ini akan berhasil karena login Wali akan menghasilkan sesi dengan peran 'Santri'.
const verifySantri = (req, res, next) => {
    if (req.session.user && req.session.user.peran === 'Santri') return next();
    res.status(403).json({ message: 'Akses ditolak. Rute ini memerlukan akses sebagai Santri.' });
};

module.exports = {
    verifyAdmin,
    verifyGuru,
    verifySantri
};
// middleware/authMiddleware.js

const pool = require('../config/db');

// --- Middleware untuk memeriksa peran ADMIN ---
exports.verifyAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.peran === 'Admin') {
        return next();
    }
    res.status(403).json({ message: 'Akses ditolak. Rute ini hanya untuk Admin.' });
};

// --- Middleware untuk memeriksa peran GURU ---
exports.verifyGuru = (req, res, next) => {
    if (req.session.user && req.session.user.peran === 'Guru') {
        return next();
    }
    res.status(403).json({ message: 'Akses ditolak. Rute ini hanya untuk Guru.' });
};

// --- Middleware untuk memeriksa peran SANTRI ---
exports.verifySantri = (req, res, next) => {
    if (req.session.user && req.session.user.peran === 'Santri') {
        return next();
    }
    res.status(403).json({ message: 'Akses ditolak. Rute ini memerlukan akses sebagai Santri.' });
};

// --- MIDDLEWARE BARU DAN PENTING UNTUK WALI KELAS ---
// Pastikan fungsi ini ada dan diekspor dengan benar.
exports.verifyWaliKelas = async (req, res, next) => {
    // 1. Pastikan yang login adalah seorang Guru
    if (!req.session.user || req.session.user.peran !== 'Guru') {
        return res.status(403).json({ message: 'Akses ditolak. Anda bukan Guru.' });
    }
    
    try {
        // 2. Cek di database apakah ID PENGGUNA dari guru ini terhubung sebagai wali kelas di tabel 'kelas'
        const [kelasData] = await pool.query(
            `SELECT k.id FROM kelas k 
             JOIN guru g ON k.id_wali_kelas = g.id 
             WHERE g.id_pengguna = ?`, 
            [req.session.user.id_pengguna]
        );
        
        // 3. Jika tidak ditemukan kelas yang dia wali-kan, tolak akses
        if (kelasData.length === 0) {
            return res.status(403).json({ message: 'Akses ditolak. Anda bukan Wali Kelas dari kelas manapun.' });
        }
        
        // 4. Jika berhasil, simpan ID kelas ke request untuk digunakan oleh controller
        req.id_kelas_wali = kelasData[0].id;
        next(); // Izinkan akses
    } catch (error) {
        console.error("Error saat verifikasi wali kelas:", error);
        res.status(500).json({ message: "Gagal memverifikasi status wali kelas." });
    }
};
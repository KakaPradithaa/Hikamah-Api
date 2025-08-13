// controllers/guruController.js

const pool = require('../config/db');

// --- Fungsi untuk POST /absensi ---
exports.recordAbsensi = async (req, res) => {
    const { id_santri, tanggal, status } = req.body;

    // 1. Validasi input
    if (!id_santri || !tanggal || !status) {
        return res.status(400).json({ message: 'Data absensi tidak lengkap.' });
    }

    try {
        // 2. Interaksi dengan database
        await pool.query(
            'INSERT INTO absensi (id_santri, tanggal, status) VALUES (?, ?, ?)',
            [id_santri, tanggal, status]
        );
        
        // 3. Kirim respons sukses
        res.status(201).json({ message: 'Absensi berhasil dicatat.' });
    } catch (error) {
        // 4. Tangani error
        console.error('Error mencatat absensi:', error);
        res.status(500).json({ message: 'Gagal mencatat absensi.' });
    }
};
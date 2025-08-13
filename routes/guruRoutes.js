// routes/guruRoutes.js

const express = require('express');
const pool = require('../config/db');
const router = express.Router();
const { verifyGuru } = require('../middleware/authMiddleware');

router.post('/absensi', verifyGuru, async (req, res) => {
    const { id_santri, tanggal, status } = req.body;

    if (!id_santri || !tanggal || !status) {
        return res.status(400).json({ message: 'Data absensi tidak lengkap.' });
    }

    try {
        await pool.query(
            'INSERT INTO absensi (id_santri, tanggal, status) VALUES (?, ?, ?)',
            [id_santri, tanggal, status]
        );
        res.status(201).json({ message: 'Absensi berhasil dicatat.' });
    } catch (error) {
        console.error('Error mencatat absensi:', error);
        res.status(500).json({ message: 'Gagal mencatat absensi.' });
    }
});

module.exports = router;
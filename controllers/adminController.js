// controllers/adminController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- Fungsi untuk GANTI PASSWORD ADMIN SENDIRI ---
exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const { id_pengguna } = req.session.user; 

    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Password lama dan baru harus diisi.' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });

    try {
        const [users] = await pool.query('SELECT kata_sandi FROM pengguna WHERE id = ?', [id_pengguna]);
        if (users.length === 0) return res.status(404).json({ message: 'Akun admin tidak ditemukan.' });

        const isMatch = await bcrypt.compare(oldPassword, users[0].kata_sandi);
        if (!isMatch) return res.status(401).json({ message: 'Password lama salah.' });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE pengguna SET kata_sandi = ? WHERE id = ?', [hashedNewPassword, id_pengguna]);

        res.status(200).json({ message: 'Password Anda berhasil diubah.' });
    } catch (error) {
        console.error("Error saat admin ganti password:", error);
        res.status(500).json({ message: "Gagal mengubah password." });
    }
};

// --- Fungsi untuk GANTI USERNAME ADMIN SENDIRI ---
exports.changeUsername = async (req, res) => {
    const { newUsername } = req.body;
    const { id_pengguna, username: oldUsername } = req.session.user;

    if (!newUsername) return res.status(400).json({ message: 'Username baru harus diisi.' });
    if (newUsername === oldUsername) return res.status(400).json({ message: 'Username baru sama dengan username lama.' });

    try {
        await pool.query('UPDATE pengguna SET username = ? WHERE id = ?', [newUsername, id_pengguna]);
        req.session.user.username = newUsername;
        req.session.save(err => {
            if (err) {
                console.error("Gagal menyimpan sesi:", err);
                return res.status(500).json({ message: "Username diubah, tapi gagal update sesi. Harap login kembali." });
            }
            res.status(200).json({ message: 'Username Anda berhasil diubah.', newUsername });
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username ini sudah digunakan.' });
        console.error("Error saat admin ganti username:", error);
        res.status(500).json({ message: "Gagal mengubah username." });
    }
};
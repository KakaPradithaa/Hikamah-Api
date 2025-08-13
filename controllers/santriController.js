// controllers/santriController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Fungsi untuk GET /biodata 
exports.getBiodata = async (req, res) => {
    const id_santri_aktif = req.session.user.id_santri;
    try {
        const [santri] = await pool.query(
            `SELECT nama_lengkap, nisn, tanggal_lahir, jenis_kelamin, alamat, foto_profil FROM santri WHERE id = ?`,
            [id_santri_aktif]
        );
        if (santri.length === 0) return res.status(404).json({ message: 'Data santri tidak ditemukan.' });
        res.status(200).json(santri[0]);
    } catch (error) {
        console.error('Error saat mengambil biodata:', error);
        res.status(500).json({ message: 'Gagal mengambil biodata santri.' });
    }
};

// Fungsi untuk PUT /update-biodata
exports.updateBiodata = async (req, res) => {
    const id_santri_aktif = req.session.user.id_santri;
    if (!id_santri_aktif) {
        return res.status(400).json({ message: 'ID Santri tidak ditemukan di dalam sesi.' });
    }

    const fieldsToUpdate = {};
    const allowedFields = ['nama_lengkap', 'tanggal_lahir', 'jenis_kelamin', 'alamat'];

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) fieldsToUpdate[field] = req.body[field];
    }

    const updateKeys = Object.keys(fieldsToUpdate);
    if (updateKeys.length === 0) return res.status(400).json({ message: 'Tidak ada data valid yang dikirim untuk diupdate.' });
    
    const setClause = updateKeys.map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(fieldsToUpdate), id_santri_aktif];
    const sql = `UPDATE santri SET ${setClause} WHERE id = ?`;

    try {
        const [result] = await pool.query(sql, values);
        if (result.affectedRows === 0) return res.status(404).json({ message: `Santri tidak ditemukan atau data tidak berubah.` });
        res.status(200).json({ message: 'Biodata santri berhasil diperbarui.' });
    } catch (error) {
        console.error('Error saat memperbarui biodata:', error);
        res.status(500).json({ message: 'Gagal memperbarui biodata.' });
    }
};


// Fungsi untuk POST /change-password
exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const { id_pengguna } = req.session.user;

    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Password lama dan baru harus diisi.' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });

    try {
        const [users] = await pool.query('SELECT kata_sandi FROM pengguna WHERE id = ?', [id_pengguna]);
        if (users.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        
        const isMatch = await bcrypt.compare(oldPassword, users[0].kata_sandi);
        if (!isMatch) return res.status(401).json({ message: 'Password lama salah.' });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE pengguna SET kata_sandi = ? WHERE id = ?', [hashedNewPassword, id_pengguna]);

        res.status(200).json({ message: 'Password berhasil diubah.' });
    } catch (error) {
        console.error("Error saat ganti password:", error);
        res.status(500).json({ message: "Gagal mengubah password." });
    }
};

// Fungsi untuk PUT /change-username
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
            res.status(200).json({ message: 'Username berhasil diubah.', newUsername });
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username ini sudah digunakan.' });
        console.error("Error saat ganti username:", error);
        res.status(500).json({ message: "Gagal mengubah username." });
    }
};

// Fungsi untuk POST /upload-photo
exports.uploadPhoto = async (req, res) => {
    const { id_santri } = req.session.user;

    if (!req.file) return res.status(400).json({ message: "Tidak ada file yang diunggah atau tipe file tidak sesuai." });

    const photoUrl = `/public/uploads/${req.file.filename}`;

    try {
        const [oldData] = await pool.query('SELECT foto_profil FROM santri WHERE id = ?', [id_santri]);
        if (oldData.length > 0 && oldData[0].foto_profil) {
            const oldPhotoPath = path.join(__dirname, '..', oldData[0].foto_profil);
            fs.unlink(oldPhotoPath, (err) => {
                if (err && err.code !== 'ENOENT') console.error("Gagal menghapus foto lama:", oldPhotoPath, err);
            });
        }

        await pool.query('UPDATE santri SET foto_profil = ? WHERE id = ?', [photoUrl, id_santri]);
        res.status(200).json({ message: "Foto profil berhasil diunggah.", photoUrl });
    } catch (error) {
        console.error("Error saat unggah foto:", error);
        res.status(500).json({ message: "Gagal menyimpan foto." });
    }
};
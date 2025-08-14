// controllers/santriManagementController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getUnverifiedRegistrations = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.id, s.nama_lengkap AS nama_santri, p.nama_lengkap AS nama_wali, p.email AS email_wali, s.tanggal_daftar
            FROM santri s
            JOIN pengguna p ON s.id_wali = p.id
            WHERE p.status_aktif = FALSE
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error get pendaftaran:', error);
        res.status(500).json({ message: 'Gagal mengambil data.' });
    }
};

exports.getAllSantri = async (req, res) => {
    try {
        const [santriList] = await pool.query(`
            SELECT s.id AS id_santri, s.nama_lengkap AS nama_santri, s.nisn, s.tanggal_lahir,
                   s.jenis_kelamin, s.alamat, w.nama_lengkap AS nama_wali, w.email AS email_wali
            FROM santri s
            LEFT JOIN pengguna w ON s.id_wali = w.id
            ORDER BY s.nama_lengkap ASC
        `);
        res.status(200).json(santriList);
    } catch (error) {
        console.error('Error saat mengambil semua data santri:', error);
        res.status(500).json({ message: 'Gagal mengambil data semua santri.' });
    }
};

exports.verifyRegistration = async (req, res) => {
    const { id_pendaftaran } = req.params;
    let connection;

    try {
        const [santriData] = await pool.query(
            `SELECT s.id, s.nama_lengkap AS nama_santri, s.tanggal_lahir, p.id AS id_wali FROM santri s 
             JOIN pengguna p ON s.id_wali = p.id WHERE s.id = ? AND s.id_pengguna IS NULL`,
            [id_pendaftaran]
        );
        if (santriData.length === 0) return res.status(404).json({ message: 'Data pendaftaran tidak ditemukan atau sudah diverifikasi.' });
        
        const santri = santriData[0];
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let baseUsername = santri.nama_santri.toLowerCase().replace(/\s+/g, '.');
        let finalUsername = baseUsername;
        let isUnique = false, counter = 0;
        while (!isUnique) {
            const [existingUser] = await connection.query('SELECT id FROM pengguna WHERE username = ?', [finalUsername]);
            if (existingUser.length === 0) {
                isUnique = true;
            } else {
                counter++;
                finalUsername = `${baseUsername}.${counter}`;
            }
        }
        const passwordSantri = santri.tanggal_lahir.toISOString().slice(0, 10).replace(/-/g, '');
        const hashedPasswordSantri = await bcrypt.hash(passwordSantri, 10);
        
        const [resultPenggunaSantri] = await connection.query(
            'INSERT INTO pengguna (nama_lengkap, username, kata_sandi, peran, status_aktif) VALUES (?, ?, ?, ?, ?)',
            [santri.nama_santri, finalUsername, hashedPasswordSantri, 'Santri', true]
        );
        const idPenggunaSantri = resultPenggunaSantri.insertId;

        await connection.query('UPDATE santri SET id_pengguna = ? WHERE id = ?', [idPenggunaSantri, id_pendaftaran]);
        await connection.query('UPDATE pengguna SET status_aktif = TRUE WHERE id = ?', [santri.id_wali]);
        
        await connection.commit();
        res.status(200).json({ message: 'Pendaftaran berhasil diverifikasi.', username: finalUsername, password: passwordSantri });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error verifikasi:', error);
        res.status(500).json({ message: 'Verifikasi gagal.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateNisn = async (req, res) => {
    const { id_santri } = req.params;
    const { nisn } = req.body;
    if (!nisn) return res.status(400).json({ message: 'NISN harus diisi.' });
    try {
        const [nisnCheck] = await pool.query('SELECT id FROM santri WHERE nisn = ? AND id != ?', [nisn, id_santri]);
        if (nisnCheck.length > 0) return res.status(409).json({ message: 'NISN ini sudah digunakan.' });
        const [result] = await pool.query('UPDATE santri SET nisn = ? WHERE id = ?', [nisn, id_santri]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `Santri dengan ID ${id_santri} tidak ditemukan.` });
        res.status(200).json({ message: 'NISN berhasil diperbarui.' });
    } catch (error) {
        console.error('Error saat update NISN:', error);
        res.status(500).json({ message: 'Gagal memperbarui NISN.' });
    }
};

exports.deleteSantri = async (req, res) => {
    const { id_santri } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [santriData] = await connection.query('SELECT id_pengguna, id_wali FROM santri WHERE id = ?', [id_santri]);
        if (santriData.length === 0) {
            await connection.rollback();
            return res.status(444).json({ message: 'Santri tidak ditemukan.' });
        }
        
        const { id_pengguna: id_pengguna_santri, id_wali: id_pengguna_wali } = santriData[0];
        
        // --- URUTAN DELETE YANG BENAR ---
        // Hapus dari semua tabel 'anak' yang memiliki referensi ke 'santri.id' terlebih dahulu.
        await connection.query('DELETE FROM absensi WHERE id_santri = ?', [id_santri]);
        await connection.query('DELETE FROM nilai WHERE id_santri = ?', [id_santri]);
        await connection.query('DELETE FROM progres_hafalan WHERE id_santri = ?', [id_santri]);
        await connection.query('DELETE FROM catatan_perilaku WHERE id_santri = ?', [id_santri]);
        await connection.query('DELETE FROM pembayaran WHERE id_santri = ?', [id_santri]);
        
        // --- BARIS YANG HILANG DITAMBAHKAN DI SINI ---
        // Hapus dari tabel penghubung santri_kelas SEBELUM menghapus dari tabel santri.
        await connection.query('DELETE FROM santri_kelas WHERE id_santri = ?', [id_santri]);
        
        // --- SEKARANG, BARU HAPUS DARI TABEL 'INDUK' ---
        // Hapus data orang tua yang merujuk ke santri.id
        await connection.query('DELETE FROM orang_tua WHERE id_santri = ?', [id_santri]);
        // Hapus data santri itu sendiri. Query ini sekarang akan berhasil.
        await connection.query('DELETE FROM santri WHERE id = ?', [id_santri]);

        // Hapus akun pengguna yang terkait (jika ada)
        if (id_pengguna_santri) {
            await connection.query('DELETE FROM pengguna WHERE id = ?', [id_pengguna_santri]);
        }
        if (id_pengguna_wali) {
            // Kita tidak perlu lagi menghapus dari wali_santri
            await connection.query('DELETE FROM pengguna WHERE id = ?', [id_pengguna_wali]);
        }

        await connection.commit();
        res.status(200).json({ message: `Santri dengan ID ${id_santri} dan semua data terkait berhasil dihapus.` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error saat menghapus santri:', error);
        res.status(500).json({ message: 'Gagal menghapus data santri.' });
    } finally {
        if (connection) connection.release();
    }
};

// --- Admin: Melihat Semua Data Santri (Dengan Pengelompokan) ---
exports.getAllSantri = async (req, res) => {
    // Ambil tahun ajaran saat ini untuk memfilter santri yang aktif di tahun ini
    const tahun_ajaran_sekarang = new Date().getFullYear();

    try {
        // Query ini sekarang lebih kompleks, menggabungkan 5 tabel
        const [santriList] = await pool.query(`
            SELECT 
                s.id AS id_santri,
                s.nama_lengkap AS nama_santri,
                s.nisn,
                s.foto_profil,
                w.nama_lengkap AS nama_wali,
                k.nama_kelas,
                jp.nama_jenjang
            FROM santri s
            LEFT JOIN pengguna w ON s.id_wali = w.id
            LEFT JOIN santri_kelas sk ON s.id = sk.id_santri
            LEFT JOIN kelas k ON sk.id_kelas = k.id
            LEFT JOIN jenjang_pendidikan jp ON k.id_jenjang = jp.id
            WHERE sk.tahun_ajaran = ? OR sk.tahun_ajaran IS NULL
            ORDER BY jp.nama_jenjang, k.nama_kelas, s.nama_lengkap
        `, [tahun_ajaran_sekarang]);

        // Mengelompokkan hasil berdasarkan jenjang dan kelas
        const groupedData = santriList.reduce((acc, santri) => {
            // Tentukan kategori jenjang, default ke 'Belum Ditempatkan'
            const jenjang = santri.nama_jenjang || 'Santri Belum Ditempatkan di Kelas';
            // Tentukan nama kelas
            const kelas = santri.nama_kelas;

            // Buat objek jenjang jika belum ada
            if (!acc[jenjang]) {
                acc[jenjang] = {};
            }

            // Jika santri punya kelas, kelompokkan berdasarkan nama kelas
            if (kelas) {
                if (!acc[jenjang][kelas]) {
                    acc[jenjang][kelas] = [];
                }
                acc[jenjang][kelas].push({
                    id_santri: santri.id_santri,
                    nama_santri: santri.nama_santri,
                    nisn: santri.nisn,
                    foto_profil: santri.foto_profil,
                    nama_wali: santri.nama_wali
                });
            } else {
                // Jika santri belum punya kelas, masukkan ke dalam array 'tanpa_kelas'
                if (!acc[jenjang].tanpa_kelas) {
                    acc[jenjang].tanpa_kelas = [];
                }
                 acc[jenjang].tanpa_kelas.push({
                    id_santri: santri.id_santri,
                    nama_santri: santri.nama_santri,
                    nisn: santri.nisn,
                    foto_profil: santri.foto_profil,
                    nama_wali: santri.nama_wali
                });
            }
            
            return acc;
        }, {});

        res.status(200).json(groupedData);

    } catch (error) {
        console.error('Error saat mengambil semua data santri:', error);
        res.status(500).json({ message: 'Gagal mengambil data semua santri.' });
    }
};
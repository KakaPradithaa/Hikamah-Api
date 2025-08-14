// controllers/guruManagementController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- Admin: Membuat Akun Guru Baru ---
exports.createGuru = async (req, res) => {
    const { nama_lengkap, username, email, tempat_lahir, tanggal_lahir, alamat, tahun_mengajar, pendidikan_tertinggi, jabatan } = req.body;

    if (!nama_lengkap || !username || !email || !tanggal_lahir) {
        return res.status(400).json({ message: "Nama lengkap, username, email, dan tanggal lahir harus diisi." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingUser] = await connection.query('SELECT id FROM pengguna WHERE username = ? OR email = ?', [username, email]);
        if (existingUser.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: "Username atau email sudah digunakan." });
        }

        const defaultPassword = tanggal_lahir.replace(/-/g, '');
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const [resultPengguna] = await connection.query(
            'INSERT INTO pengguna (nama_lengkap, username, email, kata_sandi, peran, status_aktif) VALUES (?, ?, ?, ?, ?, ?)',
            [nama_lengkap, username, email, hashedPassword, 'Guru', true]
        );
        const idPenggunaGuru = resultPengguna.insertId;

        await connection.query(
            'INSERT INTO guru (id_pengguna, tempat_lahir, tanggal_lahir, alamat, tahun_mengajar, pendidikan_tertinggi, jabatan) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [idPenggunaGuru, tempat_lahir, tanggal_lahir, alamat, tahun_mengajar, pendidikan_tertinggi, jabatan]
        );

        await connection.commit();
        res.status(201).json({ message: `Akun untuk guru ${nama_lengkap} berhasil dibuat.`, username, password: defaultPassword });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error saat membuat akun guru:", error);
        res.status(500).json({ message: "Gagal membuat akun guru." });
    } finally {
        if (connection) connection.release();
    }
};

// --- Admin: Melihat Semua Data Guru ---
exports.getAllGuru = async (req, res) => {
    try {
        const [guruList] = await pool.query(`
            SELECT 
                g.id AS id_guru,
                p.id AS id_pengguna,
                p.nama_lengkap,
                p.username,
                p.email,
                g.tempat_lahir,
                g.tanggal_lahir,
                g.alamat,
                g.tahun_mengajar,
                g.pendidikan_tertinggi,
                g.jabatan
            FROM guru g
            JOIN pengguna p ON g.id_pengguna = p.id
            ORDER BY p.nama_lengkap ASC
        `);
        res.status(200).json(guruList);
    } catch (error) {
        console.error("Error saat mengambil data guru:", error);
        res.status(500).json({ message: "Gagal mengambil data guru." });
    }
};

// --- Admin: Mengupdate Data Guru ---
exports.updateGuru = async (req, res) => {
    const { id_guru } = req.params;
    const { nama_lengkap, username, email, tempat_lahir, tanggal_lahir, alamat, tahun_mengajar, pendidikan_tertinggi, jabatan } = req.body;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [guruData] = await connection.query('SELECT id_pengguna FROM guru WHERE id = ?', [id_guru]);
        if (guruData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Data guru tidak ditemukan." });
        }
        const id_pengguna = guruData[0].id_pengguna;

        // Update tabel pengguna
        await connection.query(
            'UPDATE pengguna SET nama_lengkap = ?, username = ?, email = ? WHERE id = ?',
            [nama_lengkap, username, email, id_pengguna]
        );
        // Update tabel guru
        await connection.query(
            'UPDATE guru SET tempat_lahir = ?, tanggal_lahir = ?, alamat = ?, tahun_mengajar = ?, pendidikan_tertinggi = ?, jabatan = ? WHERE id = ?',
            [tempat_lahir, tanggal_lahir, alamat, tahun_mengajar, pendidikan_tertinggi, jabatan, id_guru]
        );

        await connection.commit();
        res.status(200).json({ message: "Data guru berhasil diperbarui." });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Username atau email sudah digunakan." });
        console.error("Error saat update data guru:", error);
        res.status(500).json({ message: "Gagal update data guru." });
    } finally {
        if (connection) connection.release();
    }
};

// --- Admin: Menghapus Data Guru ---
exports.deleteGuru = async (req, res) => {
    const { id_guru } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [guruData] = await connection.query('SELECT id_pengguna FROM guru WHERE id = ?', [id_guru]);
        if (guruData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Data guru tidak ditemukan." });
        }
        const id_pengguna = guruData[0].id_pengguna;

        // Hapus dari tabel anak dulu
        await connection.query('DELETE FROM guru WHERE id = ?', [id_guru]);
        // Hapus dari tabel induk
        await connection.query('DELETE FROM pengguna WHERE id = ?', [id_pengguna]);
        // Anda juga perlu menghapus data absensi atau nilai yang terkait dengan guru ini jika ada

        await connection.commit();
        res.status(200).json({ message: "Data guru berhasil dihapus." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error saat hapus guru:", error);
        res.status(500).json({ message: "Gagal menghapus guru." });
    } finally {
        if (connection) connection.release();
    }
};

// --- Admin: Melihat Daftar Semua Wali Kelas ---
exports.getAllWaliKelas = async (req, res) => {
    try {
        // Query ini menggabungkan 4 tabel untuk mendapatkan informasi lengkap
        const [waliKelasList] = await pool.query(`
            SELECT 
                k.id AS id_kelas,
                k.nama_kelas,
                jp.nama_jenjang,
                g.id AS id_guru,
                p.nama_lengkap AS nama_wali_kelas,
                p.username AS username_wali_kelas
            FROM 
                kelas k
            JOIN 
                jenjang_pendidikan jp ON k.id_jenjang = jp.id
            LEFT JOIN 
                guru g ON k.id_wali_kelas = g.id
            LEFT JOIN 
                pengguna p ON g.id_pengguna = p.id
            ORDER BY 
                jp.id, k.nama_kelas ASC
        `);

        // (Opsional) Mengelompokkan hasil berdasarkan jenjang untuk tampilan yang lebih rapi di frontend
        const groupedByJenjang = waliKelasList.reduce((acc, item) => {
            const jenjang = item.nama_jenjang;
            if (!acc[jenjang]) {
                acc[jenjang] = [];
            }
            acc[jenjang].push({
                id_kelas: item.id_kelas,
                nama_kelas: item.nama_kelas,
                id_guru: item.id_guru, // Bisa null jika belum ada wali kelas
                nama_wali_kelas: item.nama_wali_kelas // Bisa null
            });
            return acc;
        }, {});

        res.status(200).json(groupedByJenjang);

    } catch (error) {
        console.error("Error saat mengambil data wali kelas:", error);
        res.status(500).json({ message: "Gagal mengambil data wali kelas." });
    }
};

// --- Admin: Menghapus Data Guru ---
exports.deleteGuru = async (req, res) => {
    const { id_guru } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Cari tahu ID PENGGUNA yang terkait dengan guru ini
        const [guruData] = await connection.query('SELECT id_pengguna FROM guru WHERE id = ?', [id_guru]);
        if (guruData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Data guru tidak ditemukan." });
        }
        const id_pengguna = guruData[0].id_pengguna;

        // 2. Hapus dari tabel anak dulu. 
        // Foreign key di 'kelas' (ON DELETE SET NULL) akan otomatis menangani pelepasan jabatan wali kelas.
        // Foreign key di 'jadwal_mengajar' (ON DELETE CASCADE) akan otomatis menghapus jadwal mengajarnya.
        await connection.query('DELETE FROM guru WHERE id = ?', [id_guru]);

        // 3. Hapus dari tabel induk (pengguna)
        await connection.query('DELETE FROM pengguna WHERE id = ?', [id_pengguna]);

        await connection.commit();
        res.status(200).json({ message: "Data guru dan akun pengguna terkait berhasil dihapus." });
    } catch (error) {
        if (connection) await connection.rollback();
        // Menangani kasus jika guru masih terkait dengan data nilai (jika ada foreign key)
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(409).json({ message: "Gagal menghapus. Guru ini masih memiliki catatan nilai yang terhubung. Hapus catatan nilai terlebih dahulu." });
        }
        console.error("Error saat hapus guru:", error);
        res.status(500).json({ message: "Gagal menghapus guru." });
    } finally {
        if (connection) connection.release();
    }
};
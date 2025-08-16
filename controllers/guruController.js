// controllers/guruController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- Fungsi yang bisa dilakukan oleh SEMUA GURU ---

// Guru Melihat Profilnya Sendiri
exports.getProfile = async (req, res) => {
    const { id_pengguna } = req.session.user;
    try {
        const [guruProfile] = await pool.query(`
            SELECT p.nama_lengkap, p.username, p.email, g.tempat_lahir, g.tanggal_lahir, 
                   g.alamat, g.tahun_mengajar, g.pendidikan_tertinggi, g.jabatan
            FROM guru g JOIN pengguna p ON g.id_pengguna = p.id WHERE p.id = ?
        `, [id_pengguna]);

        if (guruProfile.length === 0) return res.status(404).json({ message: "Data profil guru tidak ditemukan." });
        res.status(200).json(guruProfile[0]);
    } catch (error) {
        console.error("Error saat mengambil profil guru:", error);
        res.status(500).json({ message: "Gagal mengambil data profil." });
    }
};

// Guru Menginput Absensi Harian (bisa untuk beberapa santri sekaligus)
exports.createAbsensi = async (req, res) => {
    const { id_pengguna } = req.session.user;
    const { tanggal, absensi_data } = req.body;
    if (!tanggal || !absensi_data || !Array.isArray(absensi_data)) return res.status(400).json({ message: "Tanggal dan data absensi (array) harus diisi." });

    let connection;
    try {
        const [guruData] = await pool.query('SELECT id FROM guru WHERE id_pengguna = ?', [id_pengguna]);
        const id_guru = guruData[0].id;
        connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const absen of absensi_data) {
            const sql = 'INSERT INTO absensi (id_santri, id_guru, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), keterangan=VALUES(keterangan)';
            await connection.query(sql, [absen.id_santri, id_guru, tanggal, absen.status, absen.keterangan || null]);
        }
        await connection.commit();
        res.status(201).json({ message: "Data absensi berhasil disimpan." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error saat menyimpan absensi:", error);
        res.status(500).json({ message: "Gagal menyimpan data absensi." });
    } finally {
        if (connection) connection.release();
    }
};

// --- Fungsi untuk Guru menginput nilai (Dengan Query SQL yang Sudah Diperbaiki) ---
exports.inputNilai = async (req, res) => {
    const { id_pengguna } = req.session.user;
    const { id_santri, id_mapel, tahun_ajaran, semester, nilai_tugas, nilai_uts, nilai_uas, deskripsi_guru } = req.body;

    if (!id_santri || !id_mapel || !tahun_ajaran || !semester) {
        return res.status(400).json({ message: "Data esensial (santri, mapel, periode) harus diisi." });
    }

    try {
        const [guruData] = await pool.query('SELECT id FROM guru WHERE id_pengguna = ?', [id_pengguna]);
        if (guruData.length === 0) return res.status(403).json({ message: "Profil guru tidak ditemukan." });
        
        const id_guru = guruData[0].id;
        
        const [jadwalCheck] = await pool.query(
            'SELECT id FROM jadwal_mengajar WHERE id_guru = ? AND id_mapel = ? AND tahun_ajaran = ?', 
            [id_guru, id_mapel, tahun_ajaran]
        );
        if (jadwalCheck.length === 0) {
            return res.status(403).json({ message: "Anda tidak terdaftar sebagai pengajar mata pelajaran ini pada tahun ajaran tersebut." });
        }
        
        const BOBOT_TUGAS = 0.30, BOBOT_UTS = 0.30, BOBOT_UAS = 0.40;
        const tugas = Number(nilai_tugas) || 0;
        const uts = Number(nilai_uts) || 0;
        const uas = Number(nilai_uas) || 0;
        const nilai_akhir_calculated = (tugas * BOBOT_TUGAS) + (uts * BOBOT_UTS) + (uas * BOBOT_UAS);
        
        // --- INI ADALAH QUERY YANG SUDAH DIPERBAIKI ---
        const sql = `
            INSERT INTO nilai 
                (id_santri, id_mapel, id_guru, tahun_ajaran, semester, nilai_tugas, nilai_uts, nilai_uas, nilai_akhir, deskripsi_guru) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                nilai_tugas = VALUES(nilai_tugas), 
                nilai_uts = VALUES(nilai_uts), 
                nilai_uas = VALUES(nilai_uas), 
                nilai_akhir = VALUES(nilai_akhir),
                deskripsi_guru = VALUES(deskripsi_guru)
        `;
        
        await pool.query(sql, [
            id_santri, id_mapel, id_guru, tahun_ajaran, semester, 
            nilai_tugas, nilai_uts, nilai_uas, nilai_akhir_calculated, deskripsi_guru
        ]);

        res.status(201).json({ message: "Nilai dan deskripsi berhasil disimpan." });
    } catch (error) {
        console.error("Error saat input nilai:", error);
        res.status(500).json({ message: "Gagal menginput nilai." });
    }
};
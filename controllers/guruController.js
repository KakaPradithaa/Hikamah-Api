// controllers/guruController.js

const pool = require('../config/db');

// --- Fungsi untuk POST /absensi ---
// Logika dari file rute Anda yang lama dipindahkan ke sini.
exports.recordAbsensi = async (req, res) => {
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
};

// --- Fungsi untuk Wali Kelas melihat santri di kelasnya ---
exports.getSantriByWaliKelas = async (req, res) => {
    const id_kelas = req.id_kelas_wali; 
    const tahun_ajaran_sekarang = new Date().getFullYear();

    try {
        const [santriList] = await pool.query(`
            SELECT s.id, s.nama_lengkap, s.nisn, s.foto_profil, jp.nama_jenjang, k.nama_kelas
            FROM santri s
            JOIN santri_kelas sk ON s.id = sk.id_santri
            JOIN kelas k ON sk.id_kelas = k.id
            JOIN jenjang_pendidikan jp ON k.id_jenjang = jp.id
            WHERE sk.id_kelas = ? AND sk.tahun_ajaran = ?
            ORDER BY s.nama_lengkap ASC
        `, [id_kelas, tahun_ajaran_sekarang]);

        res.status(200).json(santriList);
    } catch (error) {
        console.error("Error saat wali kelas mengambil data santri:", error);
        res.status(500).json({ message: "Gagal mengambil data santri." });
    }
};

// --- Fungsi untuk Guru menginput nilai ---
exports.inputNilai = async (req, res) => {
    const { id_pengguna } = req.session.user;
    // Tambahkan 'deskripsi_guru' ke dalam daftar yang diambil dari body
    const { id_santri, id_mapel, tahun_ajaran, semester, nilai_tugas, nilai_uts, nilai_uas, deskripsi_guru } = req.body;

    if (!id_santri || !id_mapel || !tahun_ajaran || !semester) {
        return res.status(400).json({ message: "Data santri, mapel, tahun ajaran, dan semester harus diisi." });
    }

    try {
        const [guruData] = await pool.query('SELECT id FROM guru WHERE id_pengguna = ?', [id_pengguna]);
        if (guruData.length === 0) return res.status(403).json({ message: "Profil guru tidak ditemukan." });
        
        const id_guru = guruData[0].id;

        // ... (validasi jadwalCheck tetap sama)

        // --- Perhitungan Nilai Akhir Otomatis (Tetap Ada) ---
        const BOBOT_TUGAS = 0.30, BOBOT_UTS = 0.30, BOBOT_UAS = 0.40;
        const tugas = Number(nilai_tugas) || 0;
        const uts = Number(nilai_uts) || 0;
        const uas = Number(nilai_uas) || 0;
        const nilai_akhir_calculated = (tugas * BOBOT_TUGAS) + (uts * BOBOT_UTS) + (uas * BOBOT_UAS);

        // --- Query SQL Diperbarui untuk Menyimpan Deskripsi ---
        const sql = `
            INSERT INTO nilai (id_santri, id_mapel, id_guru, tahun_ajaran, semester, nilai_tugas, nilai_uts, nilai_uas, nilai_akhir, deskripsi_guru) 
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
            nilai_tugas, nilai_uts, nilai_uas, nilai_akhir_calculated,
            deskripsi_guru // <-- Masukkan deskripsi dari body ke query
        ]);

        res.status(201).json({ message: "Nilai dan deskripsi berhasil disimpan." });
    } catch (error) {
        console.error("Error saat input nilai:", error);
        res.status(500).json({ message: "Gagal menginput nilai." });
    }
};

exports.setKenaikanKelas = async (req, res) => {
    // ID kelas yang dipegang wali diambil dari middleware
    const id_kelas_wali = req.id_kelas_wali;
    // Admin akan mengirim ID santri di URL dan status di body
    const { id_santri } = req.params;
    const { status_kenaikan, tahun_ajaran } = req.body;

    // Validasi input
    const validStatus = ['Naik Kelas', 'Tidak Naik Kelas', 'Lulus'];
    if (!status_kenaikan || !validStatus.includes(status_kenaikan) || !tahun_ajaran) {
        return res.status(400).json({ message: "Status kenaikan (Naik Kelas/Tidak Naik Kelas/Lulus) dan tahun ajaran harus diisi." });
    }

    try {
        // Verifikasi bahwa santri tersebut memang ada di kelas wali ini pada tahun ajaran tsb
        const [santriCheck] = await pool.query(
            'SELECT id FROM santri_kelas WHERE id_santri = ? AND id_kelas = ? AND tahun_ajaran = ?',
            [id_santri, id_kelas_wali, tahun_ajaran]
        );
        if (santriCheck.length === 0) {
            return res.status(404).json({ message: "Santri tidak ditemukan di kelas Anda pada tahun ajaran ini." });
        }

        // Update status kenaikan di tabel santri_kelas
        await pool.query(
            'UPDATE santri_kelas SET status_kenaikan = ? WHERE id_santri = ? AND id_kelas = ? AND tahun_ajaran = ?',
            [status_kenaikan, id_santri, id_kelas_wali, tahun_ajaran]
        );

        res.status(200).json({ message: `Status kenaikan untuk santri berhasil ditetapkan menjadi '${status_kenaikan}'.` });
    } catch (error) {
        console.error("Error saat menetapkan status kenaikan:", error);
        res.status(500).json({ message: "Gagal menetapkan status kenaikan." });
    }
};

// --- Fungsi untuk GET /profile ---
// Mengambil semua data detail untuk guru yang sedang login
exports.getProfile = async (req, res) => {
    // Ambil ID PENGGUNA dari sesi Guru
    const { id_pengguna } = req.session.user;

    try {
        const [guruProfile] = await pool.query(`
            SELECT 
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
            WHERE p.id = ?
        `, [id_pengguna]);

        if (guruProfile.length === 0) {
            return res.status(404).json({ message: "Data profil guru tidak ditemukan." });
        }

        res.status(200).json(guruProfile[0]);
    } catch (error) {
        console.error("Error saat mengambil profil guru:", error);
        res.status(500).json({ message: "Gagal mengambil data profil." });
    }
};
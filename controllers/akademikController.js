// controllers/akademikController.js
const pool = require('../config/db');

// --- MANAJEMEN MATA PELAJARAN ---
exports.createMapel = async (req, res) => {
    const { nama_mapel, deskripsi } = req.body;
    if (!nama_mapel) return res.status(400).json({ message: "Nama mata pelajaran harus diisi." });
    try {
        await pool.query('INSERT INTO mata_pelajaran (nama_mapel, deskripsi) VALUES (?, ?)', [nama_mapel, deskripsi]);
        res.status(201).json({ message: `Mata pelajaran '${nama_mapel}' berhasil dibuat.` });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Mata pelajaran ini sudah ada." });
        console.error("Error saat membuat mapel:", error);
        res.status(500).json({ message: "Gagal membuat mata pelajaran." });
    }
};

exports.getAllMapel = async (req, res) => {
    try {
        const [mapels] = await pool.query('SELECT * FROM mata_pelajaran ORDER BY nama_mapel ASC');
        res.status(200).json(mapels);
    } catch (error) {
        console.error("Error mengambil mapel:", error);
        res.status(500).json({ message: "Gagal mengambil data mata pelajaran." });
    }
};

// --- MANAJEMEN KURIKULUM (MAPEL DI SETIAP JENJANG) ---
exports.addMapelToJenjang = async (req, res) => {
    const { id_jenjang } = req.params;
    const { id_mapel } = req.body;
    if (!id_mapel) return res.status(400).json({ message: "ID Mata Pelajaran harus diisi." });
    try {
        await pool.query('INSERT INTO kurikulum (id_mapel, id_jenjang) VALUES (?, ?)', [id_mapel, id_jenjang]);
        res.status(201).json({ message: "Mata pelajaran berhasil ditambahkan ke kurikulum jenjang." });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Mata pelajaran ini sudah ada di kurikulum jenjang ini." });
        console.error("Error menambah mapel ke jenjang:", error);
        res.status(500).json({ message: "Gagal menambahkan mata pelajaran ke kurikulum." });
    }
};

// --- MANAJEMEN JADWAL MENGAJAR (GURU MENGAJAR APA DI KELAS MANA) ---
exports.assignGuruToJadwal = async (req, res) => {
    // URL: /kelas/:id_kelas/mapel/:id_mapel/assign-guru
    const { id_kelas, id_mapel } = req.params;
    const { id_guru, tahun_ajaran } = req.body;
    if (!id_guru || !tahun_ajaran) return res.status(400).json({ message: "ID Guru dan tahun ajaran harus diisi." });
    try {
        await pool.query("UPDATE guru SET jabatan = 'Guru Mapel' WHERE id = ?", [id_guru]);
        const sql = 'INSERT INTO jadwal_mengajar (id_guru, id_mapel, id_kelas, tahun_ajaran) VALUES (?, ?, ?, ?)';
        await pool.query(sql, [id_guru, id_mapel, id_kelas, tahun_ajaran]);
        res.status(201).json({ message: "Guru berhasil ditugaskan untuk mengajar mata pelajaran ini." });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Jadwal ini (guru, mapel, kelas, tahun) sudah ada." });
        console.error("Error menugaskan guru:", error);
        res.status(500).json({ message: "Gagal menugaskan guru." });
    }
};

// --- Admin: MENGUBAH Guru yang Mengajar sebuah Jadwal ---
exports.updateGuruOnJadwal = async (req, res) => {
    // URL: /jadwal/:id_jadwal/update-guru
    // Kita akan mengidentifikasi jadwal berdasarkan ID uniknya
    const { id_jadwal } = req.params;
    const { id_guru_baru } = req.body;

    if (!id_guru_baru) {
        return res.status(400).json({ message: "ID Guru baru harus diisi." });
    }

    try {
        const [result] = await pool.query(
            'UPDATE jadwal_mengajar SET id_guru = ? WHERE id = ?',
            [id_guru_baru, id_jadwal]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Jadwal dengan ID ${id_jadwal} tidak ditemukan.` });
        }
        
        // Pastikan jabatan guru baru juga diupdate
        await pool.query("UPDATE guru SET jabatan = 'Guru Mapel' WHERE id = ?", [id_guru_baru]);

        res.status(200).json({ message: "Guru pengajar untuk jadwal ini berhasil diubah." });
    } catch (error) {
        console.error("Error saat update guru di jadwal:", error);
        res.status(500).json({ message: "Gagal mengupdate guru di jadwal." });
    }
};

// --- Admin: MENGHAPUS sebuah Jadwal Mengajar ---
exports.deleteJadwal = async (req, res) => {
    // URL: /jadwal/:id_jadwal
    const { id_jadwal } = req.params;

    try {
        const [result] = await pool.query(
            'DELETE FROM jadwal_mengajar WHERE id = ?',
            [id_jadwal]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Jadwal dengan ID ${id_jadwal} tidak ditemukan.` });
        }

        res.status(200).json({ message: "Jadwal mengajar berhasil dihapus." });
    } catch (error) {
        console.error("Error saat menghapus jadwal:", error);
        res.status(500).json({ message: "Gagal menghapus jadwal." });
    }
};

// --- Admin: Melihat SEMUA Jadwal Mengajar (Sangat Berguna untuk Frontend) ---
exports.getAllJadwal = async (req, res) => {
    try {
        const [jadwalList] = await pool.query(`
            SELECT
                jm.id AS id_jadwal,
                jm.tahun_ajaran,
                k.nama_kelas,
                mp.nama_mapel,
                p.nama_lengkap AS nama_guru
            FROM jadwal_mengajar jm
            JOIN kelas k ON jm.id_kelas = k.id
            JOIN mata_pelajaran mp ON jm.id_mapel = mp.id
            JOIN guru g ON jm.id_guru = g.id
            JOIN pengguna p ON g.id_pengguna = p.id
            ORDER BY jm.tahun_ajaran DESC, k.nama_kelas ASC, mp.nama_mapel ASC
        `);
        res.status(200).json(jadwalList);
    } catch (error) {
        console.error("Error saat mengambil semua jadwal:", error);
        res.status(500).json({ message: "Gagal mengambil semua jadwal mengajar." });
    }
};

// --- Admin: Menghapus Mata Pelajaran ---
exports.deleteMapel = async (req, res) => {
    const { id_mapel } = req.params;
    try {
        // Karena kita menggunakan ON DELETE CASCADE, menghapus mapel di sini akan
        // secara otomatis menghapus semua entri terkait di tabel 'kurikulum' dan 'jadwal_mengajar'.
        const [result] = await pool.query('DELETE FROM mata_pelajaran WHERE id = ?', [id_mapel]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Mata pelajaran dengan ID ${id_mapel} tidak ditemukan.` });
        }

        res.status(200).json({ message: "Mata pelajaran berhasil dihapus." });
    } catch (error) {
        // Menangani kasus jika mapel masih terkait dengan data nilai
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ message: "Gagal menghapus. Mata pelajaran ini masih memiliki catatan nilai yang terhubung. Hapus catatan nilai terlebih dahulu." });
        }
        console.error("Error saat menghapus mata pelajaran:", error);
        res.status(500).json({ message: "Gagal menghapus mata pelajaran." });
    }
};
// controllers/waliKelasController.js

const pool = require('../config/db');

// --- Fungsi Helper (jika diperlukan untuk predikat di rekap rapor) ---
function getPredikat(nilai) {
    if (nilai === null || nilai === undefined) return '-';
    if (nilai >= 90) return 'A';
    if (nilai >= 80) return 'B';
    if (nilai >= 70) return 'C';
    return 'D';
}


// --- Fungsi yang HANYA bisa dilakukan oleh WALI KELAS ---

// Wali Kelas Melihat Daftar Santri di Kelasnya
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
            WHERE sk.id_kelas = ? AND sk.tahun_ajaran = ? ORDER BY s.nama_lengkap ASC
        `, [id_kelas, tahun_ajaran_sekarang]);
        res.status(200).json(santriList);
    } catch (error) {
        console.error("Error saat wali kelas mengambil data santri:", error);
        res.status(500).json({ message: "Gagal mengambil data santri." });
    }
};

// Wali Kelas Menetapkan Status Kenaikan Kelas Santri
exports.setKenaikanKelas = async (req, res) => {
    const id_kelas_wali = req.id_kelas_wali;
    const { id_santri } = req.params;
    const { status_kenaikan, tahun_ajaran } = req.body;
    const validStatus = ['Naik Kelas', 'Tidak Naik Kelas', 'Lulus'];

    if (!status_kenaikan || !validStatus.includes(status_kenaikan) || !tahun_ajaran) {
        return res.status(400).json({ message: "Status kenaikan (Naik Kelas/Tidak Naik Kelas/Lulus) dan tahun ajaran valid harus diisi." });
    }
    try {
        const [santriCheck] = await pool.query(
            'SELECT id FROM santri_kelas WHERE id_santri = ? AND id_kelas = ? AND tahun_ajaran = ?',
            [id_santri, id_kelas_wali, tahun_ajaran]
        );
        if (santriCheck.length === 0) {
            return res.status(404).json({ message: "Santri tidak ditemukan di kelas Anda pada tahun ajaran ini." });
        }
        await pool.query(
            'UPDATE santri_kelas SET status_kenaikan = ? WHERE id_santri = ? AND id_kelas = ? AND tahun_ajaran = ?',
            [status_kenaikan, id_santri, id_kelas_wali, tahun_ajaran]
        );
        res.status(200).json({ message: `Status kenaikan untuk santri berhasil ditetapkan.` });
    } catch (error) {
        console.error("Error saat menetapkan status kenaikan:", error);
        res.status(500).json({ message: "Gagal menetapkan status kenaikan." });
    }
};

// Wali Kelas Melihat Rekap Rapor Seluruh Santri di Kelasnya
exports.getRaporKelas = async (req, res) => {
    const id_kelas = req.id_kelas_wali;
    const { tahun_ajaran, semester } = req.query;
    if (!tahun_ajaran || !semester) return res.status(400).json({ message: "Tahun ajaran dan semester harus disertakan." });

    try {
        const [santriDiKelas] = await pool.query(
            'SELECT s.id, s.nama_lengkap FROM santri s JOIN santri_kelas sk ON s.id = sk.id_santri WHERE sk.id_kelas = ? AND sk.tahun_ajaran = ?',
            [id_kelas, tahun_ajaran]
        );
        if (santriDiKelas.length === 0) return res.status(200).json([]);

        const semuaRapor = [];

        for (const santri of santriDiKelas) {
            const id_santri = santri.id;

            const [nilaiList] = await pool.query(`
                SELECT mp.nama_mapel, n.nilai_akhir, n.deskripsi_guru
                FROM nilai n JOIN mata_pelajaran mp ON n.id_mapel = mp.id
                WHERE n.id_santri = ? AND n.tahun_ajaran = ? AND n.semester = ?
            `, [id_santri, tahun_ajaran, semester]);

            const [rekapAbsensi] = await pool.query(`
                SELECT status, COUNT(id) as jumlah FROM absensi 
                WHERE id_santri = ? AND YEAR(tanggal) >= ? AND YEAR(tanggal) <= ? AND 
                      ((MONTH(tanggal) BETWEEN 7 AND 12 AND ? = 'Ganjil') OR (MONTH(tanggal) BETWEEN 1 AND 6 AND ? = 'Genap'))
                GROUP BY status
            `, [id_santri, tahun_ajaran, parseInt(tahun_ajaran)+1, semester, semester]);
            
            const absensi = { Sakit: 0, Izin: 0, Alfa: 0 };
            rekapAbsensi.forEach(item => { if (absensi.hasOwnProperty(item.status)) absensi[item.status] = item.jumlah; });

            const [catatanPerilaku] = await pool.query(
                'SELECT kategori, deskripsi, tanggal_catatan FROM catatan_perilaku WHERE id_santri = ? AND tahun_ajaran = ? AND semester = ? ORDER BY tanggal_catatan DESC',
                [id_santri, tahun_ajaran, semester]
            );

            let jumlah_nilai = 0;
            nilaiList.forEach(n => { jumlah_nilai += n.nilai_akhir ? Number(n.nilai_akhir) : 0; });
            const rata_rata = nilaiList.length > 0 ? (jumlah_nilai / nilaiList.length) : 0;

            semuaRapor.push({
                id_santri: id_santri,
                nama_santri: santri.nama_lengkap,
                rekapitulasi: { jumlah_nilai: parseFloat(jumlah_nilai.toFixed(2)), rata_rata: parseFloat(rata_rata.toFixed(2)) },
                detail_nilai: nilaiList,
                rekap_non_akademik: { absensi, catatan_perilaku: catatanPerilaku }
            });
        }
        res.status(200).json(semuaRapor);
    } catch (error) {
        console.error("Error saat wali kelas mengambil rekap rapor:", error);
        res.status(500).json({ message: "Gagal mengambil rekap rapor kelas." });
    }
};


// --- CRUD UNTUK CATATAN PERILAKU UMUM (oleh Wali Kelas) ---
exports.createCatatanPerilaku = async (req, res) => {
    const { id_santri } = req.params;
    const { id_pengguna } = req.session.user;
    const { tahun_ajaran, semester, tanggal_catatan, kategori, deskripsi } = req.body;
    if (!tahun_ajaran || !semester || !tanggal_catatan || !kategori || !deskripsi) return res.status(400).json({ message: "Semua field harus diisi." });
    try {
        const [guruData] = await pool.query('SELECT id FROM guru WHERE id_pengguna = ?', [id_pengguna]);
        if (guruData.length === 0) return res.status(404).json({ message: "Profil guru tidak ditemukan." });
        const id_guru = guruData[0].id;
        await pool.query(
            'INSERT INTO catatan_perilaku (id_santri, id_guru, tahun_ajaran, semester, tanggal_catatan, kategori, deskripsi) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id_santri, id_guru, tahun_ajaran, semester, tanggal_catatan, kategori, deskripsi]
        );
        res.status(201).json({ message: "Catatan perilaku berhasil ditambahkan." });
    } catch (error) {
        console.error("Error saat membuat catatan perilaku:", error);
        res.status(500).json({ message: "Gagal menambahkan catatan perilaku." });
    }
};

exports.getCatatanPerilaku = async (req, res) => {
    const { id_santri } = req.params;
    try {
        const [catatan] = await pool.query(
            'SELECT * FROM catatan_perilaku WHERE id_santri = ? ORDER BY tanggal_catatan DESC',
            [id_santri]
        );
        res.status(200).json(catatan);
    } catch (error) {
        console.error("Error saat mengambil catatan perilaku:", error);
        res.status(500).json({ message: "Gagal mengambil catatan perilaku." });
    }
};

exports.updateCatatanPerilaku = async (req, res) => {
    const { id_catatan } = req.params;
    const { kategori, deskripsi } = req.body;
    const { id_pengguna } = req.session.user;
    if (!kategori || !deskripsi) return res.status(400).json({ message: "Kategori dan deskripsi harus diisi." });
    try {
        const [guruData] = await pool.query('SELECT id FROM guru WHERE id_pengguna = ?', [id_pengguna]);
        const id_guru = guruData[0].id;
        const [result] = await pool.query(
            'UPDATE catatan_perilaku SET kategori = ?, deskripsi = ? WHERE id = ? AND id_guru = ?',
            [kategori, deskripsi, id_catatan, id_guru]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: "Catatan tidak ditemukan atau Anda tidak punya hak edit." });
        res.status(200).json({ message: "Catatan perilaku berhasil diperbarui." });
    } catch (error) {
        console.error("Error saat update catatan perilaku:", error);
        res.status(500).json({ message: "Gagal memperbarui catatan." });
    }
};

exports.deleteCatatanPerilaku = async (req, res) => {
    const { id_catatan } = req.params;
    const { id_pengguna } = req.session.user;
    try {
        const [guruData] = await pool.query('SELECT id FROM guru WHERE id_pengguna = ?', [id_pengguna]);
        const id_guru = guruData[0].id;
        const [result] = await pool.query('DELETE FROM catatan_perilaku WHERE id = ? AND id_guru = ?', [id_catatan, id_guru]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Catatan tidak ditemukan atau Anda tidak punya hak hapus." });
        res.status(200).json({ message: "Catatan perilaku berhasil dihapus." });
    } catch (error) {
        console.error("Error saat hapus catatan perilaku:", error);
        res.status(500).json({ message: "Gagal menghapus catatan." });
    }
};
// controllers/kelasManagementController.js

const pool = require('../config/db');

// --- Admin: Membuat Kelas Baru ---
exports.createKelas = async (req, res) => {
    // Menerima id_jenjang sesuai dengan struktur tabel Anda
    const { nama_kelas, id_jenjang } = req.body;
    if (!nama_kelas || !id_jenjang) {
        return res.status(400).json({ message: "Nama kelas dan ID Jenjang harus diisi." });
    }
    try {
        await pool.query('INSERT INTO kelas (nama_kelas, id_jenjang) VALUES (?, ?)', [nama_kelas, id_jenjang]);
        res.status(201).json({ message: `Kelas '${nama_kelas}' berhasil dibuat.` });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Nama kelas ini sudah ada." });
        console.error("Error saat membuat kelas:", error);
        res.status(500).json({ message: "Gagal membuat kelas." });
    }
};

// --- Admin: Menetapkan Wali Kelas ---
exports.assignWaliKelas = async (req, res) => {
    const { id_kelas } = req.params;
    const { id_guru } = req.body;
    if (!id_guru) {
        return res.status(400).json({ message: "ID Guru harus diisi." });
    }
    try {
        // 1. Set guru sebagai wali kelas di tabel guru
        await pool.query("UPDATE guru SET jabatan = 'Wali Kelas' WHERE id = ?", [id_guru]);
        // 2. Tautkan guru ke kelas di tabel kelas
        await pool.query("UPDATE kelas SET id_wali_kelas = ? WHERE id = ?", [id_guru, id_kelas]);
        res.status(200).json({ message: "Wali kelas berhasil ditetapkan." });
    } catch (error) {
        console.error("Error saat menetapkan wali kelas:", error);
        res.status(500).json({ message: "Gagal menetapkan wali kelas." });
    }
};

// --- Admin: Menempatkan Santri ke dalam Kelas ---
exports.assignSantriToKelas = async (req, res) => {
    const { id_kelas } = req.params;
    const { id_santri, tahun_ajaran } = req.body;
    if (!id_santri || !tahun_ajaran) {
        return res.status(400).json({ message: "ID Santri dan tahun ajaran harus diisi." });
    }
    try {
        // 'ON DUPLICATE KEY UPDATE' akan memperbarui kelas santri jika dia sudah ada di tahun ajaran yg sama
        const sql = 'INSERT INTO santri_kelas (id_santri, id_kelas, tahun_ajaran) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_kelas = VALUES(id_kelas)';
        await pool.query(sql, [id_santri, id_kelas, tahun_ajaran]);
        res.status(200).json({ message: "Santri berhasil ditempatkan di kelas." });
    } catch (error) {
        console.error("Error saat menempatkan santri:", error);
        res.status(500).json({ message: "Gagal menempatkan santri." });
    }
};

// --- Admin: Menghapus Santri dari Kelas ---
exports.removeSantriFromKelas = async (req, res) => {
    // Kita butuh id_kelas dari URL dan id_santri dari URL juga
    const { id_kelas, id_santri } = req.params;
    const tahun_ajaran = req.body.tahun_ajaran || new Date().getFullYear(); // Ambil tahun dari body atau default ke tahun sekarang

    try {
        const [result] = await pool.query(
            'DELETE FROM santri_kelas WHERE id_santri = ? AND id_kelas = ? AND tahun_ajaran = ?',
            [id_santri, id_kelas, tahun_ajaran]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Data penempatan santri di kelas ini tidak ditemukan." });
        }

        res.status(200).json({ message: "Santri berhasil dihapus dari kelas." });
    } catch (error) {
        console.error("Error saat menghapus santri dari kelas:", error);
        res.status(500).json({ message: "Gagal menghapus santri dari kelas." });
    }
};

// --- Admin: Melepaskan Jabatan Wali Kelas ---
exports.unassignWaliKelas = async (req, res) => {
    const { id_kelas } = req.params;
    try {
        // 1. Cari tahu ID guru yang saat ini menjadi wali kelas
        const [kelasData] = await pool.query('SELECT id_wali_kelas FROM kelas WHERE id = ?', [id_kelas]);
        if (kelasData.length === 0 || !kelasData[0].id_wali_kelas) {
            return res.status(404).json({ message: "Kelas ini tidak ditemukan atau tidak memiliki wali kelas saat ini." });
        }
        const id_guru = kelasData[0].id_wali_kelas;

        // 2. Lepaskan tautan di tabel 'kelas' (set id_wali_kelas menjadi NULL)
        await pool.query('UPDATE kelas SET id_wali_kelas = NULL WHERE id = ?', [id_kelas]);
        
        // 3. (Opsional) Ubah kembali jabatan guru menjadi 'Guru Mapel' atau biarkan 'Wali Kelas'
        await pool.query("UPDATE guru SET jabatan = 'Guru Mapel' WHERE id = ?", [id_guru]);

        res.status(200).json({ message: "Jabatan wali kelas berhasil dilepaskan." });
    } catch (error) {
        console.error("Error saat melepaskan jabatan wali kelas:", error);
        res.status(500).json({ message: "Gagal melepaskan jabatan wali kelas." });
    }
};

// --- Admin: Menghapus Kelas ---
exports.deleteKelas = async (req, res) => {
    const { id_kelas } = req.params;
    try {
        // Foreign key 'ON DELETE CASCADE' di santri_kelas akan otomatis menghapus semua santri dari kelas ini.
        // Foreign key 'ON DELETE SET NULL' akan otomatis melepaskan wali kelas.
        const [result] = await pool.query('DELETE FROM kelas WHERE id = ?', [id_kelas]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Kelas dengan ID ${id_kelas} tidak ditemukan.` });
        }

        res.status(200).json({ message: `Kelas berhasil dihapus.` });
    } catch (error) {
        console.error("Error saat menghapus kelas:", error);
        res.status(500).json({ message: "Gagal menghapus kelas." });
    }
};

// --- Admin: Menghapus Kelas ---
exports.deleteKelas = async (req, res) => {
    const { id_kelas } = req.params;
    try {
        // ON DELETE CASCADE di 'santri_kelas' akan otomatis mengeluarkan semua santri dari kelas ini.
        // ON DELETE CASCADE di 'jadwal_mengajar' akan otomatis menghapus semua jadwal di kelas ini.
        const [result] = await pool.query('DELETE FROM kelas WHERE id = ?', [id_kelas]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Kelas dengan ID ${id_kelas} tidak ditemukan.` });
        }

        res.status(200).json({ message: `Kelas berhasil dihapus.` });
    } catch (error) {
        console.error("Error saat menghapus kelas:", error);
        res.status(500).json({ message: "Gagal menghapus kelas." });
    }
};
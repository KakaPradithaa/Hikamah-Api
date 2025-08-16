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

// --- Fungsi untuk Santri melihat daftar mata pelajarannya (VERSI DINAMIS) ---
exports.getMyMataPelajaran = async (req, res) => {
    const { id_santri } = req.session.user;
    // 1. Ambil tahun ajaran dari query parameter di URL
    const { tahun_ajaran } = req.query;

    // 2. Validasi: pastikan tahun ajaran diberikan
    if (!tahun_ajaran) {
        return res.status(400).json({ message: "Parameter 'tahun_ajaran' harus disertakan." });
    }
    
    try {
        // 3. Cari ID kelas santri untuk tahun ajaran yang diminta
        const [kelasInfo] = await pool.query(
            'SELECT id_kelas FROM santri_kelas WHERE id_santri = ? AND tahun_ajaran = ?',
            [id_santri, tahun_ajaran] // <-- Gunakan tahun_ajaran dari URL
        );

        if (kelasInfo.length === 0) {
            return res.status(200).json([]); // Santri tidak di kelas manapun pada tahun itu
        }
        const id_kelas_santri = kelasInfo[0].id_kelas;

        // 4. Cari jadwal mengajar untuk kelas dan tahun ajaran yang diminta
        const [mapelList] = await pool.query(`
            SELECT 
                mp.nama_mapel,
                p.nama_lengkap AS nama_guru
            FROM jadwal_mengajar jm
            JOIN mata_pelajaran mp ON jm.id_mapel = mp.id
            JOIN guru g ON jm.id_guru = g.id
            JOIN pengguna p ON g.id_pengguna = p.id
            WHERE jm.id_kelas = ? AND jm.tahun_ajaran = ?
            ORDER BY mp.nama_mapel ASC
        `, [id_kelas_santri, tahun_ajaran]); // <-- Gunakan tahun_ajaran dari URL

        res.status(200).json(mapelList);

    } catch (error) {
        console.error("Error saat santri mengambil daftar mapel:", error);
        res.status(500).json({ message: "Gagal mengambil daftar mata pelajaran." });
    }
};

// --- Fungsi untuk Santri melihat rekap nilainya sendiri ---
exports.getMyNilai = async (req, res) => {
    const { id_santri } = req.session.user;

    try {
        // Query ini menggabungkan tabel nilai dengan mata pelajaran untuk mendapatkan nama mapel
        const [nilaiList] = await pool.query(`
            SELECT 
                n.tahun_ajaran,
                n.semester,
                mp.nama_mapel,
                n.nilai_tugas,
                n.nilai_uts,
                n.nilai_uas,
                n.nilai_akhir
            FROM nilai n
            JOIN mata_pelajaran mp ON n.id_mapel = mp.id
            WHERE n.id_santri = ?
            ORDER BY n.tahun_ajaran DESC, n.semester DESC, mp.nama_mapel ASC
        `, [id_santri]);

        // (Opsional) Mengelompokkan hasil berdasarkan tahun ajaran dan semester
        const groupedNilai = nilaiList.reduce((acc, nilai) => {
            const key = `${nilai.tahun_ajaran} - Semester ${nilai.semester}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push({
                mata_pelajaran: nilai.nama_mapel,
                nilai_tugas: nilai.nilai_tugas,
                nilai_uts: nilai.nilai_uts,
                nilai_uas: nilai.nilai_uas,
                nilai_akhir: nilai.nilai_akhir
            });
            return acc;
        }, {});

        res.status(200).json(groupedNilai);

    } catch (error) {
        console.error("Error saat santri mengambil data nilai:", error);
        res.status(500).json({ message: "Gagal mengambil data nilai." });
    }
};

// Fungsi helper untuk predikat (tetap kita gunakan)
function getPredikat(nilai) {
    if (nilai === null || nilai === undefined) return '-';
    if (nilai >= 90) return 'A';
    if (nilai >= 80) return 'B';
    if (nilai >= 70) return 'C';
    return 'D';
}

exports.getRaporSemester = async (req, res) => {
    const { id_santri } = req.session.user;
    const { tahun_ajaran, semester } = req.query;

    if (!tahun_ajaran || !semester) {
        return res.status(400).json({ message: "Tahun ajaran dan semester harus disertakan." });
    }

    try {
        // 1. Ambil semua data nilai, TERMASUK deskripsi_guru
        const [nilaiList] = await pool.query(`
            SELECT 
                mp.nama_mapel,
                mp.kategori,
                n.nilai_akhir,
                n.deskripsi_guru -- <-- Ambil deskripsi dari DB
            FROM nilai n
            JOIN mata_pelajaran mp ON n.id_mapel = mp.id
            WHERE n.id_santri = ? AND n.tahun_ajaran = ? AND n.semester = ?
            ORDER BY mp.kategori, mp.nama_mapel
        `, [id_santri, tahun_ajaran, semester]);

        if (nilaiList.length === 0) {
            return res.status(404).json({ message: `Tidak ada data nilai untuk periode ini.` });
        }

        // 2. Lakukan perhitungan agregat (tetap sama)
        let jumlah_nilai = 0;
        nilaiList.forEach(n => { jumlah_nilai += n.nilai_akhir ? Number(n.nilai_akhir) : 0; });
        const rata_rata = nilaiList.length > 0 ? (jumlah_nilai / nilaiList.length) : 0;

        const predikat_keseluruhan = getPredikat(rata_rata);
        let status_kenaikan = "Belum Ditentukan";
        if (semester.toLowerCase() === 'genap') {
            status_kenaikan = rata_rata >= 75 ? "Naik Kelas" : "Tidak Naik Kelas";
        }

        // 3. Kelompokkan nilai berdasarkan kategori
        const nilai_per_kategori = nilaiList.reduce((acc, nilai) => {
            const kategori = nilai.kategori || 'Lainnya';
            if (!acc[kategori]) acc[kategori] = [];
            
            acc[kategori].push({
                mata_pelajaran: nilai.nama_mapel,
                nilai_akhir: nilai.nilai_akhir,
                predikat: getPredikat(nilai.nilai_akhir), // <-- Buat predikat otomatis
                deskripsi: nilai.deskripsi_guru || "Belum ada deskripsi dari guru." // <-- Tampilkan deskripsi dari DB
            });
            return acc;
        }, {});
        
        const rapor = {
            // ... (info santri dan periode)
            rekapitulasi: {
                jumlah_nilai: parseFloat(jumlah_nilai.toFixed(2)),
                rata_rata: parseFloat(rata_rata.toFixed(2)),
                predikat: predikat_keseluruhan,
                status_kenaikan: status_kenaikan
            },
            detail_nilai: nilai_per_kategori
        };

        res.status(200).json(rapor);

    } catch (error) {
        console.error("Error saat generate rapor:", error);
        res.status(500).json({ message: "Gagal mengambil data rapor." });
    }
};

// --- Fungsi untuk GET /rapor (Versi Final) ---
exports.getRaporSemester = async (req, res) => {
    const { id_santri } = req.session.user;
    const { tahun_ajaran, semester } = req.query;

    if (!tahun_ajaran || !semester) return res.status(400).json({ message: "Tahun ajaran dan semester harus disertakan." });

    try {
        // 1. Ambil data nilai
        const [nilaiList] = await pool.query(`
            SELECT mp.nama_mapel, mp.kategori, n.nilai_akhir, n.deskripsi_guru
            FROM nilai n JOIN mata_pelajaran mp ON n.id_mapel = mp.id
            WHERE n.id_santri = ? AND n.tahun_ajaran = ? AND n.semester = ?
            ORDER BY mp.kategori, mp.nama_mapel
        `, [id_santri, tahun_ajaran, semester]);
        
        // 2. Ambil Rekap Absensi
        const [rekapAbsensi] = await pool.query(`
            SELECT status, COUNT(id) as jumlah FROM absensi 
            WHERE id_santri = ? AND YEAR(tanggal) >= ? AND YEAR(tanggal) <= ? AND 
                  ((MONTH(tanggal) BETWEEN 7 AND 12 AND ? = 'Ganjil') OR (MONTH(tanggal) BETWEEN 1 AND 6 AND ? = 'Genap'))
            GROUP BY status
        `, [id_santri, tahun_ajaran, parseInt(tahun_ajaran)+1, semester, semester]);
        
        const absensi = { Sakit: 0, Izin: 0, Alfa: 0 };
        rekapAbsensi.forEach(item => { if (absensi.hasOwnProperty(item.status)) absensi[item.status] = item.jumlah; });

        // 3. Ambil Catatan Perilaku
        const [catatanPerilaku] = await pool.query(
            'SELECT kategori, deskripsi, tanggal_catatan FROM catatan_perilaku WHERE id_santri = ? AND tahun_ajaran = ? AND semester = ? ORDER BY tanggal_catatan DESC',
            [id_santri, tahun_ajaran, semester]
        );

        // 4. Perhitungan Agregat Nilai & Status Kenaikan
        if (nilaiList.length === 0) return res.status(404).json({ message: `Tidak ada data nilai untuk periode ini.` });
        
        let jumlah_nilai = 0;
        nilaiList.forEach(n => { jumlah_nilai += n.nilai_akhir ? Number(n.nilai_akhir) : 0; });
        const rata_rata = nilaiList.length > 0 ? (jumlah_nilai / nilaiList.length) : 0;
        const predikat_keseluruhan = getPredikat(rata_rata);
        
        const [statusData] = await pool.query('SELECT status_kenaikan FROM santri_kelas WHERE id_santri = ? AND tahun_ajaran = ?', [id_santri, tahun_ajaran]);
        const status_kenaikan = (statusData.length > 0) ? statusData[0].status_kenaikan : "Belum Ditentukan";

        // 5. Pengelompokan nilai per kategori
        const nilai_per_kategori = nilaiList.reduce((acc, nilai) => {
            const kategori = nilai.kategori || 'Lainnya';
            if (!acc[kategori]) acc[kategori] = [];
            acc[kategori].push({
                mata_pelajaran: nilai.nama_mapel,
                nilai_akhir: nilai.nilai_akhir,
                predikat: getPredikat(nilai.nilai_akhir),
                deskripsi: nilai.deskripsi_guru || "Belum ada deskripsi dari guru."
            });
            return acc;
        }, {});
        
        // 6. Susun respons JSON final
        const rapor = {
            rekapitulasi: { jumlah_nilai: parseFloat(jumlah_nilai.toFixed(2)), rata_rata: parseFloat(rata_rata.toFixed(2)), predikat: predikat_keseluruhan, status_kenaikan },
            detail_nilai: nilai_per_kategori,
            rekap_non_akademik: { absensi, catatan_perilaku: catatanPerilaku }
        };
        res.status(200).json(rapor);
    } catch (error) {
        console.error("Error saat generate rapor:", error);
        res.status(500).json({ message: "Gagal mengambil data rapor." });
    }
};

// --- Fungsi untuk GET /profile ---
// Mengambil semua data detail untuk santri yang sedang login
exports.getFullProfile = async (req, res) => {
    const { id_santri } = req.session.user;

    try {
        // 1. Ambil data utama dari tabel santri dan akun wali terkait
        const [santriData] = await pool.query(`
            SELECT 
                s.nama_lengkap, s.nomor_induk, s.nisn, s.tempat_lahir, s.tanggal_lahir, 
                s.jenis_kelamin, s.anak_ke, s.dari_bersaudara, s.agama, s.alamat, s.foto_profil,
                p_wali.email AS email_wali
            FROM santri s
            JOIN pengguna p_wali ON s.id_wali = p_wali.id
            WHERE s.id = ?
        `, [id_santri]);

        if (santriData.length === 0) {
            return res.status(404).json({ message: "Data profil santri tidak ditemukan." });
        }

        // 2. Ambil data detail Ayah dan Ibu dari tabel orang_tua
        const [orangTuaData] = await pool.query(
            'SELECT * FROM orang_tua WHERE id_santri = ?',
            [id_santri]
        );

        // 3. Pisahkan data Ayah dan Ibu
        const ayahData = orangTuaData.find(ortu => ortu.status_hubungan === 'Ayah') || {};
        const ibuData = orangTuaData.find(ortu => ortu.status_hubungan === 'Ibu') || {};

        // 4. Susun respons JSON yang terstruktur
        const fullProfile = {
            santri: santriData[0],
            ayah: {
                nama_lengkap: ayahData.nama_lengkap,
                tempat_lahir: ayahData.tempat_lahir,
                tanggal_lahir: ayahData.tanggal_lahir,
                pekerjaan: ayahData.pekerjaan,
                pendidikan_terakhir: ayahData.pendidikan_terakhir,
                alamat: ayahData.alamat,
                nomor_hp: ayahData.nomor_hp
            },
            ibu: {
                nama_lengkap: ibuData.nama_lengkap,
                tempat_lahir: ibuData.tempat_lahir,
                tanggal_lahir: ibuData.tanggal_lahir,
                pekerjaan: ibuData.pekerjaan,
                pendidikan_terakhir: ibuData.pendidikan_terakhir,
                alamat: ibuData.alamat,
                nomor_hp: ibuData.nomor_hp
            }
        };

        res.status(200).json(fullProfile);

    } catch (error) {
        console.error("Error saat mengambil profil lengkap santri:", error);
        res.status(500).json({ message: "Gagal mengambil data profil." });
    }
};
// controllers/authController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- Fungsi untuk Pendaftaran Baru (Dengan Validasi Nomor Induk) ---
exports.register = async (req, res) => {
    const {
        // Data Santri
        nomor_induk,
        nama_santri, tempat_lahir_santri, tanggal_lahir_santri, jenis_kelamin, anak_ke, dari_bersaudara, agama, alamat_santri,
        // Data Ayah
        nama_ayah, tempat_lahir_ayah, tanggal_lahir_ayah, pekerjaan_ayah, pendidikan_ayah, alamat_ayah, nomor_hp_ayah,
        // Data Ibu
        nama_ibu, tempat_lahir_ibu, tanggal_lahir_ibu, pekerjaan_ibu, pendidikan_ibu, alamat_ibu, nomor_hp_ibu,
        // Data Akun Wali
        email_wali, hubungan_wali
    } = req.body;

    // 1. Validasi input dasar
    if (!nomor_induk || !nama_santri || !tanggal_lahir_santri || !email_wali) {
        return res.status(400).json({ message: 'Nomor Induk, data santri, dan email wali harus diisi lengkap.' });
    }

    // 2. Validasi spesifik untuk Nomor Induk
    if (!/^\d+$/.test(nomor_induk)) {
        return res.status(400).json({ message: 'Nomor Induk hanya boleh berisi angka.' });
    }
    if (nomor_induk.length !== 13) {
        return res.status(400).json({ message: 'Nomor Induk harus terdiri dari 13 angka.' });
    }

    let connection; 
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 3. Cek duplikasi email wali dan nomor induk
        const [emailCheck] = await connection.query('SELECT id FROM pengguna WHERE email = ?', [email_wali]);
        if (emailCheck.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'Email wali ini sudah terdaftar.' });
        }
        const [indukCheck] = await connection.query('SELECT id FROM santri WHERE nomor_induk = ?', [nomor_induk]);
        if (indukCheck.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'Nomor Induk ini sudah terdaftar.' });
        }

        // 4. Tentukan data untuk akun pengguna Wali
        let nama_wali_akun, nomor_hp_wali_akun;
        if (hubungan_wali && hubungan_wali.toLowerCase() === 'ayah') {
            nama_wali_akun = nama_ayah;
            nomor_hp_wali_akun = nomor_hp_ayah;
        } else {
            nama_wali_akun = nama_ibu;
            nomor_hp_wali_akun = nomor_hp_ibu;
        }

        const tempPassword = tanggal_lahir_santri.replace(/-/g, '');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        // 5. Buat akun PENGGUNA untuk Wali
        const [resultWali] = await connection.query(
            'INSERT INTO pengguna (nama_lengkap, email, kata_sandi, nomor_hp, peran, status_aktif) VALUES (?, ?, ?, ?, ?, ?)',
            [nama_wali_akun, email_wali, hashedPassword, nomor_hp_wali_akun, 'Wali Santri', false]
        );
        const idWaliPengguna = resultWali.insertId;

        // 6. Buat entri baru di tabel SANTRI
        const [resultSantri] = await connection.query(
            'INSERT INTO santri (id_wali, nomor_induk, nama_lengkap, tempat_lahir, tanggal_lahir, jenis_kelamin, anak_ke, dari_bersaudara, agama, alamat, tanggal_daftar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [idWaliPengguna, nomor_induk, nama_santri, tempat_lahir_santri, tanggal_lahir_santri, jenis_kelamin, anak_ke, dari_bersaudara, agama, alamat_santri, new Date()]
        );
        const idSantri = resultSantri.insertId;

        // 7. Simpan data detail Ayah dan Ibu
        await connection.query(
            'INSERT INTO orang_tua (id_santri, status_hubungan, nama_lengkap, tempat_lahir, tanggal_lahir, pekerjaan, pendidikan_terakhir, alamat, nomor_hp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [idSantri, 'Ayah', nama_ayah, tempat_lahir_ayah, tanggal_lahir_ayah, pekerjaan_ayah, pendidikan_ayah, alamat_ayah, nomor_hp_ayah]
        );
        await connection.query(
            'INSERT INTO orang_tua (id_santri, status_hubungan, nama_lengkap, tempat_lahir, tanggal_lahir, pekerjaan, pendidikan_terakhir, alamat, nomor_hp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [idSantri, 'Ibu', nama_ibu, tempat_lahir_ibu, tanggal_lahir_ibu, pekerjaan_ibu, pendidikan_ibu, alamat_ibu, nomor_hp_ibu]
        );
        
        await connection.commit();
        res.status(201).json({ message: 'Pendaftaran berhasil. Data Anda akan diverifikasi oleh admin.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Ada error saat pendaftaran:', error);
        res.status(500).json({ message: 'Pendaftaran gagal karena kesalahan server.' });
    } finally {
        if (connection) connection.release();
    }
};

// --- Fungsi untuk POST /login ---
exports.login = async (req, res) => {
    const { username, kata_sandi } = req.body;
    if (!username || !kata_sandi) {
        return res.status(400).json({ message: 'Username dan kata sandi harus diisi.' });
    }

    try {
        const [users] = await pool.query(
            'SELECT id, kata_sandi, status_aktif, peran, nama_lengkap, username FROM pengguna WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Username atau kata sandi salah.' });
        }
        
        const user = users[0];
        const isMatch = await bcrypt.compare(kata_sandi, user.kata_sandi);

        if (!isMatch) return res.status(401).json({ message: 'Username atau kata sandi salah.' });
        if (!user.status_aktif) return res.status(403).json({ message: 'Akun ini tidak aktif.' });
        
        const userRole = user.peran.toLowerCase();
        let sessionPayload = {};

        if (userRole === 'santri') {
            const [santriRows] = await pool.query('SELECT id, nama_lengkap, nisn FROM santri WHERE id_pengguna = ?', [user.id]);
            if (santriRows.length === 0) {
                return res.status(403).json({ message: 'Akun Pengguna Santri tidak tertaut dengan data santri yang valid.' });
            }
            const santriData = santriRows[0];
            sessionPayload = {
                id_pengguna: user.id,
                username: user.username,
                nama_santri: santriData.nama_lengkap,
                peran: 'Santri',
                id_santri: santriData.id
            };
        } else if (userRole === 'admin' || userRole === 'guru') {
            sessionPayload = {
                id_pengguna: user.id,
                username: user.username,
                nama_pengguna: user.nama_lengkap,
                peran: user.peran
            };
        } else {
            return res.status(403).json({ message: 'Peran pengguna tidak valid untuk login.' });
        }
        
        req.session.regenerate(err => {
            if (err) return res.status(500).json({ message: 'Gagal memulai sesi.' });
            req.session.user = sessionPayload;
            req.session.save(err => {
                if (err) return res.status(500).json({ message: 'Login gagal.' });
                res.status(200).json({ message: 'Login berhasil.', user: sessionPayload });
            });
        });

    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).json({ message: 'Login gagal.' });
    }
};

// --- Fungsi untuk POST /logout ---
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Gagal logout.' });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout berhasil.' });
    });
};
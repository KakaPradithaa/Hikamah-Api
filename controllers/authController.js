// controllers/authController.js

const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- Fungsi untuk POST /register ---
exports.register = async (req, res) => {
    const { 
        nama_wali, email_wali, nomor_hp_wali, hubungan_wali, 
        nama_santri, tanggal_lahir_santri, jenis_kelamin, alamat
    } = req.body;
    
    if (!nama_wali || !email_wali || !nomor_hp_wali || !hubungan_wali || !nama_santri || !tanggal_lahir_santri || !jenis_kelamin || !alamat) {
        return res.status(400).json({ message: 'Data pendaftaran tidak lengkap. Harap isi semua kolom.' });
    }

    let connection; 
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [emailCheck] = await connection.query('SELECT email FROM pengguna WHERE email = ?', [email_wali]);
        if (emailCheck.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'Email wali sudah terdaftar.' });
        }

        const tempPassword = tanggal_lahir_santri.replace(/-/g, '');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const [resultWali] = await connection.query(
            'INSERT INTO pengguna (nama_lengkap, email, kata_sandi, nomor_hp, peran, status_aktif) VALUES (?, ?, ?, ?, ?, ?)',
            [nama_wali, email_wali, hashedPassword, nomor_hp_wali, 'Wali Santri', false]
        );
        const idWali = resultWali.insertId;

        await connection.query('INSERT INTO wali_santri (id_pengguna, hubungan) VALUES (?, ?)', [idWali, hubungan_wali]);
        
        await connection.query(
            'INSERT INTO santri (id_wali, nama_lengkap, tanggal_lahir, jenis_kelamin, alamat, tanggal_daftar) VALUES (?, ?, ?, ?, ?, ?)',
            [idWali, nama_santri, tanggal_lahir_santri, jenis_kelamin, alamat, new Date()]
        );
        
        await connection.commit();
        res.status(201).json({ message: 'Pendaftaran berhasil. Menunggu verifikasi admin.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Ada error saat pendaftaran:', error);
        res.status(500).json({ message: 'Pendaftaran gagal.' });
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
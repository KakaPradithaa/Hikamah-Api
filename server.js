// server.js

// --- Impor Modul ---
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Konfigurasi Database ---
const dbOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

const pool = mysql.createPool(dbOptions);

pool.getConnection()
    .then(connection => {
        console.log('Koneksi ke database berhasil! ✅');
        connection.release();
    })
    .catch(err => {
        console.error('Koneksi ke database gagal! ❌', err.message);
        process.exit(1);
    });

// --- Konfigurasi Middleware Utama ---

app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

const sessionStore = new MySQLStore(dbOptions);
app.use(session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 
    }
}));


// --- Impor & Gunakan Rute ---
const authRoutes = require('./routes/authRoutes');
const santriRoutes = require('./routes/santriRoutes');
const adminRoutes = require('./routes/adminRoutes'); 
const santriManagementRoutes = require('./routes/santriManagementRoutes'); 
const guruRoutes = require('./routes/guruRoutes');
const guruManagementRoutes = require('./routes/guruManagementRoutes'); 
const kelasManagementRoutes = require('./routes/kelasManagementRoutes');
const akademikRoutes = require('./routes/akademikRoutes');


app.use('/api/auth', authRoutes);
app.use('/api/santri', santriRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/admin', santriManagementRoutes); 
app.use('/api/guru', guruRoutes);
app.use('/api/admin', guruManagementRoutes); 
app.use('/api/admin', kelasManagementRoutes);
app.use('/api/admin', akademikRoutes);


// --- Rute Dasar & Listener Server ---
app.get('/', (req, res) => {
    res.send('API untuk aplikasi Hikmah berjalan...');
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
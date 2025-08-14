// routes/akademikRoutes.js
const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/authMiddleware');
const akademikController = require('../controllers/akademikController');

// Semua rute di sini hanya untuk Admin
router.use(verifyAdmin);

// === Rute Manajemen Mata Pelajaran ===
// Membuat mata pelajaran baru (misal: "Bahasa Arab")
router.post('/mapel', akademikController.createMapel);
// Melihat semua mata pelajaran yang ada
router.get('/mapel', akademikController.getAllMapel);


// === Rute Manajemen Kurikulum ===
// Menambahkan mapel ke sebuah jenjang (misal: "Bahasa Arab" ada di jenjang "SMP")
router.post('/jenjang/:id_jenjang/mapel', akademikController.addMapelToJenjang);


// === Rute Manajemen Jadwal Mengajar ===
// Menugaskan guru untuk mengajar sebuah mapel di sebuah kelas
// Contoh: Tugaskan Guru A untuk mengajar B. Arab di kelas 7A
router.post('/kelas/:id_kelas/mapel/:id_mapel/assign-guru', akademikController.assignGuruToJadwal);

// CREATE: Menugaskan guru untuk mengajar sebuah mapel di sebuah kelas (sudah ada)
router.post('/kelas/:id_kelas/mapel/:id_mapel/assign-guru', akademikController.assignGuruToJadwal);

// READ: Melihat semua jadwal mengajar yang sudah dibuat
router.get('/jadwal', akademikController.getAllJadwal);

// UPDATE: Mengganti guru pada jadwal yang sudah ada
router.put('/jadwal/:id_jadwal/update-guru', akademikController.updateGuruOnJadwal);

// DELETE: Menghapus jadwal mengajar
router.delete('/jadwal/:id_jadwal', akademikController.deleteJadwal);

router.delete('/mapel/:id_mapel', akademikController.deleteMapel);

module.exports = router;
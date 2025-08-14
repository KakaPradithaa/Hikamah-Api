// routes/guruRoutes.js

const express = require('express');
const router = express.Router();

// 1. Impor SEMUA middleware dan controller yang dibutuhkan.
const { verifyGuru, verifyWaliKelas } = require('../middleware/authMiddleware');
const guruController = require('../controllers/guruController');

router.get('/profile', verifyGuru, guruController.getProfile);

// 2. Rute untuk absensi sekarang menunjuk ke fungsi 'recordAbsensi' di controller.
router.post('/absensi', verifyGuru, guruController.recordAbsensi);


// 3. Rute baru untuk Wali Kelas sekarang akan berfungsi.
router.get('/wali-kelas/santri', verifyWaliKelas, guruController.getSantriByWaliKelas);
router.post('/nilai', verifyGuru, guruController.inputNilai);
router.put('/wali-kelas/santri/:id_santri/status-kenaikan', verifyWaliKelas, guruController.setKenaikanKelas);


module.exports = router;
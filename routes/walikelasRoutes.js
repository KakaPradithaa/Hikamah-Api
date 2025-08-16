// routes/waliKelasRoutes.js

const express = require('express');
const router = express.Router();

const { verifyWaliKelas } = require('../middleware/authMiddleware');
const waliKelasController = require('../controllers/walikelasController');

// Semua rute di sini hanya untuk Wali Kelas yang aktif
router.use(verifyWaliKelas);

// --- Rute Manajemen Kelas ---
router.get('/santri', waliKelasController.getSantriByWaliKelas);
router.put('/santri/:id_santri/status-kenaikan', waliKelasController.setKenaikanKelas);
router.get('/rapor-santri', waliKelasController.getRaporKelas);

// --- Rute CRUD Catatan Perilaku ---
router.post('/santri/:id_santri/perilaku', waliKelasController.createCatatanPerilaku);
router.get('/santri/:id_santri/perilaku', waliKelasController.getCatatanPerilaku);
router.put('/perilaku/:id_catatan', waliKelasController.updateCatatanPerilaku);
router.delete('/perilaku/:id_catatan', waliKelasController.deleteCatatanPerilaku);

module.exports = router;
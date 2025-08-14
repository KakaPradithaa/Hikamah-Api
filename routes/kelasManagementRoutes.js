// routes/kelasManagementRoutes.js

const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/authMiddleware');
const kelasManagementController = require('../controllers/kelasManagementController');

// Semua rute di file ini dilindungi oleh middleware Admin
router.use(verifyAdmin);

// Rute untuk membuat kelas baru
router.post('/kelas', kelasManagementController.createKelas);

// Rute untuk menetapkan wali ke sebuah kelas
router.put('/kelas/:id_kelas/assign-wali', kelasManagementController.assignWaliKelas);

// Rute untuk menempatkan santri ke dalam sebuah kelas
router.post('/kelas/:id_kelas/assign-santri', kelasManagementController.assignSantriToKelas);

// Hapus satu santri spesifik dari satu kelas spesifik
router.delete('/kelas/:id_kelas/remove-santri/:id_santri', kelasManagementController.removeSantriFromKelas);

// Lepaskan/hapus penugasan wali kelas dari sebuah kelas
router.delete('/kelas/:id_kelas/unassign-wali', kelasManagementController.unassignWaliKelas);

// Hapus sebuah kelas secara permanen
router.delete('/kelas/:id_kelas', kelasManagementController.deleteKelas);

router.delete('/kelas/:id_kelas', kelasManagementController.deleteKelas);

module.exports = router;
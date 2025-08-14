// routes/guruManagementRoutes.js

const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/authMiddleware');
const guruManagementController = require('../controllers/guruManagementController');

// Semua rute di sini dilindungi oleh middleware Admin
router.use(verifyAdmin);

// Definisikan rute CRUD untuk manajemen guru
router.post('/guru', guruManagementController.createGuru); // Membuat guru baru
router.get('/guru', guruManagementController.getAllGuru); // Melihat semua guru
router.put('/guru/:id_guru', guruManagementController.updateGuru); // Mengupdate guru
router.delete('/guru/:id_guru', guruManagementController.deleteGuru); // Menghapus guru
router.get('/wali-kelas', guruManagementController.getAllWaliKelas); // Melihat semua wali kelas


module.exports = router;
// routes/guruRoutes.js

const express = require('express');
const router = express.Router();

const { verifyGuru } = require('../middleware/authMiddleware');
const guruController = require('../controllers/guruController');

router.get('/profile', verifyGuru, guruController.getProfile);
router.post('/absensi', verifyGuru, guruController.createAbsensi);
router.post('/nilai', verifyGuru, guruController.inputNilai);

module.exports = router;
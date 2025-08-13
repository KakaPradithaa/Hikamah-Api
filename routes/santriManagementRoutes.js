// routes/santriManagementRoutes.js
const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/authMiddleware');
const santriManagementController = require('../controllers/santriManagementController');

router.use(verifyAdmin);

router.get('/pendaftaran', santriManagementController.getUnverifiedRegistrations);
router.get('/santri', santriManagementController.getAllSantri);
router.post('/verifikasi/:id_pendaftaran', santriManagementController.verifyRegistration);
router.put('/santri/:id_santri/nisn', santriManagementController.updateNisn);
router.delete('/santri/:id_santri', santriManagementController.deleteSantri);

module.exports = router;
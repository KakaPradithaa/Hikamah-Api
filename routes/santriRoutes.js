// routes/santriRoutes.js

const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

// Impor middleware dan controller 
const { verifySantri } = require('../middleware/authMiddleware');
const santriController = require('../controllers/santriController');

// Konfigurasi Multer 
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const isSupported = allowedTypes.test(file.mimetype) && allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (isSupported) return cb(null, true);
        cb(new Error('Tipe file tidak didukung. Gunakan jpeg, jpg, png, atau gif.'));
    }
});


router.use(verifySantri);


router.get('/biodata', santriController.getBiodata);
router.put('/update-biodata', santriController.updateBiodata);
router.post('/change-password', santriController.changePassword);
router.put('/change-username', santriController.changeUsername);
router.post('/upload-photo', upload.single('profilePhoto'), santriController.uploadPhoto);

module.exports = router;
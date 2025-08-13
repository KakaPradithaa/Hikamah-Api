const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');


router.use(verifyAdmin);
router.post('/change-password', adminController.changePassword);
router.put('/change-username', adminController.changeUsername);

module.exports = router;
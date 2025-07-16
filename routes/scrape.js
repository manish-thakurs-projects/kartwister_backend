const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const auth = require('../middleware/auth');

router.post('/scrape', auth, scrapeController.scrapeProduct);

module.exports = router; 
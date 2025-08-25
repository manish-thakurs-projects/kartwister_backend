const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const auth = require('../middleware/auth');

// Public scrape endpoint (no authentication required)
router.post('/', scrapeController.scrapeProduct);

module.exports = router; 
const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const auth = require('../middleware/auth');

// Scrape endpoint with authentication required to save scrape history
router.post('/', auth, scrapeController.scrapeProduct);

module.exports = router; 
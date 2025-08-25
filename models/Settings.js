const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  adminEmails: [String], // List of admin notification emails
}, { collection: 'settings' });

module.exports = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema); 
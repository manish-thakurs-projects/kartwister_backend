const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
  const { name, email, phone, password } = req.body;
  try {
    let user = await User.findOne({ $or: [{ email }, { phone }] });
    if (user) return res.status(400).json({ message: 'Registration failed' }); // Generic message
    const passwordHash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user = new User({ name, email, phone, passwordHash, otp });
    await user.save();
    await sendOtpEmail(email, otp);
    res.status(201).json({ message: 'Registered. OTP sent to email.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

async function sendOtpEmail(email, otp) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`
  });
}

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    user.isVerified = true;
    user.otp = undefined;
    await user.save();
    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
  const { email, phone, password } = req.body;
  try {
    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });
    if (query.length === 0) return res.status(400).json({ message: 'Email or phone required' });
    const user = await User.findOne({ $or: query });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' }); // Generic message
    if (!user.isVerified) return res.status(400).json({ message: 'Account not verified' });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin, name: user.name, email: user.email, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
  const { email, phone } = req.body;
  try {
    const user = await User.findOne({ $or: [
      email ? { email } : {},
      phone ? { phone } : {}
    ] });
    if (!user) return res.status(200).json({ message: 'If your account exists, an OTP has been sent.' }); // Always generic
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    await user.save();
    await sendOtpEmail(user.email, otp);
    res.json({ message: 'If your account exists, an OTP has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
  const { email, phone, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ $or: [
      email ? { email } : {},
      phone ? { phone } : {}
    ] });
    if (!user) return res.status(400).json({ message: 'Invalid OTP or account' }); // Generic
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP or account' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    await user.save();
    res.json({ message: 'Password reset. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 
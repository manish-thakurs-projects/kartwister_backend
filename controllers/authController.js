const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { validationResult } = require("express-validator");

const JWT_SECRET = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  const { name, email, phone, password } = req.body;
  try {
    let user = await User.findOne({ $or: [{ email }, { phone }] });
    if (user) return res.status(400).json({ message: "Registration failed" }); // Generic message
    const passwordHash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user = new User({ name, email, phone, passwordHash, otp });
    await user.save();
    await sendOtpEmail(email, otp);
    res.status(201).json({ message: "Registered. OTP sent to email." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

async function sendOtpEmail(email, otp) {
  await transporter.sendMail({
    from: `"Kartwister Auth" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify Your Email - OTP Inside",
    html: `
      <div style="font-family: 'Segoe UI', Roboto, sans-serif; background-color: #030303; padding: 40px 0; color: #ffffff;">
        <div style="max-width: 600px; margin: auto; background-color: #121212; border-radius: 12px; overflow: hidden; box-shadow: 0 0 30px rgba(255, 62, 0, 0.2);">
          <div style="background-color: #1e1e1e; padding: 24px 32px; border-bottom: 1px solid #2c2c2c;">
            <h1 style="color: #ff3e00; margin: 0; font-size: 28px;">Kartwister</h1>
            <p style="margin-top: 8px; font-size: 16px; color: #cccccc;">Your Secure OTP Verification</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="font-size: 22px; margin-bottom: 12px; color: #ffffff;">Your One-Time Password (OTP)</h2>
            <p style="font-size: 16px; color: #dddddd;">Use the OTP below to verify your email address on <strong style="color: #ff3e00;">Kartwister</strong>:</p>
            <div style="font-size: 32px; letter-spacing: 4px; font-weight: bold; background-color: #2b2b2b; color: #ffffff; border: 2px dashed #ff3e00; padding: 16px 32px; text-align: center; border-radius: 10px; margin: 24px 0;">
              ${otp}
            </div>
            <p style="font-size: 14px; color: #aaaaaa;">This code will expire in <strong>10 minutes</strong>. Please don’t share it with anyone.</p>
          </div>
          <div style="background-color: #1e1e1e; padding: 20px 32px; text-align: center; font-size: 13px; color: #666666;">
            If you didn’t request this, you can safely ignore this email.
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #555555; margin-top: 20px;">
          &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
        </div>
      </div>
    `,
  });
}

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    user.isVerified = true;
    user.otp = undefined;
    await user.save();
    res.json({ message: "Email verified. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  const { email, phone, password } = req.body;
  try {
    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });
    if (query.length === 0)
      return res.status(400).json({ message: "Email or phone required" });
    const user = await User.findOne({ $or: query });
    if (!user) return res.status(400).json({ message: "Invalid credentials" }); // Generic message
    if (!user.isVerified)
      return res.status(400).json({ message: "Account not verified" });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign(
      {
        userId: user._id,
        isAdmin: user.isAdmin,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  const { email, phone } = req.body;
  try {
    const user = await User.findOne({
      $or: [email ? { email } : {}, phone ? { phone } : {}],
    });
    if (!user)
      return res
        .status(200)
        .json({ message: "If your account exists, an OTP has been sent." }); // Always generic
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    await user.save();
    await sendOtpEmail(user.email, otp);
    res.json({ message: "If your account exists, an OTP has been sent." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  const { email, phone, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({
      $or: [email ? { email } : {}, phone ? { phone } : {}],
    });
    if (!user)
      return res.status(400).json({ message: "Invalid OTP or account" }); // Generic
    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP or account" });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    await user.save();
    res.json({ message: "Password reset. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

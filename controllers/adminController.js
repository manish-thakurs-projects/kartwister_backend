const Order = require("../models/Order");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const PaymentQRSchema = new mongoose.Schema(
  { url: String },
  { collection: "paymentqr" }
);
const PaymentQR =
  mongoose.models.PaymentQR || mongoose.model("PaymentQR", PaymentQRSchema);
const Charges = require("../models/Charges");
const SettingsSchema = new mongoose.Schema(
  { shippingCharge: Number, serviceCharge: Number },
  { collection: "settings" }
);
const Settings =
  mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.getDashboard = (req, res) => {
  res.json({ message: "Admin dashboard (to be implemented)" });
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({ completed: { $ne: true } }).populate(
      "user",
      "email phone"
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.status = status;
    order.tracking.push({ status, note });
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getCharges = async (req, res) => {
  try {
    let charges = await Charges.findOne({});
    if (!charges)
      charges = await Charges.create({
        shippingCharge: 0,
        serviceCharge: 0,
        transactionRate: 0,
        tax: 0,
      });
    res.json({
      shippingCharge: charges.shippingCharge,
      serviceCharge: charges.serviceCharge,
      transactionRate: charges.transactionRate,
      tax: charges.tax,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch charges", error: err.message });
  }
};
exports.setCharges = async (req, res) => {
  const { shippingCharge, serviceCharge, transactionRate, tax } = req.body;
  try {
    let charges = await Charges.findOne({});
    if (!charges)
      charges = await Charges.create({
        shippingCharge,
        serviceCharge,
        transactionRate,
        tax,
      });
    else {
      charges.shippingCharge = shippingCharge;
      charges.serviceCharge = serviceCharge;
      charges.transactionRate = transactionRate;
      charges.tax = tax;
      await charges.save();
    }
    res.json({
      shippingCharge: charges.shippingCharge,
      serviceCharge: charges.serviceCharge,
      transactionRate: charges.transactionRate,
      tax: charges.tax,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to set charges", error: err.message });
  }
};

exports.approvePayment = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id).populate("user");
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.paymentStatus = "approved";
    order.status = "paid";
    order.tracking.push({
      status: "Payment approved",
      note: "Payment verified by admin",
    });
    if (order.needsRecheck) order.needsRecheck = false;
    await order.save();
    // Send email to user
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: order.user.email,
      subject: "Payment Approved",
      html: `
        <div style="background-color:#030303; color:white; padding:40px; font-family:'Segoe UI', sans-serif; max-width:600px; margin:auto; border-radius:12px;">
          <h1 style="color:#ff3e00; font-size:28px;">Payment Approved</h1>
          <p style="font-size:16px; color:#dddddd;">
            Hello ${order.user.name || "Customer"},<br/><br/>
            Your payment for <strong style="color:white;">${
              order.products[0]?.name
                ? order.products[0].name + " (Order #" + order._id + ")"
                : "Order #" + order._id
            }</strong> has been <span style="color:#00e676;">approved</span>.
          </p>
          <div style="margin:30px 0; background-color:#1e1e1e; padding:20px; border-radius:10px;">
            <p style="margin:0; color:#ccc;">
              <strong>Order ID:</strong> ${order._id}<br/>
              <strong>Status:</strong> Approved & Paid
            </p>
          </div>
          <a href="http://localhost:3000/orders/${order._id}/track" 
             style="display:inline-block; background-color:#ff3e00; color:white; padding:14px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:16px;">
            🚚 Track Your Order
          </a>
          <p style="margin-top:40px; font-size:13px; color:#777;">
            If you have any questions or concerns, just reply to this email — we're here to help.
          </p>
          <div style="margin-top:20px; border-top:1px solid #1e1e1e; padding-top:20px; font-size:12px; color:#555;">
            &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
          </div>
        </div>
      `,
    });
    res.json({ message: "Payment approved and user notified", order });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.uploadQR = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "kartwister/qr",
      resource_type: "image",
    });
    // Save or update the current QR in DB
    await PaymentQR.findOneAndUpdate(
      {},
      { url: result.secure_url },
      { upsert: true }
    );
    res.json({ qr: result.secure_url });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Cloudinary upload failed", error: err.message });
  }
};

exports.getCurrentQR = async (req, res) => {
  try {
    const qr = await PaymentQR.findOne({});
    res.json({ qr: qr?.url || "" });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch QR", error: err.message });
  }
};

exports.getAllScrapeRequests = async (req, res) => {
  try {
    const users = await User.find({}, "email scrapeRequests").lean();
    // Flatten all scrape requests with user email
    const allRequests = users.flatMap((user) =>
      (user.scrapeRequests || []).map((req) => ({
        email: user.email,
        url: req.url,
        site: req.site,
        name: req.name,
        date: req.date,
      }))
    );
    allRequests.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(allRequests);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.verifyOrderPayment = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id).populate("user");
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.paymentStatus = "paid";
    order.status = "paid";
    order.tracking.push({
      status: "Payment approved",
      note: "Payment verified by admin",
      date: new Date(),
    });
    await order.save();
    // Send email to user
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: order.user.email,
      subject: "Payment Status Updated",
      html: `
    <div style="background-color:#030303; color:white; padding:40px; font-family:'Segoe UI', sans-serif; max-width:600px; margin:auto; border-radius:12px;">
      <h1 style="color:#ff3e00; font-size:28px;">Payment Successful 💳</h1>
      <p style="font-size:16px; color:#dddddd;">
        Hello ${order.user.name || "Customer"},<br/><br/>
        Your payment for <strong style="color:white;">${
          order.products[0]?.name || "your order"
        }</strong> has been <span style="color:#00e676;">successfully processed</span>.
      </p>
      <div style="margin:30px 0; background-color:#1e1e1e; padding:20px; border-radius:10px;">
        <p style="margin:0; color:#ccc;">
          <strong>Order ID:</strong> ${order._id}<br/>
          <strong>Status:</strong> Paid
        </p>
      </div>
      <a href="http://localhost:3000/orders/${order._id}/track" 
         style="display:inline-block; background-color:#ff3e00; color:white; padding:14px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:16px;">
        🚚 Track Your Order
      </a>
      <p style="margin-top:40px; font-size:13px; color:#777;">
        Need help? Reply to this email or contact our support team anytime.
      </p>
      <div style="margin-top:20px; border-top:1px solid #1e1e1e; padding-top:20px; font-size:12px; color:#555;">
        &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
      </div>
    </div>
  `,
    });

    res.json({ message: "Payment approved and user notified", order });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.completeDelivery = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id).populate("user");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.completed)
      return res.status(400).json({ message: "Order already completed" });
    order.completed = true;
    order.status = "completed";
    order.tracking.push({
      status: "Delivery completed",
      note: "Order marked as delivered by admin",
      date: new Date(),
    });
    await order.save();
    // Send thank you email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: order.user.email,
      subject: "Order Delivered! Thank You",
      html: `
    <div style="background-color:#030303; color:white; padding:40px; font-family:'Segoe UI', sans-serif; max-width:600px; margin:auto; border-radius:12px;">
      <h1 style="color:#ff3e00; font-size:28px;">Order Delivered!</h1>
      <p style="font-size:16px; color:#dddddd;">
        Hello ${order.user.name || "Customer"},<br/><br/>
        We’re thrilled to let you know that your product <strong style="color:white;">(${
          order.products[0]?.name || "order"
        })</strong> was successfully delivered to your address.
      </p>
      <div style="margin:30px 0; background-color:#1e1e1e; padding:20px; border-radius:10px;">
        <p style="margin:0; color:#ccc;">
          <strong>Order ID:</strong> ${order._id}<br/>
          <strong>Status:</strong> Delivered
        </p>
      </div>
      <a href="http://localhost:3000/orders/${order._id}/track" 
         style="display:inline-block; background-color:#ff3e00; color:white; padding:14px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:16px;">
        🧾 View Order Summary
      </a>
      <p style="margin-top:40px; font-size:13px; color:#777;">
        We’re honored you chose us. If you enjoyed the experience, consider sharing your feedback!
      </p>
      <div style="margin-top:20px; border-top:1px solid #1e1e1e; padding-top:20px; font-size:12px; color:#555;">
        &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
      </div>
    </div>
  `,
    });

    res.json({ message: "Order marked as completed and user notified", order });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getCompletedOrders = async (req, res) => {
  try {
    const orders = await Order.find({ completed: true }).populate(
      "user",
      "email phone"
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "email name");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.sendEmail = async (req, res) => {
  const { to, subject, text } = req.body;
  if (!to || !subject || !text)
    return res.status(400).json({ message: "Missing fields" });
  try {
   await transporter.sendMail({
  from: process.env.SMTP_USER,
  to,
  subject,
  html: `
    <div style="background-color:#030303; color:white; padding:40px; font-family:'Segoe UI', sans-serif; max-width:600px; margin:auto; border-radius:12px;">
      <h1 style="color:#ff3e00; font-size:28px;">${subject}</h1>
      <p style="font-size:16px; color:#dddddd;">
        ${text?.replace(/\n/g, '<br/>') || 'No message content provided.'}
      </p>
      <p style="margin-top:40px; font-size:13px; color:#777;">
        If you have any questions, just reply to this email — we’re here to help.
      </p>
      <div style="margin-top:20px; border-top:1px solid #1e1e1e; padding-top:20px; font-size:12px; color:#555;">
        &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
      </div>
    </div>
  `
});

    res.json({ message: "Email sent" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to send email", error: err.message });
  }
};

exports.sendBulkEmail = async (req, res) => {
  const { subject, text } = req.body;
  if (!subject || !text)
    return res.status(400).json({ message: "Missing fields" });
  try {
    const users = await User.find({}, "email");
    const emails = users.map((u) => u.email);
   await transporter.sendMail({
  from: process.env.SMTP_USER,
  to: emails, // can be a string or array of recipients
  subject,
  html: `
    <div style="background-color:#030303; color:white; padding:40px; font-family:'Segoe UI', sans-serif; max-width:600px; margin:auto; border-radius:12px;">
      <h1 style="color:#ff3e00; font-size:28px;">📣 ${subject}</h1>
      <p style="font-size:16px; color:#dddddd;">
        ${text?.replace(/\n/g, '<br/>') || 'No content provided.'}
      </p>

      <p style="margin-top:40px; font-size:13px; color:#777;">
        If you have any questions, feel free to reach out to our support team.
      </p>
      <div style="margin-top:20px; border-top:1px solid #1e1e1e; padding-top:20px; font-size:12px; color:#555;">
        &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
      </div>
    </div>
  `
});

    res.json({ message: "Bulk email sent" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to send bulk email", error: err.message });
  }
};

exports.rejectPayment = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id).populate("user");
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.paymentStatus = "rejected";
    order.status = "rejected";
    order.tracking.push({
      status: "Payment rejected",
      note: "Payment rejected by admin",
      date: new Date(),
    });
    await order.save();
    // Send rejection email to user
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: order.user.email,
      subject: "Order Payment Rejected",
      html: `
        <div style="background-color:#030303; color:white; padding:40px; font-family:'Segoe UI', sans-serif; max-width:600px; margin:auto; border-radius:12px;">
          <h1 style="color:#ff3e00; font-size:28px;">Payment Rejected</h1>
          <p style="font-size:16px; color:#dddddd;">
            Hello ${order.user.name || "Customer"},<br/><br/>
            Unfortunately, your payment for <strong style="color:white;">${
              order.products[0]?.name
                ? order.products[0].name + " (Order #" + order._id + ")"
                : "Order #" + order._id
            }</strong> was <span style="color:#ff3e00;">rejected</span> due to <strong>unpaid status</strong>.<br/>
            Please ensure your payment is completed and try again. If you believe this is a mistake, contact our support team.
          </p>
          <div style="margin:30px 0; background-color:#1e1e1e; padding:20px; border-radius:10px;">
            <p style="margin:0; color:#ccc;">
              <strong>Order ID:</strong> ${order._id}<br/>
              <strong>Status:</strong> Payment Rejected
            </p>
          </div>
          <a href="http://localhost:3000/repay/${order._id}" 
             style="display:inline-block; background-color:#ff3e00; color:white; padding:14px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:16px; margin-bottom: 16px;">
            💳 Pay Again
          </a>
          <p style="margin-top:40px; font-size:13px; color:#777;">
            If you have any questions or concerns, just reply to this email — we're here to help.
          </p>
          <div style="margin-top:20px; border-top:1px solid #1e1e1e; padding-top:20px; font-size:12px; color:#555;">
            &copy; ${new Date().getFullYear()} Kartwister Inc. All rights reserved.
          </div>
        </div>
      `,
    });
    res.json({ message: "Payment rejected and user notified", order });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all admin notification emails
exports.getAdminEmails = async (req, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) settings = await Settings.create({ adminEmails: [] });
    res.json({ adminEmails: settings.adminEmails });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admin emails', error: err.message });
  }
};

// Add a new admin notification email
exports.addAdminEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });
  try {
    let settings = await Settings.findOne({});
    if (!settings) settings = await Settings.create({ adminEmails: [email] });
    else if (!settings.adminEmails.includes(email)) {
      settings.adminEmails.push(email);
      await settings.save();
    }
    res.json({ adminEmails: settings.adminEmails });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add admin email', error: err.message });
  }
};

// Remove an admin notification email
exports.removeAdminEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });
  try {
    let settings = await Settings.findOne({});
    if (!settings) return res.status(404).json({ message: 'Settings not found' });
    settings.adminEmails = settings.adminEmails.filter(e => e !== email);
    await settings.save();
    res.json({ adminEmails: settings.adminEmails });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove admin email', error: err.message });
  }
};

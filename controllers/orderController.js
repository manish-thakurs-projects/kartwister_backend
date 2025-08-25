const Order = require('../models/Order');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const Charges = require('../models/Charges');
const Settings = require('../models/Settings');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.placeOrder = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.cart || user.cart.length === 0) return res.status(400).json({ message: 'Cart is empty' });
    const { deliveryAddress } = req.body;
    if (!deliveryAddress || !deliveryAddress.label || !deliveryAddress.addressLine1) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }
    // Fetch charges
    const charges = await Charges.findOne({}) || { shippingCharge: 0, serviceCharge: 0, transactionRate: 0, tax: 0 };
    // Calculate subtotal with transaction fee
    const productsTotal = user.cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const transactionFee = (productsTotal * charges.transactionRate) - productsTotal;
    const taxAmount = ((productsTotal + transactionFee + (charges.shippingCharge || 0) + (charges.serviceCharge || 0)) * (charges.tax / 100));
    const subtotal = productsTotal + transactionFee + (charges.shippingCharge || 0) + (charges.serviceCharge || 0) + taxAmount;
    const order = new Order({
      user: user._id,
      products: user.cart,
      status: 'pending',
      paymentStatus: 'unpaid',
      deliveryAddress,
      shippingCharge: charges.shippingCharge || 0,
      serviceCharge: charges.serviceCharge || 0,
      tracking: [{ status: 'Order placed', date: new Date() }],
      subtotal
    });
    await order.save();
    user.orders.push(order._id);
    user.cart = [];
    await user.save();
    // Notify all admin emails
    try {
      const settings = await Settings.findOne({});
      const adminEmails = settings?.adminEmails || [];
      if (adminEmails.length > 0) {
        const orderDetails = order.products.map(p => `${p.name} x${p.quantity} (रु${p.price})`).join('<br/>');
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: adminEmails,
          subject: 'New Order Placed',
          html: `
            <div style="background:#030303;color:white;padding:32px;font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border-radius:12px;">
              <h1 style="color:#ff3e00;font-size:24px;">New Order Received</h1>
              <p style="font-size:16px;">A new order has been placed by <b>${user.name}</b> (${user.email}).</p>
              <div style="margin:20px 0;background:#1e1e1e;padding:16px;border-radius:8px;">
                <b>Order ID:</b> ${order._id}<br/>
                <b>Products:</b><br/>${orderDetails}<br/>
                <b>Total:</b> रु${order.subtotal.toFixed(2)}
              </div>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin" style="display:inline-block;background:#ff3e00;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">View Admin Panel</a>
            </div>
          `
        });
      }
    } catch (e) { console.error('Failed to send admin order notification:', e); }
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user.userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user.userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order.tracking || []);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.placeOrderWithProof = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.cart || user.cart.length === 0) return res.status(400).json({ message: 'Cart is empty' });
    if (!req.file) return res.status(400).json({ message: 'Payment proof image required' });
    const { deliveryAddress } = req.body;
    let parsedAddress = deliveryAddress;
    if (typeof deliveryAddress === 'string') {
      try { parsedAddress = JSON.parse(deliveryAddress); } catch {}
    }
    if (!parsedAddress || !parsedAddress.label || !parsedAddress.addressLine1) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }
    // Fetch charges
    const charges = await Charges.findOne({}) || { shippingCharge: 0, serviceCharge: 0, transactionRate: 0, tax: 0 };
    // Calculate subtotal with transaction fee
    const productsTotal = user.cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const transactionFee = (productsTotal * charges.transactionRate) - productsTotal;
    const taxAmount = ((productsTotal + transactionFee + (charges.shippingCharge || 0) + (charges.serviceCharge || 0)) * (charges.tax / 100));
    const subtotal = productsTotal + transactionFee + (charges.shippingCharge || 0) + (charges.serviceCharge || 0) + taxAmount;
    // Upload payment proof to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'kartwister/payment_proofs',
      resource_type: 'image',
    });
    const order = new Order({
      user: user._id,
      products: user.cart,
      status: 'pending',
      paymentStatus: 'pending',
      paymentProof: result.secure_url,
      deliveryAddress: parsedAddress,
      shippingCharge: charges.shippingCharge || 0,
      serviceCharge: charges.serviceCharge || 0,
      tracking: [{ status: 'Order placed', date: new Date() }],
      subtotal
    });
    await order.save();
    user.orders.push(order._id);
    user.cart = [];
    await user.save();
    // Notify all admin emails
    try {
      const settings = await Settings.findOne({});
      const adminEmails = settings?.adminEmails || [];
      if (adminEmails.length > 0) {
        const orderDetails = order.products.map(p => `${p.name} x${p.quantity} (रु${p.price})`).join('<br/>');
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: adminEmails,
          subject: 'New Order Placed',
          html: `
            <div style="background:#030303;color:white;padding:32px;font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border-radius:12px;">
              <h1 style="color:#ff3e00;font-size:24px;">New Order Received</h1>
              <p style="font-size:16px;">A new order has been placed by <b>${user.name}</b> (${user.email}).</p>
              <div style="margin:20px 0;background:#1e1e1e;padding:16px;border-radius:8px;">
                <b>Order ID:</b> ${order._id}<br/>
                <b>Products:</b><br/>${orderDetails}<br/>
                <b>Total:</b> रु${order.subtotal.toFixed(2)}
              </div>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin" style="display:inline-block;background:#ff3e00;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">View Admin Panel</a>
            </div>
          `
        });
      }
    } catch (e) { console.error('Failed to send admin order notification:', e); }
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.repayOrder = async (req, res) => {
  const { orderId } = req.params;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const originalOrder = await Order.findById(orderId);
    if (!originalOrder) return res.status(404).json({ message: 'Original order not found' });
    if (String(originalOrder.user) !== String(user._id)) return res.status(403).json({ message: 'Not authorized' });
    if (originalOrder.status !== 'rejected') return res.status(400).json({ message: 'Order is not rejected' });
    if (!req.file) return res.status(400).json({ message: 'Payment proof image required' });
    let parsedAddress = req.body.deliveryAddress;
    if (typeof parsedAddress === 'string') {
      try { parsedAddress = JSON.parse(parsedAddress); } catch {}
    }
    if (!parsedAddress || !parsedAddress.label || !parsedAddress.addressLine1) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }
    // Fetch charges
    const charges = await Charges.findOne({}) || { shippingCharge: 0, serviceCharge: 0, transactionRate: 0, tax: 0 };
    // Calculate subtotal with transaction fee
    const productsTotal = originalOrder.products.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const transactionFee = (productsTotal * charges.transactionRate) - productsTotal;
    const taxAmount = ((productsTotal + transactionFee + (charges.shippingCharge || 0) + (charges.serviceCharge || 0)) * (charges.tax / 100));
    const subtotal = productsTotal + transactionFee + (charges.shippingCharge || 0) + (charges.serviceCharge || 0) + taxAmount;
    // Upload payment proof to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'kartwister/payment_proofs',
      resource_type: 'image',
    });
    const newOrder = new Order({
      user: user._id,
      products: originalOrder.products,
      status: 'pending',
      paymentStatus: 'pending',
      paymentProof: result.secure_url,
      deliveryAddress: parsedAddress,
      shippingCharge: charges.shippingCharge || 0,
      serviceCharge: charges.serviceCharge || 0,
      tracking: [{ status: 'Repayment initiated', date: new Date() }],
      repaidFor: originalOrder._id,
      needsRecheck: true,
      subtotal
    });
    await newOrder.save();
    user.orders.push(newOrder._id);
    await user.save();
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 
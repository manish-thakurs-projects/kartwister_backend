const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash -otp -__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get all addresses
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('addresses');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Add a new address
exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.body.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }
    user.addresses.push(req.body);
    await user.save();
    res.status(201).json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update an address
exports.updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const address = user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ message: 'Address not found' });
    if (req.body.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }
    Object.assign(address, req.body);
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Delete an address
exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.addresses.id(req.params.id).remove();
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Select (set as default) an address
exports.selectAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.addresses.forEach(addr => addr.isDefault = false);
    const address = user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ message: 'Address not found' });
    address.isDefault = true;
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 
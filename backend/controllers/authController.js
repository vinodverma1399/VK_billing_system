const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAudit } = require('./auditController');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        shopName: user.shopName || '',
        shopAddress: user.shopAddress || '',
        shopPhone: user.shopPhone || '',
        shopGst: user.shopGst || '',
        upiId: user.upiId || '',
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // For Staff: fetch Admin's profile to get correct shop info & owner name for receipts
      let ownerName = user.name;
      let shopName = user.shopName || '';
      let shopAddress = user.shopAddress || '';
      let shopPhone = user.shopPhone || '';
      let shopGst = user.shopGst || '';
      let upiId = user.upiId || '';

      if (user.role === 'Staff' && user.ownerId) {
        const admin = await User.findById(user.ownerId).select('name shopName shopAddress shopPhone shopGst upiId');
        if (admin) {
          ownerName = admin.name;
          shopName = admin.shopName || '';
          shopAddress = admin.shopAddress || '';
          shopPhone = admin.shopPhone || '';
          shopGst = admin.shopGst || '';
          upiId = admin.upiId || '';
        }
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        shopName,
        shopAddress,
        shopPhone,
        shopGst,
        upiId,
        role: user.role,
        ownerName,   // Admin/owner's name — always shown as "Prop:" on receipt
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile / shop details
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, shopName, shopAddress, shopPhone, shopGst, upiId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Use !== undefined for ALL fields so empty string '' is also saved
    user.name = name.trim();
    if (shopName !== undefined) user.shopName = shopName;
    if (shopAddress !== undefined) user.shopAddress = shopAddress;
    if (shopPhone !== undefined) user.shopPhone = shopPhone;
    if (shopGst !== undefined) user.shopGst = shopGst;
    if (upiId !== undefined) user.upiId = upiId;

    await user.save();

    // Sync updated shop details to all Staff accounts belonging to this Admin
    await User.updateMany(
      { ownerId: user._id },
      { $set: { shopName: user.shopName, shopAddress: user.shopAddress, shopPhone: user.shopPhone, shopGst: user.shopGst, upiId: user.upiId } }
    );

    await logAudit(
      'Updated Profile',
      'Account',
      user._id,
      user._id,
      user._id,
      `Updated profile/shop details for ${user.shopName || user.name}`
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      shopName: user.shopName || '',
      shopAddress: user.shopAddress || '',
      shopPhone: user.shopPhone || '',
      shopGst: user.shopGst || '',
      upiId: user.upiId || '',
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all staff for an admin
// @route   GET /api/auth/staff
// @access  Private/Admin
const getStaff = async (req, res) => {
  try {
    const staff = await User.find({ ownerId: req.user._id }).select('-password');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new staff member
// @route   POST /api/auth/staff
// @access  Private/Admin
const createStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const staff = await User.create({
      name, email, password, role: 'Staff', ownerId: req.user._id,
      shopName: req.user.shopName, shopAddress: req.user.shopAddress, 
      shopPhone: req.user.shopPhone, shopGst: req.user.shopGst, upiId: req.user.upiId
    });
    
    res.status(201).json({ _id: staff._id, name: staff.name, email: staff.email, role: staff.role });

    await logAudit(
      'Created Staff',
      'Staff',
      req.user._id,
      req.user._id,
      staff._id,
      `Created new staff account: ${name} (${email})`
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update staff
// @route   PUT /api/auth/staff/:id
// @access  Private/Admin
const updateStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const staff = await User.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    staff.name = name || staff.name;
    staff.email = email || staff.email;
    if (password) staff.password = password;

    const updated = await staff.save();

    await logAudit(
      'Updated Staff',
      'Staff',
      req.user._id,
      req.user._id,
      updated._id,
      `Updated details for staff member: ${updated.name}`
    );

    res.json({ _id: updated._id, name: updated.name, email: updated.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete staff
// @route   DELETE /api/auth/staff/:id
// @access  Private/Admin
const deleteStaff = async (req, res) => {
  try {
    const staff = await User.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    await staff.deleteOne();

    await logAudit(
      'Deleted Staff',
      'Staff',
      req.user._id,
      req.user._id,
      req.params.id,
      `Removed staff account: ${staff.name}`
    );

    res.json({ message: 'Staff removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendEmail = require('../utils/sendEmail');

// @desc    Forgot Password - Generate OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 15 mins
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    // Check if email credentials exist
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">VK Billing System</h2>
          <p>Hello <b>${user.name}</b>,</p>
          <p>You requested a password reset. Please use the OTP below to set a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 15px 30px; border-radius: 8px; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">This OTP is valid for 15 minutes. Do not share it with anyone.</p>
        </div>
      `;

      try {
        await sendEmail({
          email: user.email,
          subject: 'Password Reset OTP - VK Billing',
          html: emailHtml
        });
        return res.json({ message: 'OTP sent to your email successfully.' });
      } catch (err) {
        console.error('Email send error:', err);
        return res.status(500).json({ message: 'Error sending email. Please check server email config.' });
      }
    } else {
      // Fallback for development if .env is missing
      console.log(`\n\n========================================`);
      console.log(`PASSWORD RESET OTP FOR ${email}: ${otp}`);
      console.log(`========================================\n\n`);
      return res.json({ message: 'OTP sent successfully (Check server console for demo - Configure EMAIL_USER in .env for real emails)' });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ 
      email, 
      resetOtp: otp,
      resetOtpExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now login.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, loginUser, getProfile, updateProfile, getStaff, createStaff, updateStaff, deleteStaff, forgotPassword, resetPassword };

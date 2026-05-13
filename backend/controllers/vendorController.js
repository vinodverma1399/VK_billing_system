const Vendor = require('../models/Vendor');

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
const getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ user: req.ownerId });
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a vendor
// @route   POST /api/vendors
// @access  Private
const createVendor = async (req, res) => {
  try {
    const { name, mobile, gst } = req.body;

    const vendorExists = await Vendor.findOne({ mobile, user: req.ownerId });
    if (vendorExists) {
      return res.status(400).json({ message: 'Vendor already exists with this mobile' });
    }

    const vendor = await Vendor.create({ name, mobile, gst, user: req.ownerId });
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a vendor
// @route   PUT /api/vendors/:id
// @access  Private
const updateVendor = async (req, res) => {
  try {
    const { name, mobile, gst } = req.body;
    const vendor = await Vendor.findOne({ _id: req.params.id, user: req.ownerId });
    
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (mobile && mobile !== vendor.mobile) {
      const vendorExists = await Vendor.findOne({ mobile, user: req.ownerId });
      if (vendorExists) {
        return res.status(400).json({ message: 'Vendor already exists with this mobile' });
      }
    }

    vendor.name = name || vendor.name;
    vendor.mobile = mobile || vendor.mobile;
    vendor.gst = gst || vendor.gst;
    await vendor.save();

    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a vendor
// @route   DELETE /api/vendors/:id
// @access  Private
const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndDelete({ _id: req.params.id, user: req.ownerId });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getVendors, createVendor, updateVendor, deleteVendor };

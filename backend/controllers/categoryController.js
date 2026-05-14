const Category = require('../models/Category');
const { logAudit } = require('./auditController');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ user: req.ownerId }).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private / Admin
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    
    // Check if category already exists
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, user: req.ownerId });
    if (existing) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = await Category.create({
      name,
      user: req.ownerId
    });

    await logAudit(
      'Created Category',
      'Inventory',
      req.user._id,
      req.ownerId,
      category._id,
      `New category added: ${name}`
    );

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private / Admin
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, user: req.ownerId });
    if (category) {
      const categoryName = category.name;
      await category.deleteOne();

      await logAudit(
        'Deleted Category',
        'Inventory',
        req.user._id,
        req.ownerId,
        req.params.id,
        `Removed category: ${categoryName}`
      );

      res.json({ message: 'Category removed' });
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCategories, createCategory, deleteCategory };

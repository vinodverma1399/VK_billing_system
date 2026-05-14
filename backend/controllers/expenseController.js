const Expense = require('../models/Expense');
const { logAudit } = require('./auditController');

const getExpenses = async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const filter = { user: req.ownerId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); filter.date.$lte = end; }
    }
    if (category) filter.category = category;
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json(expenses);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const createExpense = async (req, res) => {
  try {
    const { title, amount, category, paymentMethod, note, date } = req.body;
    if (!title || !amount) return res.status(400).json({ message: 'Title and amount required' });
    const expense = await Expense.create({
      title, amount: Number(amount), category, paymentMethod, note,
      date: date ? new Date(date) : new Date(),
      user: req.ownerId
    });

    await logAudit(
      'Created Expense',
      'Expense',
      req.user._id,
      req.ownerId,
      expense._id,
      `New expense: ${title} for ₹${amount}`
    );

    res.status(201).json(expense);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.ownerId });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    const { title, amount, category, paymentMethod, note, date } = req.body;
    if (title) expense.title = title;
    if (amount) expense.amount = Number(amount);
    if (category) expense.category = category;
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (note !== undefined) expense.note = note;
    if (date) expense.date = new Date(date);
    await expense.save();

    await logAudit(
      'Updated Expense',
      'Expense',
      req.user._id,
      req.ownerId,
      expense._id,
      `Updated expense details for: ${expense.title}`
    );

    res.json(expense);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.ownerId });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    await logAudit(
      'Deleted Expense',
      'Expense',
      req.user._id,
      req.ownerId,
      req.params.id,
      `Removed expense: ${expense.title}`
    );

    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };

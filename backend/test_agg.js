const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');

const uri = "mongodb://vinodverma2555_bill:VinodBilling2555@ac-pkeseb6-shard-00-00.gfsqi5o.mongodb.net:27017,ac-pkeseb6-shard-00-01.gfsqi5o.mongodb.net:27017,ac-pkeseb6-shard-00-02.gfsqi5o.mongodb.net:27017/vk_billing?replicaSet=atlas-2ygti7-shard-0&authSource=admin&tls=true&retryWrites=true&w=majority";

const testAggregation = async () => {
  try {
    await mongoose.connect(uri);

    const startDate = '2026-05-05';
    const endDate = '2026-05-05';
    
    let matchStage = {};
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      matchStage = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: endOfDay
        }
      };
    }

    console.log("Match Stage:", matchStage);

    const groupBy = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" }
    };

    const pipeline = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: "$finalAmount" },
          totalInvoices: { $sum: 1 },
          paidAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Paid"] }, "$finalAmount", 0] }
          },
          unpaidAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Unpaid"] }, "$finalAmount", 0] }
          }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
    );

    const sales = await Invoice.aggregate(pipeline);
    console.log(JSON.stringify(sales, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testAggregation();

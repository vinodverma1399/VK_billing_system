// Generic CSV exporter — pass headers array and rows array of objects
export const exportToCSV = (filename, headers, rows) => {
  const csvHeaders = headers.map(h => `"${h.label}"`).join(',');
  const csvRows = rows.map(row =>
    headers.map(h => {
      const val = h.accessor(row);
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csvContent = [csvHeaders, ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Pre-built exporters for each entity
export const exportInvoicesCSV = (invoices) => exportToCSV('Invoices', [
  { label: 'Invoice No', accessor: r => r.invoiceNumber || r._id.substring(18) },
  { label: 'Customer', accessor: r => r.customer?.name || 'Walk-in' },
  { label: 'Mobile', accessor: r => r.customer?.mobile || '' },
  { label: 'Date', accessor: r => new Date(r.createdAt).toLocaleDateString('en-IN') },
  { label: 'Subtotal', accessor: r => r.subTotal },
  { label: 'GST', accessor: r => r.totalGst },
  { label: 'Discount', accessor: r => r.totalDiscount },
  { label: 'Final Amount', accessor: r => r.finalAmount },
  { label: 'Amount Paid', accessor: r => r.amountPaid || 0 },
  { label: 'Status', accessor: r => r.status },
], invoices);

export const exportProductsCSV = (products) => exportToCSV('Products', [
  { label: 'Name', accessor: r => r.name },
  { label: 'Barcode', accessor: r => r.barcode || '' },
  { label: 'Price', accessor: r => r.price },
  { label: 'Cost Price', accessor: r => r.costPrice || 0 },
  { label: 'GST %', accessor: r => r.gst },
  { label: 'Stock', accessor: r => r.stock },
  { label: 'Low Stock Alert', accessor: r => r.lowStockThreshold },
], products);

export const exportCustomersCSV = (customers) => exportToCSV('Customers', [
  { label: 'Name', accessor: r => r.name },
  { label: 'Mobile', accessor: r => r.mobile },
  { label: 'Email', accessor: r => r.email || '' },
  { label: 'Address', accessor: r => r.address || '' },
], customers);

export const exportVendorsCSV = (vendors) => exportToCSV('Vendors', [
  { label: 'Name', accessor: r => r.name },
  { label: 'Mobile', accessor: r => r.mobile },
  { label: 'GSTIN', accessor: r => r.gst || 'N/A' },
], vendors);

export const exportExpensesCSV = (expenses) => exportToCSV('Expenses', [
  { label: 'Title', accessor: r => r.title },
  { label: 'Category', accessor: r => r.category },
  { label: 'Amount', accessor: r => r.amount },
  { label: 'Payment Method', accessor: r => r.paymentMethod },
  { label: 'Date', accessor: r => new Date(r.date).toLocaleDateString('en-IN') },
  { label: 'Note', accessor: r => r.note || '' },
], expenses);

export const exportSalesReportCSV = (data, type) => exportToCSV(`Sales_Report_${type}`, [
  { label: 'Period', accessor: r => type === 'daily' ? `${r._id.day}/${r._id.month}/${r._id.year}` : `${r._id.month}/${r._id.year}` },
  { label: 'Revenue', accessor: r => r.totalRevenue },
  { label: 'GST Collected', accessor: r => r.totalGst || 0 },
  { label: 'Paid Amount', accessor: r => r.paidAmount },
  { label: 'Unpaid Amount', accessor: r => r.unpaidAmount },
  { label: 'Invoices Count', accessor: r => r.totalInvoices },
], data);

export const exportVendorPurchasesCSV = (data) => exportToCSV('Vendor_Purchases_Report', [
  { label: 'Vendor Name', accessor: r => r.vendorName },
  { label: 'Mobile', accessor: r => r.vendorMobile || 'N/A' },
  { label: 'Total Purchases', accessor: r => r.totalPurchases },
  { label: 'Orders Count', accessor: r => r.purchaseCount },
], data);

export const exportInvoiceStatusCSV = (data) => exportToCSV('Invoice_Status_Report', [
  { label: 'Date', accessor: r => new Date(r.date).toLocaleDateString('en-IN') },
  { label: 'Type', accessor: r => r.type },
  { label: 'Client Name', accessor: r => r.clientName },
  { label: 'Amount', accessor: r => r.amount },
  { label: 'Status', accessor: r => r.status },
], data);

// GSTR-1 Format Exporter
export const exportGstReportCSV = (invoices) => {
  const rows = invoices.map(inv => {
    // Group product amounts by GST %
    const gstBreakdown = {
      0: { taxable: 0, tax: 0 },
      5: { taxable: 0, tax: 0 },
      12: { taxable: 0, tax: 0 },
      18: { taxable: 0, tax: 0 },
      28: { taxable: 0, tax: 0 }
    };

    (inv.products || []).forEach(item => {
      // IMPORTANT: item.gst is the GST AMOUNT in Rupees.
      // item.product.gst is the PERCENTAGE.
      const gstPercent = item.product?.gst || 0;
      
      // Effective price after item discount
      const itemTotalBeforeTax = (item.price * item.quantity) - (item.discount || 0);
      const itemGst = item.gst || ((itemTotalBeforeTax * gstPercent) / 100);
      
      const slab = [0, 5, 12, 18, 28].includes(gstPercent) ? gstPercent : 0;
      gstBreakdown[slab].taxable += itemTotalBeforeTax;
      gstBreakdown[slab].tax += itemGst;
    });

    return {
      date: new Date(inv.createdAt).toLocaleDateString('en-IN'),
      invoiceNo: inv.invoiceNumber || inv._id.substring(18),
      customerName: inv.customer?.name || 'Walk-in',
      customerMobile: inv.customer?.mobile || '',
      taxable0: gstBreakdown[0].taxable.toFixed(2),
      taxable5: gstBreakdown[5].taxable.toFixed(2),
      tax5: gstBreakdown[5].tax.toFixed(2),
      taxable12: gstBreakdown[12].taxable.toFixed(2),
      tax12: gstBreakdown[12].tax.toFixed(2),
      taxable18: gstBreakdown[18].taxable.toFixed(2),
      tax18: gstBreakdown[18].tax.toFixed(2),
      taxable28: gstBreakdown[28].taxable.toFixed(2),
      tax28: gstBreakdown[28].tax.toFixed(2),
      totalDiscount: inv.totalDiscount || 0,
      finalAmount: inv.finalAmount
    };
  });

  exportToCSV('GST_Report_GSTR1', [
    { label: 'Date', accessor: r => r.date },
    { label: 'Invoice No', accessor: r => r.invoiceNo },
    { label: 'Customer Name', accessor: r => r.customerName },
    { label: 'Customer Mobile', accessor: r => r.customerMobile },
    { label: 'Taxable Val (0%)', accessor: r => r.taxable0 },
    { label: 'Taxable Val (5%)', accessor: r => r.taxable5 },
    { label: 'GST Collected (5%)', accessor: r => r.tax5 },
    { label: 'Taxable Val (12%)', accessor: r => r.taxable12 },
    { label: 'GST Collected (12%)', accessor: r => r.tax12 },
    { label: 'Taxable Val (18%)', accessor: r => r.taxable18 },
    { label: 'GST Collected (18%)', accessor: r => r.tax18 },
    { label: 'Taxable Val (28%)', accessor: r => r.taxable28 },
    { label: 'GST Collected (28%)', accessor: r => r.tax28 },
    { label: 'Total Discount', accessor: r => r.totalDiscount },
    { label: 'Final Invoice Amount', accessor: r => r.finalAmount },
  ], rows);
};

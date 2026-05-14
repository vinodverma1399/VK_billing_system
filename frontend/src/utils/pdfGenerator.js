import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Get shop profile — always uses Admin/owner shop details
// Staff localStorage also holds admin shop info synced on login
const getShopInfo = () => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    return {
      shopName: userInfo.shopName || 'VK Billing System',
      shopAddress: userInfo.shopAddress || '',
      shopPhone: userInfo.shopPhone || '',
      shopGst: userInfo.shopGst || '',
      upiId: userInfo.upiId || '',
      ownerName: userInfo.ownerName || userInfo.name || '',  // always admin/owner name
      staffName: userInfo.role === 'Staff' ? userInfo.name : null  // staff name if applicable
    };
  } catch { return { shopName: 'VK Billing System', shopAddress: '', shopPhone: '', shopGst: '', upiId: '', ownerName: '', staffName: null }; }
};

// ── A4 Invoice PDF ──────────────────────────────────────────────────────
export const buildInvoiceDoc = (inv) => {
  if (!inv) { console.error('No invoice data'); return null; }

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const shop = getShopInfo();

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 48, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(shop.shopName.toUpperCase(), 14, 20);

    let currentY = 26;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (shop.ownerName) { doc.text(`Prop: ${shop.ownerName}`, 14, currentY); currentY += 5; }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (shop.shopAddress) { doc.text(shop.shopAddress, 14, currentY); currentY += 5; }
    const contactLine = [shop.shopPhone ? `Mob: ${shop.shopPhone}` : '', shop.shopGst ? `GST: ${shop.shopGst}` : ''].filter(Boolean).join('  |  ');
    if (contactLine) { doc.text(contactLine, 14, currentY); }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth - 14, 20, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const invNum = inv.invoiceNumber || `#${(inv._id || '').toString().substring(18).toUpperCase()}`;
    doc.text(invNum, pageWidth - 14, 28, { align: 'right' });
    doc.text(`Date: ${new Date(inv.createdAt || Date.now()).toLocaleDateString('en-IN')}`, pageWidth - 14, 34, { align: 'right' });
    doc.text(`Status: ${inv.status || 'Paid'}`, pageWidth - 14, 40, { align: 'right' });

    // Bill To
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 14, 60);
    doc.setFont('helvetica', 'normal');
    const customerName = inv.customer?.name || inv.customerName || 'Valued Customer';
    const customerMobile = inv.customer?.mobile || inv.customerMobile || '';
    doc.text(customerName, 14, 67);
    if (customerMobile) doc.text(`Mobile: ${customerMobile}`, 14, 73);

    // Payment info
    if (inv.amountPaid !== undefined && inv.amountPaid < inv.finalAmount) {
      const balance = inv.finalAmount - inv.amountPaid;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(`Balance Due: Rs ${balance.toLocaleString('en-IN')}`, pageWidth - 14, 60, { align: 'right' });
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.text(`Paid: Rs ${Number(inv.amountPaid).toLocaleString('en-IN')}`, pageWidth - 14, 67, { align: 'right' });
    }

    // Products Table
    const tableRows = (inv.products || []).map(p => {
      const name = p.product?.name || p.name || 'Item';
      const category = p.product?.category || p.category || '-';
      const unit = p.product?.unit || p.unit || 'Piece';
      const price = Number(p.price) || 0;
      const qty = Number(p.quantity) || 0;
      const gstPct = p.product?.gst ?? 0;
      const total = Number(p.total) || (qty * price * (1 + gstPct / 100));
      return [category, name, `${qty} ${unit}`, `Rs ${price.toLocaleString('en-IN')}`, `${gstPct}%`, `Rs ${total.toLocaleString('en-IN')}`];
    });

    autoTable(doc, {
      startY: 82,
      head: [['Category', 'Product Name', 'Qty', 'Unit Price', 'GST', 'Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = doc.lastAutoTable?.finalY || 82;
    const summaryX = pageWidth - 75;

    const subTotal = Number(inv.subTotal) || 0;
    const totalGst = Number(inv.totalGst) || 0;
    const discount = Number(inv.totalDiscount) || 0;
    const finalAmount = Number(inv.finalAmount) || 0;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', summaryX, finalY + 12);
    doc.text(`Rs ${subTotal.toLocaleString('en-IN')}`, pageWidth - 14, finalY + 12, { align: 'right' });
    doc.text('GST:', summaryX, finalY + 19);
    doc.text(`Rs ${totalGst.toLocaleString('en-IN')}`, pageWidth - 14, finalY + 19, { align: 'right' });
    if (discount > 0) {
      doc.text('Discount:', summaryX, finalY + 26);
      doc.text(`- Rs ${discount.toLocaleString('en-IN')}`, pageWidth - 14, finalY + 26, { align: 'right' });
    }

    const totalY = finalY + (discount > 0 ? 34 : 28);
    doc.setFillColor(30, 41, 59);
    doc.rect(summaryX - 5, totalY, 75, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', summaryX, totalY + 8);
    doc.text(`Rs ${finalAmount.toLocaleString('en-IN')}`, pageWidth - 14, totalY + 8, { align: 'right' });

    // Payment Ledger (if partial payments)
    if (inv.payments && inv.payments.length > 1) {
      const ledgerY = totalY + 20;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT HISTORY:', 14, ledgerY);
      inv.payments.forEach((pay, i) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${new Date(pay.paidAt).toLocaleDateString('en-IN')} - ${pay.method}: Rs ${pay.amount.toLocaleString('en-IN')}${pay.note ? ` (${pay.note})` : ''}`, 14, ledgerY + 7 + (i * 6));
      });
    }

    // Billed By — only show if a Staff member created this invoice (not the Admin/owner)
    const billedBy = (inv.createdBy?.role === 'Staff' ? inv.createdBy.name : null) || shop.staffName || null;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (billedBy) {
      doc.text(`Billed by: ${billedBy}`, 14, 278);
    }
    doc.setFont('helvetica', 'italic');
    doc.text('Thank you for your business!', pageWidth / 2, 282, { align: 'center' });
    doc.text('This is a computer-generated invoice.', pageWidth / 2, 287, { align: 'center' });
    doc.text('Powered by VK Billing System', pageWidth / 2, 292, { align: 'center' });

    return doc;
  } catch (err) {
    console.error('PDF error:', err);
    alert('Failed to generate PDF. Check console.');
    return null;
  }
};

export const generateInvoicePDF = (inv) => {
  const doc = buildInvoiceDoc(inv);
  if (doc) {
    const invNum = inv.invoiceNumber || `#${(inv._id || '').toString().substring(18).toUpperCase()}`;
    doc.save(`${invNum}.pdf`);
  }
};

export const shareInvoicePDF = async (inv) => {
  const doc = buildInvoiceDoc(inv);
  if (!doc) return;
  
  const invNum = inv.invoiceNumber || `#${(inv._id || '').toString().substring(18).toUpperCase()}`;
  const shop = getShopInfo();
  const pdfBlob = doc.output('blob');
  const file = new File([pdfBlob], `Invoice_${invNum}.pdf`, { type: 'application/pdf' });
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${invNum}`,
        text: `Hello! Here is your invoice from ${shop.shopName}.`
      });
    } catch (err) { console.error('Share cancelled', err); }
  } else {
    doc.save(`Invoice_${invNum}.pdf`);
    alert('Direct PDF sharing is not supported on this device. The PDF has been downloaded. We will now open WhatsApp so you can attach it manually.');
    const mobile = inv.customer?.mobile || inv.customerMobile;
    const text = encodeURIComponent(`Hello! Here is your invoice ${invNum} from ${shop.shopName}. (Please find the attached PDF)`);
    const url = mobile ? `https://wa.me/91${mobile}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }
};

// ── Thermal Print (80mm) ─────────────────────────────────────────────────
export const printThermal = (inv) => {
  if (!inv) return;
  const shop = getShopInfo();
  const invNum = inv.invoiceNumber || `#${(inv._id || '').toString().substring(18).toUpperCase()}`;
  const date = new Date(inv.createdAt || Date.now()).toLocaleDateString('en-IN');
  const customerName = inv.customer?.name || 'Walk-in Customer';
  const customerMobile = inv.customer?.mobile || '';
  const subTotal = Number(inv.subTotal) || 0;
  const totalGst = Number(inv.totalGst) || 0;
  const discount = Number(inv.totalDiscount) || 0;
  const finalAmount = Number(inv.finalAmount) || 0;
  const amountPaid = Number(inv.amountPaid) || 0;
  const balance = Math.max(0, finalAmount - amountPaid);

  const thermalHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Thermal Receipt - ${invNum}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .big { font-size: 16px; font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; font-size: 11px; }
        .item-name { max-width: 40mm; }
        @media print { body { margin: 0; } @page { margin: 0; size: 80mm auto; } }
      </style>
    </head>
    <body>
      <div class="center big">${shop.shopName}</div>
      ${shop.ownerName ? `<div class="center bold">Prop: ${shop.ownerName}</div>` : ''}
      ${shop.shopAddress ? `<div class="center">${shop.shopAddress}</div>` : ''}
      ${shop.shopPhone ? `<div class="center">Mob: ${shop.shopPhone}</div>` : ''}
      ${shop.shopGst ? `<div class="center">GST: ${shop.shopGst}</div>` : ''}
      <div class="divider"></div>
      <div class="row"><span>Invoice:</span><span class="bold">${invNum}</span></div>
      <div class="row"><span>Date:</span><span>${date}</span></div>
      <div class="row"><span>Customer:</span><span>${customerName}</span></div>
      ${customerMobile ? `<div class="row"><span>Mobile:</span><span>${customerMobile}</span></div>` : ''}
      ${(() => {
        // Show 'Billed By' only if a Staff created this invoice — not if Admin/owner did
        const b = (inv.createdBy?.role === 'Staff' ? inv.createdBy.name : null) || shop.staffName;
        return b ? `<div class="row"><span>Billed By:</span><span class="bold">${b}</span></div>` : '';
      })()}
      <div class="divider"></div>
      <table>
        <tr><td class="bold">Category</td><td class="bold">Item</td><td class="bold right">Qty</td><td class="bold right">Amt</td></tr>
        <tr><td colspan="4"><div class="divider"></div></td></tr>
        ${(inv.products || []).map(p => {
    const category = p.product?.category || p.category || '-';
    const name = p.product?.name || p.name || 'Item';
    const unit = p.product?.unit || p.unit || 'Pc';
    const qty = Number(p.quantity) || 0;
    const price = Number(p.price) || 0;
    const total = Number(p.total) || (qty * price);
    return `<tr>
            <td class="item-name">${category}</td>
            <td class="item-name">${name}</td>
            <td class="right">${qty} ${unit}</td>
            <td class="right">${total.toFixed(0)}</td>
          </tr>`;
  }).join('')}
      </table>
      <div class="divider"></div>
      <div class="row"><span>Subtotal:</span><span>Rs ${subTotal.toFixed(0)}</span></div>
      <div class="row"><span>GST:</span><span>Rs ${totalGst.toFixed(0)}</span></div>
      ${discount > 0 ? `<div class="row"><span>Discount:</span><span>- Rs ${discount.toFixed(0)}</span></div>` : ''}
      <div class="total-row"><span>TOTAL:</span><span>Rs ${finalAmount.toFixed(0)}</span></div>
      ${amountPaid > 0 && amountPaid < finalAmount ? `
        <div class="row"><span>Paid:</span><span>Rs ${amountPaid.toFixed(0)}</span></div>
        <div class="row bold"><span>BALANCE:</span><span>Rs ${balance.toFixed(0)}</span></div>
      ` : ''}
      ${inv.status === 'Paid' ? '<div class="center bold" style="margin-top:6px">✓ PAID IN FULL</div>' : ''}
      
      ${balance > 0 && shop.upiId ? `
      <div class="center" style="margin-top:10px; margin-bottom:5px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shopName)}&am=${balance.toFixed(2)}&cu=INR`)}" style="width:120px; height:120px;" />
        <div style="font-size:10px; font-weight:bold; margin-top:2px;">Scan to Pay ₹${balance.toFixed(0)}</div>
        <div style="font-size:9px; color:#666;">${shop.upiId}</div>
      </div>
      ` : ''}

      <div class="divider"></div>
      <div class="center" style="margin-top:6px">Thank you for shopping!</div>
      <div class="center bold" style="font-size:10px;color:#666">Powered by VK Billing System</div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) {
    alert('Popup blocked! Please allow popups for this site to print receipts.');
    return;
  }
  win.document.write(thermalHTML);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
};

// ── Monthly P&L PDF Report ───────────────────────────────────────────────
export const generatePLReport = (metrics, month, year) => {
  const doc = new jsPDF();
  const shop = getShopInfo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const monthName = new Date(year, (month || new Date().getMonth())).toLocaleString('en-IN', { month: 'long' });

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(`${shop.shopName} — P&L Report`, 14, 22);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`${monthName} ${year}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 32);

  const rows = [
    ['Gross Revenue', `Rs ${Number(metrics.totalRevenue || 0).toLocaleString('en-IN')}`],
    ['Cost of Goods Sold (COGS)', `Rs ${Number(metrics.totalCOGS || 0).toLocaleString('en-IN')}`],
    ['Total Refunds', `Rs ${Number(metrics.totalRefunds || 0).toLocaleString('en-IN')}`],
    ['Gross Profit', `Rs ${Number(metrics.grossProfit || 0).toLocaleString('en-IN')}`],
    ['Gross Margin', `${metrics.grossMargin || 0}%`],
    ['', ''],
    ['Total Expenses', `Rs ${Number(metrics.totalExpenses || 0).toLocaleString('en-IN')}`],
    ['Net Profit', `Rs ${Number(metrics.netProfit || 0).toLocaleString('en-IN')}`],
    ['Net Margin', `${metrics.netMargin || 0}%`],
    ['', ''],
    ['Total GST Collected', `Rs ${Number(metrics.totalGst || 0).toLocaleString('en-IN')}`],
    ['Total Paid Invoices', `Rs ${Number(metrics.totalPaid || 0).toLocaleString('en-IN')}`],
    ['Total Unpaid / Pending', `Rs ${Number(metrics.totalUnpaid || 0).toLocaleString('en-IN')}`],
    ['Total Invoices Issued', metrics.invoiceCount || 0],
  ];

  autoTable(doc, {
    startY: 55,
    head: [['Metric', 'Value']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });

  // Best sellers section
  if (metrics.bestSellers?.length > 0) {
    const bsY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('Top Selling Products', 14, bsY);
    autoTable(doc, {
      startY: bsY + 5,
      head: [['Product', 'Units Sold', 'Revenue']],
      body: metrics.bestSellers.map((p, i) => [`${i + 1}. ${p.name}`, p.qty, `Rs ${Number(p.revenue).toLocaleString('en-IN')}`]),
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 9, cellPadding: 4 }
    });
  }

  doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic');
  doc.text(`${shop.shopName} — Confidential P&L Report`, pageWidth / 2, 287, { align: 'center' });

  doc.save(`PL_Report_${monthName}_${year}.pdf`);
};

// ── Return Receipt Thermal Print (80mm) ──────────────────────────────────
export const printReturnThermal = (ret) => {
  if (!ret) return;
  const shop = getShopInfo();
  const retId = `RET-${(ret._id || '').toString().substring(18).toUpperCase()}`;
  const date = new Date(ret.createdAt || Date.now()).toLocaleDateString('en-IN');
  const customerName = ret.customer?.name || 'Customer';
  const customerMobile = ret.customer?.mobile || '';
  const invNum = ret.invoice?.invoiceNumber || '';
  const totalRefund = Number(ret.totalRefund) || 0;

  const thermalHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Return Receipt - ${retId}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .big { font-size: 16px; font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; font-size: 11px; }
        .item-name { max-width: 40mm; }
        .tag { font-size: 10px; padding: 1px 4px; border: 1px solid #000; display: inline-block; }
        @media print { body { margin: 0; } @page { margin: 0; size: 80mm auto; } }
      </style>
    </head>
    <body>
      <div class="center big">${shop.shopName}</div>
      ${shop.ownerName ? `<div class="center bold">Prop: ${shop.ownerName}</div>` : ''}
      ${shop.shopAddress ? `<div class="center">${shop.shopAddress}</div>` : ''}
      ${shop.shopPhone ? `<div class="center">Mob: ${shop.shopPhone}</div>` : ''}
      ${shop.shopGst ? `<div class="center">GST: ${shop.shopGst}</div>` : ''}
      <div class="center bold" style="margin-top:4px;font-size:14px">--- RETURN RECEIPT ---</div>
      <div class="divider"></div>
      <div class="row"><span>Return ID:</span><span class="bold">${retId}</span></div>
      <div class="row"><span>Date:</span><span>${date}</span></div>
      ${invNum ? `<div class="row"><span>Invoice:</span><span class="bold">${invNum}</span></div>` : ''}
      <div class="row"><span>Customer:</span><span>${customerName}</span></div>
      ${customerMobile ? `<div class="row"><span>Mobile:</span><span>${customerMobile}</span></div>` : ''}
      <div class="row"><span>Reason:</span><span>${ret.reason || 'Customer Return'}</span></div>
      <div class="row"><span>Status:</span><span class="bold">${ret.status || 'Pending'}</span></div>
      ${ret.createdBy?.name ? `<div class="row"><span>Processed By:</span><span class="bold">${ret.createdBy.name}</span></div>` : (shop.staffName ? `<div class="row"><span>Processed By:</span><span class="bold">${shop.staffName}</span></div>` : '')}
      <div class="divider"></div>
      <table>
        <tr><td class="bold">Category</td><td class="bold">Item</td><td class="bold right">Qty</td><td class="bold right">Refund</td></tr>
        <tr><td colspan="4"><div class="divider"></div></td></tr>
        ${(ret.returnedProducts || []).map(rp => {
    const category = rp.product?.category || '-';
    const name = rp.productName || rp.product?.name || 'Item';
    const unit = rp.product?.unit || 'Pc';
    const qty = Number(rp.quantity) || 0;
    const cond = rp.condition === 'Defective' ? 'Defect' : 'Good';
    const refund = Number(rp.refundAmount) || 0;
    return `<tr>
            <td>${category}</td>
            <td class="item-name">${name}<br/><small>(${cond})</small></td>
            <td class="right">${qty} ${unit}</td>
            <td class="right">${refund.toFixed(0)}</td>
          </tr>`;
  }).join('')}
      </table>
      <div class="divider"></div>
      <div class="total-row"><span>REFUND TOTAL:</span><span>Rs ${totalRefund.toFixed(0)}</span></div>
      ${ret.status === 'Approved' ? '<div class="center bold" style="margin-top:6px">✓ RETURN APPROVED</div>' : ''}
      ${ret.status === 'Rejected' ? '<div class="center bold" style="margin-top:6px">✗ RETURN REJECTED</div>' : ''}
      ${ret.status === 'Pending' ? '<div class="center bold" style="margin-top:6px">⏳ PENDING APPROVAL</div>' : ''}
      <div class="divider"></div>
      <div class="center" style="margin-top:6px">Thank you!</div>
      <div class="center bold" style="font-size:10px;color:#666">Powered by VK Billing System</div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(thermalHTML);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
};

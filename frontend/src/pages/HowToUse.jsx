import { useState } from 'react';

const HowToUse = () => {
  const [activeTab, setActiveTab] = useState('billing');

  const steps = {
    billing: [
      { title: 'Customer & Search', desc: 'Enter mobile number for new customers. Existing customers will be suggested automatically. Use "Walk-in" for direct sales without saving details.', icon: '👤' },
      { title: 'Smart Product Entry', desc: 'Use a barcode scanner or type the product name. The system will warn you instantly if a product is out of stock.', icon: '🛒' },
      { title: 'Payment Strategies', desc: 'Cash: Instant receipt. UPI: Shows a dynamic QR code for scanning. Partial: Record the amount received; the balance is auto-added to the customer ledger.', icon: '💳' },
      { title: 'Printing & Sharing', desc: 'Supports 2-inch and 3-inch thermal prints. Click the WhatsApp icon to save paper and send digital invoices directly to customers.', icon: '🖨️' },
    ],
    inventory: [
      { title: 'Bulk Stock Management', desc: 'Use the Stock Entry section to update multiple items at once when receiving stock from vendors. This maintains purchase history.', icon: '📦' },
      { title: 'Alert Thresholds', desc: 'Set a "Minimum Stock Level" for every product. When stock falls below this, a red blinking alert will appear on the Dashboard.', icon: '⚠️' },
      { title: 'Returns & Refunds', desc: 'Process returns by entering the invoice number. The system auto-calculates refunds and adds items back to the warehouse inventory.', icon: '↩️' },
      { title: 'Category Tracking', desc: 'Organize products into categories to track which product types are performing best in your sales reports.', icon: '📊' },
    ],
    admin: [
      { title: 'Staff Performance', desc: 'Monitor how many bills each staff member generated and their total cash collection. Simplifies end-of-day accounting.', icon: '👨‍💼' },
      { title: 'GSTR-1 & Tax Prep', desc: 'Download monthly CSV reports from the Reports section. All GST details (CGST/SGST/Total) are pre-formatted for easy filing.', icon: '📈' },
      { title: 'Activity Audit Log', desc: 'Track every action, including bill edits or deletions. See who did what and at what time for maximum security.', icon: '🕵️‍♂️' },
      { title: 'Shop Branding', desc: 'Update your shop logo, address, and GSTIN in Profile Settings. These details will be professionally printed on every invoice.', icon: '⚙️' },
    ]
  };

  return (
    <div className="space-y-10">
      <div className="premium-glass p-10 rounded-[2.5rem] relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2 uppercase">Official User Manual</h1>
          <p className="text-gray-500 text-lg font-medium italic">"VK Billing - Making business management simple and professional"</p>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-4 border border-white shadow-xl overflow-hidden">
        <div className="flex flex-wrap gap-2 mb-8 p-4">
          {Object.keys(steps).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? 'bg-gray-900 text-white shadow-xl scale-105' 
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {tab === 'billing' ? '🧾 Billing Guide' : tab === 'inventory' ? '📦 Inventory' : '👑 Admin Controls'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          {steps[activeTab].map((step, idx) => (
            <div key={idx} className="bg-white/80 p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:rotate-12 transition-transform">
                {step.icon}
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">{idx + 1}. {step.title}</h3>
              <p className="text-gray-500 font-medium leading-relaxed text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4">
            <h2 className="text-3xl font-black">Official Support Channels</h2>
            <p className="text-blue-200 font-medium max-w-md">For technical assistance, license queries, or feature requests, contact our official support team.</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm font-bold">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">✉️</span>
                vkbillingofficial@gmail.com
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">🕒</span>
                Response Time: Within 24 hours
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <a 
              href="https://wa.me/918004190813" 
              target="_blank" 
              rel="noreferrer"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black shadow-xl text-center transition-all hover:scale-105 flex items-center justify-center gap-3"
            >
              💬 WhatsApp Support
            </a>
            <p className="text-center text-[10px] uppercase tracking-[0.2em] font-black text-gray-400">Powered by VK Enterprise</p>
          </div>
        </div>
      </div>
    </div>
  );
};


export default HowToUse;

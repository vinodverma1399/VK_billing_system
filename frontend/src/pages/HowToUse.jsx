import { useState } from 'react';

const HowToUse = () => {
  const [activeTab, setActiveTab] = useState('billing');

  const steps = {
    billing: [
      { title: 'Customer Details', desc: 'Enter name and mobile. Existing customers will auto-suggest.', icon: '👤' },
      { title: 'Add Items', desc: 'Search products or use a barcode scanner. Price and GST are auto-filled.', icon: '🛒' },
      { title: 'Choose Payment', desc: 'Select Cash, UPI (shows QR), or Partial for balance tracking.', icon: '💳' },
      { title: 'Print Receipt', desc: 'Click Print Thermal for a standard receipt or Share via WhatsApp.', icon: '🖨️' },
    ],
    inventory: [
      { title: 'Add Products', desc: 'Add new items with HSN codes and set alert thresholds.', icon: '📦' },
      { title: 'Stock Entry', desc: 'Update inventory when you purchase new stock from vendors.', icon: '📥' },
      { title: 'Low Stock Alert', desc: 'Dashboard shows red alerts when items fall below your set limit.', icon: '⚠️' },
      { title: 'Returns', desc: 'Process customer returns to automatically add items back to stock.', icon: '↩️' },
    ],
    admin: [
      { title: 'Staff Performance', desc: 'Track sales made by each staff member in real-time.', icon: '👨‍💼' },
      { title: 'GSTR-1 Reports', desc: 'Generate and download GST-ready CSV reports for accounting.', icon: '📈' },
      { title: 'Audit Logs', desc: 'Monitor every single action taken by any user in the system.', icon: '🕵️‍♂️' },
      { title: 'Shop Profile', desc: 'Set your shop logo, address, and UPI ID for invoices.', icon: '⚙️' },
    ]
  };

  return (
    <div className="space-y-10">
      <div className="premium-glass p-10 rounded-[2.5rem] relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Help Center & User Guide</h1>
          <p className="text-gray-500 text-lg font-medium">Master the VK Billing System in minutes</p>
        </div>
        <div className="absolute top-0 right-0 p-10 text-6xl opacity-10">📘</div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-4 border border-white shadow-xl">
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.keys(steps).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? 'bg-gray-900 text-white shadow-xl scale-105' 
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {tab === 'billing' ? '🧾 Billing Guide' : tab === 'inventory' ? '📦 Inventory' : '👑 Admin Controls'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {steps[activeTab].map((step, idx) => (
            <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                {step.icon}
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">{idx + 1}. {step.title}</h3>
              <p className="text-gray-500 font-medium leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black mb-2">Need direct assistance?</h2>
          <p className="text-blue-100 font-medium">Our technical support is available for your enterprise needs.</p>
        </div>
        <a 
          href="https://wa.me/91XXXXXXXXXX" 
          target="_blank" 
          rel="noreferrer"
          className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
};

export default HowToUse;

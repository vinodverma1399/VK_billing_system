# VK Billing System

A professional MERN stack Billing & Inventory Management System with premium glassmorphic UI, thermal printing, and staff management.

## 🚀 Features
- **Smart Dashboard**: Real-time sales analytics, low-stock alerts, and staff performance tracking.
- **Invoice Management**: Create, edit, and cancel invoices. Support for partial payments.
- **Inventory Control**: Barcode-ready product management with automatic stock adjustment.
- **Staff Management**: Multi-user support with role-based access (Admin/Staff).
- **Reports & Audits**: GSTR-1 reports, expense tracking, and detailed audit logs.
- **Modern UI**: Fully responsive, glassmorphic design built with React and Tailwind CSS.
- **WhatsApp Integration**: Share invoices directly via WhatsApp.
- **UPI Payments**: Built-in dynamic QR code generation for quick payments.

## 🛠️ Tech Stack
- **Frontend**: React.js, Tailwind CSS, Vite, Axios, Socket.io-client
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), JWT, Socket.io
- **Utilities**: Thermal Printing (Browser-based), CSV Export

## 📦 Local Installation

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/vk-billing-system.git
cd vk-billing-system
```

### 2. Backend Setup
```bash
cd backend
npm install
```
- Create a `.env` file in `backend/` and add:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:5173
```
- Start backend: `npm run dev`

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```
- Create a `.env.development` file in `frontend/` and add:
```env
VITE_API_URL=http://localhost:5000
```
- Start frontend: `npm run dev`

## 📄 License
This project is for private use.

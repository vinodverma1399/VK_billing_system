const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Create a transporter using standard SMTP (e.g., Gmail)
  const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to your email provider
    auth: {
      user: process.env.EMAIL_USER, // e.g. your_email@gmail.com
      pass: process.env.EMAIL_PASS, // e.g. Gmail App Password
    },
  });

  const mailOptions = {
    from: `"VK Billing System" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;

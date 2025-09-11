const nodemailer = require('nodemailer');

let otpStorage = {};

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587, 
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});


transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Transporter Error:', error);
  } else {
    //console.log('SMTP Transporter is ready to send emails');
  }
});

// Generate OTP
exports.generateOtp = (email) => {
    const otp = Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit OTP
  
    otpStorage[email] = {
      otp: otp,
      expiry: Date.now() + 5 * 60 * 1000, 
    };
    //console.log(`Generated OTP for ${email}: ${otp}`);
  
    return otp;
};  

// Validate OTP
exports.validateOtp = (email, otp) => {
    const otpData = otpStorage[email];
    //console.log(`Stored OTP for ${email}: ${otpData ? otpData.otp : 'N/A'}`); // Debugging
    //console.log(`Received OTP for validation: ${otp}`);
  
    if (otpData && otpData.otp == otp) {
      if (Date.now() > otpData.expiry) {
        console.warn(`OTP for ${email} has expired`);
        delete otpStorage[email]; 
        return false; 
      }
      
      delete otpStorage[email];
      //console.log(`OTP validated successfully for ${email}`);
      return true;
    }
    //console.warn(`Invalid OTP attempt for ${email}`);
    return false;
};  

// Send OTP Email
exports.sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `Keitai <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Keitai',
    text: `Your OTP is: ${otp}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    //console.log(`OTP sent successfully to ${email}:`, info.response); 
    return true;
  } catch (err) {
    console.error('Error sending OTP email:', err); 
    return false;
  }
};

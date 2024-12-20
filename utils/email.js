const createTransporter = require('../configs/emailConfig');

const sendVerificationEmail = async (email, verificationToken) => {
  try {
    const transporter = await createTransporter();
    if (!transporter) throw new Error('Failed to create email transporter');

    const verificationUrl = `${process.env.CLIENT_URL}/verify/${verificationToken}`;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Xác thực tài khoản',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333; text-align: center;">Xác thực tài khoản của bạn</h2>
          <p style="color: #666; font-size: 16px;">Vui lòng click vào link bên dưới để xác thực tài khoản:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #48cae4; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 4px;
                      font-weight: bold;">
              Xác thực tài khoản
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">Nếu button không hoạt động, copy đường dẫn sau: ${verificationUrl}</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Send email error:', error);
    throw error;
  }
};
// backend/utils/email.js

const sendResetPasswordEmail = async (email, resetUrl) => {
  try {
    const transporter = await createTransporter();
    if (!transporter) throw new Error('Failed to create email transporter');

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333; text-align: center;">Đặt lại mật khẩu</h2>
          <p style="color: #666; font-size: 16px;">Bạn nhận được email này vì đã yêu cầu đặt lại mật khẩu. Click vào nút bên dưới để tiếp tục:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #48cae4; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 4px;
                      font-weight: bold;">
              Đặt lại mật khẩu
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">Nếu button không hoạt động, copy đường dẫn sau: ${resetUrl}</p>
          <p style="color: #999; font-size: 14px;">Link này chỉ có hiệu lực trong vòng 10 phút.</p>
          <p style="color: #999; font-size: 14px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Send reset password email error:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
};

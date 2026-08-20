import { env } from "../../../config/env.js";

interface VerificationEmailTemplateInput {
    displayName: string;
    token: string;
}

/**
 * Builds the HTML content for verification email.
 */
export function buildVerificationEmail({ displayName, token }: VerificationEmailTemplateInput) {
    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Xác thực tài khoản KujiLingo</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                    <td align="center" style="background-color: #d32f2f; padding: 30px;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">KujiLingo</h1>
                    </td>
                </tr>
                <!-- Content -->
                <tr>
                    <td style="padding: 40px 30px; color: #333333; line-height: 1.6;">
                        <p style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">Xin chào ${displayName},</p>
                        <p style="margin-bottom: 20px;">Cảm ơn bạn đã đồng hành cùng <strong>KujiLingo</strong>. Để bắt đầu hành trình học tiếng Nhật, vui lòng xác thực email của bạn bằng nút bên dưới:</p>
                        
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                            <tr>
                                <td align="center" style="padding: 20px 0;">
                                    <a href="${verificationUrl}" target="_blank" style="background-color: #d32f2f; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Xác thực tài khoản ngay</a>
                                </td>
                            </tr>
                        </table>
                        
                        <p style="margin-top: 20px;">Hoặc bạn có thể sao chép đường dẫn này và dán vào trình duyệt:</p>
                        <p style="word-break: break-all; font-size: 14px; color: #666; background: #f0f0f0; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
                        
                        <p style="margin-top: 20px; font-size: 14px; color: #888;">Liên kết này sẽ hết hạn trong 24 giờ.</p>
                    </td>
                </tr>
                <!-- Footer -->
                <tr>
                    <td align="center" style="background-color: #f4f4f4; padding: 20px; font-size: 12px; color: #777;">
                        <p>&copy; 2026 KujiLingo. Mọi quyền được bảo lưu.</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const text = `Xin chào ${displayName},\n\nCảm ơn bạn đã đăng ký tài khoản tại KujiLingo. Vui lòng truy cập đường dẫn sau để xác thực email: ${verificationUrl}\n\nLiên kết này sẽ hết hạn trong 24 giờ.`;

    return { html, text };
}

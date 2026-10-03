/**
 * Builds the HTML content for password changed confirmation email.
 */
export function buildPasswordChangedEmail({ displayName }: { displayName: string }) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Mật khẩu của bạn đã được thay đổi</title>
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
                        <p style="margin-bottom: 20px;">Mật khẩu cho tài khoản <strong>KujiLingo</strong> của bạn đã được thay đổi thành công.</p>
                        <p style="margin-bottom: 20px;">Nếu bạn là người thực hiện thay đổi này, bạn không cần làm gì thêm.</p>
                        <p style="margin-top: 20px; font-size: 14px; color: #888; border-top: 1px solid #eee; padding-top: 20px;">
                            Nếu không phải bạn thực hiện thay đổi này, tài khoản của bạn có thể đã bị xâm phạm. Vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi ngay lập tức.
                        </p>
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

    const text = `Xin chào ${displayName},\n\nMật khẩu tài khoản KujiLingo của bạn đã được thay đổi thành công.\n\nNếu không phải bạn thực hiện thay đổi này, vui lòng liên hệ ngay với bộ phận hỗ trợ.`;

    return { html, text };
}

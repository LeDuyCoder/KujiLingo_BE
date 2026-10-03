import "dotenv/config";
import { mailService } from "../src/common/services/mail/mail.service.js";

async function runMailTest() {
    console.log("🚀 Bắt đầu test gửi email thật qua Gmail API...");
    
    // Lấy email người nhận từ biến môi trường hoặc nhập cứng để test
    const recipient = process.env.MAIL_TEST_TO;
    
    if (!recipient) {
        console.error("❌ LỖI: Bạn chưa cung cấp email người nhận.");
        console.error("👉 Vui lòng chạy lệnh: $env:MAIL_TEST_TO='email_cua_ban@gmail.com'; npm run mail:test (trên Windows PowerShell)");
        console.error("👉 Hoặc: MAIL_TEST_TO='email_cua_ban@gmail.com' npm run mail:test (trên Mac/Linux)");
        process.exit(1);
    }

    try {
        await mailService.sendMail({
            to: recipient,
            subject: "[KujiLingo Test] Xác nhận Gmail API hoạt động 🚀",
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #4f46e5;">Chào bạn,</h2>
                    <p>Nếu bạn nhận được email này, có nghĩa là <strong>Gmail API OAuth 2.0</strong> trong backend KujiLingo đã cấu hình thành công!</p>
                    <p>Thông tin test:</p>
                    <ul>
                        <li>Thời gian gửi: ${new Date().toLocaleString("vi-VN")}</li>
                        <li>Trạng thái: Hoạt động hoàn hảo ✅</li>
                    </ul>
                </div>
            `,
            text: "Nếu bạn đọc được tin này, Gmail API đã hoạt động thành công!",
        });
        
        console.log(`✅ THÀNH CÔNG: Đã gửi email test thành công tới ${recipient}!`);
        console.log("👉 Hãy mở hộp thư (có thể kiểm tra cả mục Spam) để xác nhận.");
        process.exit(0);
    } catch (error: any) {
        console.error("❌ THẤT BẠI: Lỗi khi gửi email qua Gmail API:");
        console.error(error.message);
        if (error.originalError) {
            console.error("Chi tiết lỗi từ Google:", error.originalError.message || error.originalError);
        }
        process.exit(1);
    }
}

runMailTest();

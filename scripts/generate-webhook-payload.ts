import "dotenv/config";
import crypto from "node:crypto";
import { PayOS } from "@payos/node";

const checksumKey = process.env.PAYOS_CHECKSUM_KEY || "";
const clientId = process.env.PAYOS_CLIENT_ID || "";
const apiKey = process.env.PAYOS_API_KEY || "";

const orderCode = 7555309317956;
const amount = 129000;
const description = "KujiLingo gems";
const reference = "FT260824_SIMULATE_SUCCESS";

const dataObject: Record<string, any> = {
    amount,
    code: "00",
    description,
    orderCode,
    reference,
};

// Sort keys alphabetically and build query string
const sortedKeys = Object.keys(dataObject).sort();
const queryString = sortedKeys
    .map((key) => {
        let val = dataObject[key];
        if (val === null || val === undefined) val = "";
        return `${key}=${val}`;
    })
    .join("&");

const signature = crypto.createHmac("sha256", checksumKey).update(queryString).digest("hex");

const webhookPayload = {
    code: "00",
    desc: "success",
    success: true,
    data: dataObject,
    signature,
};

console.log("=== GENERATED VALID PAYOS WEBHOOK PAYLOAD FOR POSTMAN ===");
console.log(JSON.stringify(webhookPayload, null, 2));

// Test verification with PayOS SDK
try {
    const payos = new PayOS({ clientId, apiKey, checksumKey });
    const verified = payos.webhooks.verify(webhookPayload);
    console.log("\n✅ PayOS SDK Signature Verification Success:", verified);
} catch (e: any) {
    console.error("\n❌ PayOS SDK Verification Failed:", e.message);
}

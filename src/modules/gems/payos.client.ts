import { PayOS } from "@payos/node";
import { log } from "../../common/utils/log.js";

function getPayOSClient(): PayOS {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
        log.warn("PayOS credentials are missing in process.env!");
        throw new Error("PAYOS_CONFIG_MISSING");
    }

    return new PayOS({
        clientId,
        apiKey,
        checksumKey,
    });
}

export interface CreatePaymentLinkParams {
    orderCode: number;
    amount: number;
    description: string;
    buyerEmail?: string;
    returnUrl: string;
    cancelUrl: string;
    expiredAt: number; // Unix timestamp in seconds
}

export interface CreatePaymentLinkResult {
    checkoutUrl: string;
    qrCode: string;
    paymentLinkId: string;
}

export const payOSAdapter = {
    async createPaymentLink(params: CreatePaymentLinkParams): Promise<CreatePaymentLinkResult> {
        const client = getPayOSClient();

        const payload: any = {
            orderCode: params.orderCode,
            amount: params.amount,
            description: params.description,
            returnUrl: params.returnUrl,
            cancelUrl: params.cancelUrl,
            expiredAt: params.expiredAt,
        };

        if (params.buyerEmail) {
            payload.buyerEmail = params.buyerEmail;
        }

        const response = await client.paymentRequests.create(payload);

        return {
            checkoutUrl: response.checkoutUrl,
            qrCode: response.qrCode,
            paymentLinkId: response.paymentLinkId,
        };
    },

    async verifyWebhook(body: any): Promise<any> {
        const client = getPayOSClient();
        return await client.webhooks.verify(body);
    },

    async getPaymentLinkInfo(paymentLinkId: string): Promise<any> {
        const client = getPayOSClient();
        return await client.paymentRequests.get(paymentLinkId);
    },
};

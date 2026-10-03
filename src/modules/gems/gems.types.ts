export interface GemPackageDTO {
    id: string;
    title: string;
    gem_amount: number;
    bonus_gem: number;
    effective_bonus_gem: number;
    total_gems: number;
    price: number;
    image: string | null;
    is_popular: boolean;
    is_best_value: boolean;
}

export interface GemPromotionDTO {
    id: string;
    title: string;
    bonus_percent: number;
    end_at: string;
}

export interface ActivePromotionDetailDTO {
    id: string;
    title: string;
    description: string | null;
    bonus_percent: number;
    start_at: string;
    end_at: string;
}

export interface ListGemPackagesResponse {
    success: true;
    data: {
        packages: GemPackageDTO[];
        active_promotion: GemPromotionDTO | null;
    };
}

export interface GetActivePromotionResponse {
    success: true;
    data: ActivePromotionDetailDTO | null;
}

export interface CreateTransactionBody {
    package_id: string;
    payment_method?: "PAYOS" | "MOMO";
    buyer_email?: string;
}

export interface TransactionCreatedData {
    transaction_id: string;
    transaction_code: string;
    order_code: number;
    payment_url: string;
    qr_code: string | null;
    amount: number;
    gem_amount: number;
    bonus_gem: number;
    total_gem: number;
    expired_at: string;
}

export interface CreateTransactionResponse {
    success: true;
    data: TransactionCreatedData;
    message: string;
}

export interface PayOSCallbackData {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber?: string;
    reference?: string;
    transactionDateTime?: string;
    currency?: string;
    paymentLinkId?: string;
    code: string;
    desc: string;
    [key: string]: any;
}

export interface PayOSCallbackBody {
    code: string;
    desc: string;
    success: boolean;
    data: PayOSCallbackData;
    signature: string;
}

export interface GetTransactionParams {
    transactionId: string;
}

export interface TransactionStatusData {
    transaction_id: string;
    payment_status: string;
    total_gem: number;
    amount: number;
    paid_at: string | null;
}

export interface GetTransactionStatusResponse {
    success: true;
    data: TransactionStatusData;
}

export interface GetWalletHistoryQuery {
    transaction_type?: "RECHARGE" | "PURCHASE" | "REWARD" | "REFUND" | "ADMIN";
    page?: number;
    limit?: number;
}

export interface WalletHistoryItemDTO {
    id: string;
    transaction_type: string;
    coin_change: number;
    gem_change: number;
    balance_coin: number;
    balance_gem: number;
    note: string | null;
    created_at: string;
}

export interface GetWalletHistoryResponse {
    success: true;
    data: WalletHistoryItemDTO[];
    meta: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

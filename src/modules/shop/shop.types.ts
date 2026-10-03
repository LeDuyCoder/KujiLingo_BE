export interface ShopItemDTO {
    id: string;
    name: string | null;
    description: string | null;
    image: string | null;
    preview_image: string | null;
    item_type: "AVATAR" | "BACKGROUND" | "FRAME" | null;
    rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | null;
    price: number | null;
    currency: "COIN" | "GEM" | null;
    is_limited: boolean | null;
    stock: number | null;
    is_owned: boolean;
}

export interface ShopBannerDTO {
    id: string;
    title: string | null;
    description: string | null;
    image: string | null;
    shop_item_id: string | null;
}

export interface WalletDTO {
    coins: number;
    gems: number;
    updated_at: Date | null;
}

export interface PurchaseItemBody {
    shop_item_id: string;
}

export interface EquipItemBody {
    shop_item_id: string;
}

export interface InventoryItemDTO {
    shop_item_id: string;
    name: string | null;
    item_type: "AVATAR" | "BACKGROUND" | "FRAME" | null;
    image: string | null;
    purchased_at: Date | null;
    is_equipped: boolean;
}

export interface EquippedItemDTO {
    item_type: "AVATAR" | "BACKGROUND" | "FRAME";
    shop_item_id: string | null;
    name: string | null;
    image: string | null;
    equipped_at: Date | null;
}

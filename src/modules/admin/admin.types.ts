export interface AdminUserDTO {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar: string | null;
    level: number | null;
    exp: number | null;
    streak: number | null;
    role: string;
    status: string | null;
    created_at: string;
}

export interface AdminUserDetailDTO extends AdminUserDTO {
    total_reviews: number;
    pvp_matches: number;
    pvp_rating: number;
}

export interface AuditLogDTO {
    id: string;
    admin_id: string;
    admin_name: string;
    action: string;
    entity_id: string | null;
    before_state: any;
    after_state: any;
    created_at: string;
}

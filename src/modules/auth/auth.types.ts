// Các kiểu dữ liệu dành riêng cho module auth
export interface UserResponse {
    id: string;
    email: string;
    display_name: string;
    jlpt_target_level: string | null;
    preferred_language?: "vi" | "en";
    email_verified: boolean;
    created_at: Date;
}

export interface RegisterResponse {
    code: "REGISTER_SUCCESS";
    user: UserResponse;
    verificationToken: string;
}

export interface LoginUserData {
    id: string;
    email: string;
    display_name: string;
    role: string;
    is_premium: boolean;
    jlpt_target_level: string | null;
    avatar_url?: string | null;
}

export interface LoginResponse {
    success: boolean;
    data: {
        access_token: string;
        refresh_token: string;
        token_type: "Bearer";
        expires_in: number; // 900
        user: LoginUserData;
    };
}

export interface CurrentUserResponse {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    role: string;
    is_premium: boolean;
    premium_expires_at: string | null;
    jlpt_target_level: string | null;
    learning_goal_minutes: number | null;
    preferred_language: "vi" | "en";
    status: string;
    email_verified_at: string | null;
    last_login_at: string | null;
    timezone: string;
    locale: string;
    created_at: string;
}


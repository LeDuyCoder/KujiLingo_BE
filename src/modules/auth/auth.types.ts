// Các kiểu dữ liệu dành riêng cho module auth
export interface UserResponse {
    id: string;
    email: string;
    display_name: string;
    jlpt_target_level: string | null;
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


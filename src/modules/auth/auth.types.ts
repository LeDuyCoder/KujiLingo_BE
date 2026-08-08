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

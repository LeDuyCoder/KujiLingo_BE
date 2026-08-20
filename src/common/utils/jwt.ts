import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../../config/env.js";

// Sử dụng keys từ env, hoặc tự tạo key tạm thời (fallback) ở Dev
let privateKey = env.JWT_PRIVATE_KEY;
let publicKey = env.JWT_PUBLIC_KEY;

if (privateKey && !privateKey.includes("-----BEGIN")) {
    privateKey = Buffer.from(privateKey, "base64").toString("utf8");
}
if (publicKey && !publicKey.includes("-----BEGIN")) {
    publicKey = Buffer.from(publicKey, "base64").toString("utf8");
}


if (!privateKey || !publicKey) {
    console.warn("⚠️ JWT_PRIVATE_KEY/PUBLIC_KEY not found in env! Generating temporary keys for development...");
    const { privateKey: tmpPrivate, publicKey: tmpPublic } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
    });
    privateKey = tmpPrivate.export({ type: "pkcs1", format: "pem" }).toString();
    publicKey = tmpPublic.export({ type: "pkcs1", format: "pem" }).toString();
}

export const signToken = (payload: object) => {
    return jwt.sign(payload, privateKey!, { 
        algorithm: "RS256", 
        expiresIn: "15m" 
    });
};

export const verifyToken = (token: string) => {
    return jwt.verify(token, publicKey!, { algorithms: ["RS256"] });
};

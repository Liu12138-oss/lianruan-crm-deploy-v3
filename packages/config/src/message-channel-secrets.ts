import crypto from "node:crypto";

export interface 消息通道密文 {
  cipherText: string;
  nonce: string;
  authTag: string;
}

const 密钥字节数 = 32;

/**
 * 通道凭据使用部署环境中的独立密钥加密。密钥永不进入数据库、日志或接口响应。
 */
export function 校验消息通道配置加密密钥(value: string | undefined): Buffer | undefined {
  if (!value) return undefined;
  const 密钥 = Buffer.from(value, "base64");
  if (密钥.length !== 密钥字节数) {
    throw new Error("MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY 必须是 32 字节的 Base64 值。");
  }
  return 密钥;
}

export function 加密消息通道配置(明文: object, 密钥: Buffer): 消息通道密文 {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", 密钥, nonce);
  const cipherText = Buffer.concat([cipher.update(JSON.stringify(明文), "utf8"), cipher.final()]);
  return {
    cipherText: cipherText.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function 解密消息通道配置<T extends object>(密文: 消息通道密文, 密钥: Buffer): T {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      密钥,
      Buffer.from(密文.nonce, "base64"),
    );
    decipher.setAuthTag(Buffer.from(密文.authTag, "base64"));
    const 明文 = Buffer.concat([
      decipher.update(Buffer.from(密文.cipherText, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const value = JSON.parse(明文);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("格式无效");
    return value as T;
  } catch {
    throw new Error("消息通道密文无法解密，请核对部署加密密钥。");
  }
}

export function 生成消息通道配置加密密钥(): string {
  return crypto.randomBytes(密钥字节数).toString("base64");
}

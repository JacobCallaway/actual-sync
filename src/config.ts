import { readFile, writeFile, chmod } from "fs/promises";
import { parse, stringify } from "yaml";
import { TruelayerConfig } from "./truelayer";
import { ActualConfig } from "./actual";
import { SyncConfig } from "./sync";
import { NtfyConfig } from "./ntfy";
import crypto from "crypto";
import os from "os";

export type AppConfig = {
  actual: ActualConfig;
  truelayer: TruelayerConfig;
  sync: SyncConfig;
  ntfy: NtfyConfig | null;
};

/**
 * Encryption utilities for protecting sensitive credentials
 * Uses AES-256-GCM with a key derived from system identity
 */
const CredentialEncryption = {
  /**
   * Derive encryption key from system hostname/user (homelab-friendly approach)
   * For production, use environment variable: ACTUAL_SYNC_ENCRYPTION_KEY
   */
  getEncryptionKey: (): Buffer => {
    const envKey = process.env.ACTUAL_SYNC_ENCRYPTION_KEY;
    if (envKey) {
      if (envKey.length < 32) {
        throw new Error("ACTUAL_SYNC_ENCRYPTION_KEY must be at least 32 characters");
      }
      return crypto.scryptSync(envKey, "salt", 32);
    }
    // Homelab default: derive from hostname + username
    const systemId = `${os.hostname()}-${os.userInfo().username}`;
    return crypto.scryptSync(systemId, "actual-sync-homelab", 32);
  },

  encrypt: (data: string): string => {
    const key = CredentialEncryption.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);

    return combined.toString("base64");
  },

  decrypt: (encryptedData: string): string => {
    try {
      const key = CredentialEncryption.getEncryptionKey();
      const combined = Buffer.from(encryptedData, "base64");

      const iv = combined.subarray(0, 16);
      const authTag = combined.subarray(16, 32);
      const encrypted = combined.subarray(32);

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error(
        `Failed to decrypt credentials. Possible causes:\n` +
        `1. System hostname/username changed (use ACTUAL_SYNC_ENCRYPTION_KEY env var)\n` +
        `2. Config file was corrupted\n` +
        `3. ACTUAL_SYNC_ENCRYPTION_KEY is incorrect\n\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};

/**
 * Config wrapper that handles encryption/decryption
 */
type EncryptedConfig = Omit<AppConfig, "actual" | "truelayer"> & {
  actual: ActualConfig & { _encrypted?: boolean };
  truelayer: TruelayerConfig & { _encrypted?: boolean };
};

const ENCRYPTION_ENABLED = process.env.ACTUAL_SYNC_DISABLE_ENCRYPTION !== "true";
const DEFAULT_CONFIG: AppConfig = {
  actual: {
    password: "<actual password>",
    syncId: "<sync id from https://..../settings >",
    url: "localhost",
    cacheDir: ".cache/",
  },
  truelayer: {
    redirectUri: "https://console.truelayer.com/redirect-page",
    clientId: "<truelayer app clientID>",
    clientSecret: "<truelayer app secretId>",
    accounts: [],
  },
  sync: {
    map: [],
  },
  ntfy: null,
};

const CONFIG_FILE_NAME = process.env.CONFIG_FILE_PATH ?? ".config.yml";

/**
 * Encrypt sensitive fields in config before saving
 */
const encryptConfigForStorage = (config: AppConfig): EncryptedConfig => {
  if (!ENCRYPTION_ENABLED) {
    return config as EncryptedConfig;
  }

  return {
    ...config,
    actual: {
      ...config.actual,
      password: CredentialEncryption.encrypt(config.actual.password),
      _encrypted: true,
    },
    truelayer: {
      ...config.truelayer,
      clientSecret: CredentialEncryption.encrypt(config.truelayer.clientSecret),
      accounts: config.truelayer.accounts.map((acc) => ({
        ...acc,
        refreshToken: CredentialEncryption.encrypt(acc.refreshToken),
      })),
      _encrypted: true,
    },
  };
};

/**
 * Decrypt sensitive fields in config after loading
 */
const decryptConfigFromStorage = (config: EncryptedConfig): AppConfig => {
  if (!ENCRYPTION_ENABLED || !config.actual._encrypted) {
    return config as AppConfig;
  }

  return {
    ...config,
    actual: {
      ...config.actual,
      password: CredentialEncryption.decrypt(config.actual.password),
    },
    truelayer: {
      ...config.truelayer,
      clientSecret: CredentialEncryption.decrypt(config.truelayer.clientSecret),
      accounts: config.truelayer.accounts.map((acc) => ({
        ...acc,
        refreshToken: CredentialEncryption.decrypt(acc.refreshToken),
      })),
    },
  };
};

export const loadConfig = async (): Promise<AppConfig> => {
  const config: EncryptedConfig = await readFile(CONFIG_FILE_NAME)
    .then((d) => parse(d.toString()))
    .catch(() => DEFAULT_CONFIG);

  // Decrypt if needed
  const decrypted = decryptConfigFromStorage(config);

  // Merge with default
  return {
    actual: { ...DEFAULT_CONFIG.actual, ...decrypted?.actual },
    truelayer: { ...DEFAULT_CONFIG.truelayer, ...decrypted?.truelayer },
    sync: { ...DEFAULT_CONFIG.sync, ...decrypted?.sync },
    ntfy: decrypted?.ntfy,
  };
};

export const createConfig = async () => {
  const encrypted = encryptConfigForStorage(DEFAULT_CONFIG);
  await writeFile(CONFIG_FILE_NAME, stringify(encrypted as AppConfig)).catch((err) =>
    console.error(err),
  );
  // Set restrictive file permissions (owner read/write only)
  await chmod(CONFIG_FILE_NAME, 0o600).catch((err) =>
    console.error("Warning: Could not set config file permissions:", err),
  );
  console.log(`✅ Config file created at ${CONFIG_FILE_NAME}`);
  if (ENCRYPTION_ENABLED) {
    console.log(`   Credentials encrypted using system identity`);
    console.log(
      `   To use custom encryption key, set: export ACTUAL_SYNC_ENCRYPTION_KEY="your-secret-key"`
    );
  }
};

/**
 * Update and persist a single config value (with encryption)
 */
export const updateConfigValue = async (
  updater: (config: AppConfig) => AppConfig
): Promise<void> => {
  const current = await loadConfig();
  const updated = updater(current);
  const encrypted = encryptConfigForStorage(updated);
  await writeFile(CONFIG_FILE_NAME, stringify(encrypted as AppConfig));
  await chmod(CONFIG_FILE_NAME, 0o600).catch((err) =>
    console.error("Warning: Could not set config file permissions:", err),
  );
};

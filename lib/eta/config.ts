import { ApiError } from "@/lib/rbac";

/**
 * ETA credentials and endpoints — from the server environment only. Never hardcoded,
 * never defaulted (a wrong default URL would send real tax documents to the wrong
 * place), never returned by an API: callers get the NAMES of missing variables at most.
 *
 * This module is server-only; nothing under components/ may import it.
 */

export const ETA_ENV_VARS = ["ETA_API_BASE_URL", "ETA_ID_SERVER_URL", "ETA_CLIENT_ID", "ETA_CLIENT_SECRET", "ETA_SIGNER_URL"] as const;

export type EtaConfig = {
  environment: string | null;
  apiBaseUrl: string;
  idServerUrl: string;
  clientId: string;
  clientSecret: string;
  signerUrl: string;
  signerToken: string | null;
};

type Env = Record<string, string | undefined>;

export function etaConfigStatus(env: Env = process.env) {
  const missing = ETA_ENV_VARS.filter((k) => !env[k]?.trim());
  return { configured: missing.length === 0, missing, environment: env.ETA_ENV?.trim() || null };
}

export function loadEtaConfig(env: Env = process.env): EtaConfig {
  const s = etaConfigStatus(env);
  if (!s.configured) throw new ApiError(503, `الربط مع منظومة الفاتورة الإلكترونية مش متظبط على السيرفر (ناقص: ${s.missing.join("، ")})`);
  return {
    environment: s.environment,
    apiBaseUrl: env.ETA_API_BASE_URL!.trim().replace(/\/+$/, ""),
    idServerUrl: env.ETA_ID_SERVER_URL!.trim().replace(/\/+$/, ""),
    clientId: env.ETA_CLIENT_ID!.trim(),
    clientSecret: env.ETA_CLIENT_SECRET!.trim(),
    signerUrl: env.ETA_SIGNER_URL!.trim(),
    signerToken: env.ETA_SIGNER_TOKEN?.trim() || null,
  };
}

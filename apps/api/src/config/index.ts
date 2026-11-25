import { z } from 'zod';

const DEFAULT_MUGLOAR_BASE_URL = 'https://dragonsofmugloar.com/api/v2';
const DEFAULT_MUGLOAR_TIMEOUT_MS = 10_000;
const DEFAULT_MUGLOAR_READ_RETRIES = 2;
const DEFAULT_MUGLOAR_RETRY_BASE_DELAY_MS = 200;
const DEFAULT_MUGLOAR_RATE_PER_SECOND = 8;
const DEFAULT_MUGLOAR_BURST = 8;
const DEFAULT_DATABASE_URL = 'mysql://dragon:dragon@127.0.0.1:3306/dragon';
const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 3000;
const MAX_PORT = 65535;

const LogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const EnvSchema = z.object({
  MUGLOAR_BASE_URL: z.url().default(DEFAULT_MUGLOAR_BASE_URL),
  MUGLOAR_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_MUGLOAR_TIMEOUT_MS),
  MUGLOAR_READ_RETRIES: z.coerce.number().int().min(0).default(DEFAULT_MUGLOAR_READ_RETRIES),
  MUGLOAR_RETRY_BASE_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .default(DEFAULT_MUGLOAR_RETRY_BASE_DELAY_MS),
  MUGLOAR_RATE_PER_SECOND: z.coerce.number().positive().default(DEFAULT_MUGLOAR_RATE_PER_SECOND),
  MUGLOAR_BURST: z.coerce.number().int().positive().default(DEFAULT_MUGLOAR_BURST),
  DATABASE_URL: z.url({ protocol: /^mysql$/ }).default(DEFAULT_DATABASE_URL),
  LOG_LEVEL: LogLevelSchema.default('info'),
  API_HOST: z.string().min(1).default(DEFAULT_API_HOST),
  API_PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_API_PORT),
  WEB_DIST_DIR: z.string().min(1).optional(),
});

export type AppConfig = {
  mugloarBaseUrl: string;
  mugloarTimeoutMs: number;
  mugloarReadRetries: number;
  mugloarRetryBaseDelayMs: number;
  mugloarRatePerSecond: number;
  mugloarBurst: number;
  databaseUrl: string;
  logLevel: z.infer<typeof LogLevelSchema>;
  apiHost: string;
  apiPort: number;
  webDistDir: string | null;
};

export const loadConfig = ({ env }: { env: NodeJS.ProcessEnv }): AppConfig => {
  const parsed = EnvSchema.parse(env);

  return {
    mugloarBaseUrl: parsed.MUGLOAR_BASE_URL,
    mugloarTimeoutMs: parsed.MUGLOAR_TIMEOUT_MS,
    mugloarReadRetries: parsed.MUGLOAR_READ_RETRIES,
    mugloarRetryBaseDelayMs: parsed.MUGLOAR_RETRY_BASE_DELAY_MS,
    mugloarRatePerSecond: parsed.MUGLOAR_RATE_PER_SECOND,
    mugloarBurst: parsed.MUGLOAR_BURST,
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    apiHost: parsed.API_HOST,
    apiPort: parsed.API_PORT,
    webDistDir: parsed.WEB_DIST_DIR ?? null,
  };
};

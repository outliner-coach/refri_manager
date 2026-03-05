import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  ADMIN_ALERT_CHANNEL: z.string().default("#fridge-admin"),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_SHEETS_RANGE: z.string().default("members!A:F"),
  MINIO_ENDPOINT: z.string().default("http://localhost:9000"),
  MINIO_PUBLIC_ENDPOINT: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional()
  ),
  MINIO_PUBLIC_PORT: z.coerce.number().default(9100),
  MINIO_REGION: z.string().default("us-east-1"),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("refri-assets"),
  MINIO_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  APP_TIMEZONE: z.string().default("Asia/Seoul"),
  MONTHLY_BUDGET_KRW: z.coerce.number().default(50000)
});

export type AppEnv = z.infer<typeof EnvSchema>;

export const env = EnvSchema.parse(process.env);

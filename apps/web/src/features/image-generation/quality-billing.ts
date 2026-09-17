/**
 * 后端质量计价倍率（纯函数，DB-free）。
 *
 * 同一个后端（池 API / ChatGPT 账号）服务不同 quality 的请求，实际成本差异
 * 很大（高清档上游消耗远高于低清）。本模块把「quality → 计费倍率」做成
 * 每个后端可配的表，在 operations.ts 折入总倍率：
 *
 *   billingMultiplier = 后端池倍率 × 模型族倍率 × 质量倍率(本模块)
 *
 * 使用方：image-generation/operations.ts（计费折算）、image-backend-pool
 * service/actions（存取与清洗）、后台表单编辑器。
 */
export const QUALITY_BILLING_LEVELS = [
  "auto",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type QualityBillingLevel = (typeof QUALITY_BILLING_LEVELS)[number];

/** 每后端的质量倍率表；未配置的档位视为 1。 */
export type QualityBillingConfig = Partial<
  Record<QualityBillingLevel, number>
>;

const LEVEL_SET = new Set<string>(QUALITY_BILLING_LEVELS);

/** 与 operations.ts normalizeBillingMultiplier 同口径：正值、[0.01, 100]、两位小数。 */
const MIN_QUALITY_BILLING_MULTIPLIER = 0.01;
const MAX_QUALITY_BILLING_MULTIPLIER = 100;

function sanitizeMultiplier(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return (
    Math.round(
      Math.min(
        MAX_QUALITY_BILLING_MULTIPLIER,
        Math.max(MIN_QUALITY_BILLING_MULTIPLIER, parsed)
      ) * 100
    ) / 100
  );
}

function normalizeLevel(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * 把任意输入（DB json / 表单对象）清洗成合法倍率表：只保留合法档位的合法
 * 数值，非法键值丢弃。不删除值为 1 的档位（保留管理员显式意图）。
 */
export function parseQualityBilling(value: unknown): QualityBillingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: QualityBillingConfig = {};
  for (const [rawLevel, rawMultiplier] of Object.entries(
    value as Record<string, unknown>
  )) {
    const level = normalizeLevel(rawLevel);
    if (!LEVEL_SET.has(level)) continue;
    const multiplier = sanitizeMultiplier(rawMultiplier);
    if (multiplier === null) continue;
    out[level as QualityBillingLevel] = multiplier;
  }
  return out;
}

/**
 * 供入库前收紧：清洗后去掉空值；全空（或全为无效值）返回 null，与
 * model_mapping 的存储约定一致（null = 未配置，走默认 1 倍）。
 */
export function normalizeQualityBillingForStorage(
  value: unknown
): QualityBillingConfig | null {
  const parsed = parseQualityBilling(value);
  const levels = Object.keys(parsed) as QualityBillingLevel[];
  if (!levels.length) return null;
  return parsed;
}

/**
 * 解析某次请求的质量倍率：
 * - 未配置 / 请求未带 quality（或值非法）→ 1，不改变既有计费；
 * - 精确命中档位（大小写不敏感）→ 该档倍率；
 * - xhigh / max 未单独配置时回退 high 档（上游对 xhigh/max 按 high 处理，
 *   出站前也会归并成 high，见 api-model-mapping.ts qualityBucket）；
 * - auto 不做任何回退：auto 是独立档位，由管理员显式定价。
 */
export function resolveQualityBillingMultiplier(
  config: unknown,
  quality: string | null | undefined
): number {
  const parsed = parseQualityBilling(config);
  const levels = Object.keys(parsed) as QualityBillingLevel[];
  if (!levels.length) return 1;
  const requested = normalizeLevel(String(quality || ""));
  if (!requested || !LEVEL_SET.has(requested)) return 1;
  const exact = parsed[requested as QualityBillingLevel];
  if (typeof exact === "number") return exact;
  if (requested === "xhigh" || requested === "max") {
    const high = parsed.high;
    if (typeof high === "number") return high;
  }
  return 1;
}

/**
 * 质量计价倍率编辑器：quality 档位 → 计费倍率，每后端（池 API / 账号）独立配置。
 * 值为字符串表单态（空串 = 未配置，计 1 倍）；提交方负责转数值并过滤非法输入。
 */
"use client";

import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { QUALITY_BILLING_LEVELS } from "@/features/image-generation/quality-billing";

/** 档位显示名：auto 不回退其他档；xhigh/max 未单独配置时按 high 计。 */
const LEVEL_LABELS: Record<(typeof QUALITY_BILLING_LEVELS)[number], string> = {
  auto: "自动 (auto)",
  low: "低 (low)",
  medium: "中 (medium)",
  high: "高 (high)",
  xhigh: "超高 (xhigh)",
  max: "最高 (max)",
};

/** 表单态：档位 → 输入框字符串。空串表示未配置。 */
export type QualityBillingFormValue = Partial<
  Record<(typeof QUALITY_BILLING_LEVELS)[number], string>
>;

export function emptyQualityBillingForm(): QualityBillingFormValue {
  return {};
}

/** 把 DB/列表返回的倍率表回填成表单态。 */
export function qualityBillingToForm(
  value: Partial<Record<string, number>> | null | undefined
): QualityBillingFormValue {
  const form: QualityBillingFormValue = {};
  if (!value) return form;
  for (const level of QUALITY_BILLING_LEVELS) {
    const multiplier = value[level];
    if (typeof multiplier === "number" && Number.isFinite(multiplier)) {
      form[level] = String(multiplier);
    }
  }
  return form;
}

/**
 * 表单态 → 提交值：合法正数（两位小数内由后端收敛）才保留；全空返回 null
 * （清空配置，全部按 1 倍计）。
 */
export function qualityBillingFromForm(
  form: QualityBillingFormValue
): Partial<Record<string, number>> | null {
  const out: Partial<Record<string, number>> = {};
  for (const level of QUALITY_BILLING_LEVELS) {
    const raw = (form[level] || "").trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    out[level] = parsed;
  }
  return Object.keys(out).length ? out : null;
}

export function QualityBillingEditor(props: {
  value: QualityBillingFormValue;
  onChange: (next: QualityBillingFormValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">质量计价倍率</Label>
      <p className="text-muted-foreground text-xs">
        按请求质量对图像积分与对话轮次再乘一个倍率（与分组/成员倍率相乘）。
        留空档位计 1 倍；xhigh/max 未单独配置时按高 (high) 档倍率计。
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUALITY_BILLING_LEVELS.map((level) => (
          <div key={level} className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {LEVEL_LABELS[level]}
            </Label>
            <Input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              placeholder="1"
              disabled={props.disabled}
              value={props.value[level] || ""}
              onChange={(event) =>
                props.onChange({ ...props.value, [level]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

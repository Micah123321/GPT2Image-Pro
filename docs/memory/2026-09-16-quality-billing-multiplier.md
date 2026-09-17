# 2026-09-16 后端质量计价倍率

## 背景

此前计价与请求 `quality` 无关（`resolution.ts` 的 `QUALITY_MULTIPLIER` 恒 1，
2026-05 安全三轮曾加全局质量倍率后又回退为 1）。但同一后端服务不同质量的请求
上游成本差异大（高清远贵于低清），需要**每个后端独立**配置质量倍率，且
ChatGPT 账号（web / codex 车道）也要支持。

## 设计

- 数据模型：`image_backend_api.quality_billing` 与 `image_backend_account.quality_billing`
  （json，迁移 `0048_quality_billing_multiplier.sql`），形如
  `{"high": 2, "low": 0.5, "auto": 1.5}`。未配置档位计 1 倍。
- 纯函数模块：`apps/web/src/features/image-generation/quality-billing.ts`（DB-free）
  — `parseQualityBilling`（清洗：合法档位 + 正数夹取 [0.01,100] 两位小数）、
  `normalizeQualityBillingForStorage`（空表收敛 null）、
  `resolveQualityBillingMultiplier`（解析）。
- 解析规则：按**用户请求的 quality**（默认 auto，大小写不敏感）精确命中；
  `xhigh`/`max` 未单独配置时回退 `high`（上游对二者按 high 处理、出站也归并
  high）；`auto` 不回退任何档位；未配置/非法 → 1。
- 计费折入：`operations.ts` 总倍率 = 池倍率(组×成员) × 模型族倍率 × 质量倍率，
  单点折入 `billingMultiplier` 变量，向下贯通预扣/chat 轮次/成功结算/退款/元数据，
  退款口径天然一致。`billingMetadata` 额外留痕 `qualityBillingMultiplier` 与
  `requestedQuality` 便于对账。
- 计价口径：**按请求 quality**，不按 model_mapping 改写后的出站 quality
  （改写属路由层行为，不回灌计价）。质量倍率同样作用于 chat 轮次积分
  （chatRoundCredits 也乘 billingMultiplier）。
- 配置入口：后台「账号池」账号表单（web/codex 通用）与「API 后端」表单，共享
  编辑器 `image-backend-pool/quality-billing-editor.tsx`（6 档输入，空=1）。
  Adobe（pool-adobe / image_backend_adobe）暂未纳入，如需可照 api 分支扩展。
- 内部链路保护：`upsertImageBackendApi/Account` 仅在显式传入 `qualityBilling`
  时写库（sub2api 同步、注册机产号、换 token 等链路不带该字段，不覆盖原值）。

## 验证

- 单测 `quality-billing.test.ts`（清洗/收敛/解析/回退）；
- `turbo typecheck` / `turbo lint`（无 error）/ `turbo test`（838 通过）。

## 部署

含迁移 0048（纯加列、IF NOT EXISTS，向后兼容），须**先迁移后切流**（蓝绿
runbook 纪律）。旧行为不变：未配置任何档位 = 全部 1 倍。

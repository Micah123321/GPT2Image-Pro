# 2026-09-16 API 模型映射

为对接 [g-aisc.xyz 图片 API](https://g-aisc.xyz/docs/) 增加每条 API 的本站型号 → 上游型号映射。

- 列：`image_backend_api.model_mapping`、`user_api_config.model_mapping`（json 数组）。
- 规则：`from` / `to`，可选 `whenQuality`、`setQuality`。2.5 变体与 firefly 家族会展开匹配；`xhigh`/`max` 视为 high。
- 预设：Adobe 渠道（`gpt-image-2*` → `gpt-image-2-ad`，high → `gpt-image-2-high` + `quality=high`）；Gemini 渠道（nano-banana* → `gemini-*-ad`）。
- Gemini 两个 id 不能走 `/v1/images/*`，该 API 的 Images 上游需设 Responses 或对话。
- 单字段 `model` 仍只作缺省，不再承担改写。

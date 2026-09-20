# 2026-09-20 chatgpt-web-proxy 多上游出口池

## 背景

ChatGPT Web 车道经单一 WARP 出口访问 chatgpt.com，2026-09-18 Cloudflare 突然
拉黑该出口 IP（EOF 风暴：378 单生成 20 分钟超时，全额退款）。单点出口是结构性
风险；此前用 fiber 上的 bash/systemd 切换器（`warp-upstream-switcher`）应急，
但它是部署专属脚本，不适合产品化。

## 设计

- `services/chatgpt-web-proxy/upstream.go`：进程内上游池。`CHATGPT_WEB_UPSTREAM_POOL`
  配逗号分隔的 socks5 上游（按优先级），后台每 60s 用**真实 TLS 指纹**（与业务
  请求同 profile）经各上游 GET 探测目标（默认 chatgpt.com），任意 HTTP 状态码
  =健康，传输层错误=中毒；active 连续 3 次失败且备胎健康即切换。
- 切换时整体作废：会话 tls-client（绑建连时出口）与全局 cf_clearance（绑出口
  IP+UA）都会随出口失效，`onSwitch` 回调清理，杜绝残留旧出口连接。
- 探测**全池**（不只 active）：/healthz 状态新鲜，切换时无需现探备胎。
- 向后兼容：未配 POOL 时回落 `CHATGPT_WEB_UPSTREAM_PROXY_URL`（单项池）；
  都不配直连，行为与旧版一致。`CHATGPT_WEB_CLEARANCE_PROXY_URL` 未显式配置时
  跟随池当前 active（原来固定为启动时单上游）。
- 配置面：docker-compose 透传 + `.env.docker.example` 文档化。上游出口是部署
  拓扑属性，放环境变量；不进 app 的系统设置（app 不感知 sidecar 拓扑）。
- `/healthz` 返回 `upstreams[]`（url 脱敏、active/healthy/failures/lastError）。

## 验证

- `go build/vet/test` 全绿（upstream_test.go：解析清洗、故障转移状态机、
  全坏保持、单项池不切、恢复清零、凭据脱敏）。
- fiber 实测：池=fiber-warp(104.28.192.157) + racknerd-warp(104.28.227.110)，
  /healthz 两项 healthy。

## 部署注意（fiber）

切换到池模式后，旧 bash 切换器 `warp-upstream-switcher.service` 必须停用
（否则它会把容器重建回单上游配置）。racknerd 侧 warp 容器（bridge 网络 +
socat hostNetwork 中继 1080）与防火墙白名单见 fiber/racknerd 运维记录。

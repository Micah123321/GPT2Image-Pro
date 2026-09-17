/**
 * 后端质量计价倍率：清洗、入库收敛、按请求 quality 解析。
 */
import { describe, expect, it } from "vitest";

import {
  normalizeQualityBillingForStorage,
  parseQualityBilling,
  resolveQualityBillingMultiplier,
} from "./quality-billing";

describe("parseQualityBilling", () => {
  it("只保留合法档位与合法数值", () => {
    expect(
      parseQualityBilling({
        high: 2,
        low: "0.5",
        medium: -1,
        auto: "abc",
        unknown: 3,
        max: 0,
      })
    ).toEqual({ high: 2, low: 0.5 });
    expect(parseQualityBilling(null)).toEqual({});
    expect(parseQualityBilling("high")).toEqual({});
    expect(parseQualityBilling([1, 2])).toEqual({});
  });

  it("数值夹取到 [0.01, 100] 并保留两位小数", () => {
    expect(parseQualityBilling({ high: 999 })).toEqual({ high: 100 });
    expect(parseQualityBilling({ high: 0.0001 })).toEqual({ high: 0.01 });
    expect(parseQualityBilling({ high: 1.23456 })).toEqual({ high: 1.23 });
    expect(parseQualityBilling({ HIGH: 2 })).toEqual({ high: 2 });
  });
});

describe("normalizeQualityBillingForStorage", () => {
  it("全空收敛为 null，其余保留清洗结果", () => {
    expect(normalizeQualityBillingForStorage(undefined)).toBeNull();
    expect(normalizeQualityBillingForStorage({ high: "x" })).toBeNull();
    expect(
      normalizeQualityBillingForStorage({ high: 2, extra: 1 })
    ).toEqual({ high: 2 });
  });
});

describe("resolveQualityBillingMultiplier", () => {
  it("未配置或未带 quality 时恒为 1", () => {
    expect(resolveQualityBillingMultiplier(null, "high")).toBe(1);
    expect(resolveQualityBillingMultiplier({}, "high")).toBe(1);
    expect(resolveQualityBillingMultiplier({ high: 2 }, undefined)).toBe(1);
    expect(resolveQualityBillingMultiplier({ high: 2 }, "")).toBe(1);
    expect(resolveQualityBillingMultiplier({ high: 2 }, "nope")).toBe(1);
  });

  it("精确命中档位（大小写不敏感）", () => {
    const config = { auto: 1.5, low: 0.5, medium: 1, high: 2 };
    expect(resolveQualityBillingMultiplier(config, "high")).toBe(2);
    expect(resolveQualityBillingMultiplier(config, "HIGH")).toBe(2);
    expect(resolveQualityBillingMultiplier(config, "auto")).toBe(1.5);
    expect(resolveQualityBillingMultiplier(config, "low")).toBe(0.5);
    expect(resolveQualityBillingMultiplier(config, "medium")).toBe(1);
  });

  it("xhigh/max 未单独配置时回退 high，单独配置时优先精确档", () => {
    expect(resolveQualityBillingMultiplier({ high: 2 }, "xhigh")).toBe(2);
    expect(resolveQualityBillingMultiplier({ high: 2 }, "max")).toBe(2);
    expect(
      resolveQualityBillingMultiplier({ high: 2, xhigh: 3 }, "xhigh")
    ).toBe(3);
    expect(resolveQualityBillingMultiplier({ low: 0.5 }, "xhigh")).toBe(1);
  });

  it("auto 不回退其他档位", () => {
    expect(resolveQualityBillingMultiplier({ high: 2 }, "auto")).toBe(1);
    expect(resolveQualityBillingMultiplier({ high: 2, auto: 1.2 }, "auto")).toBe(
      1.2
    );
  });
});

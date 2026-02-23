import { describe, expect, it } from "vitest";
import { formatINR, formatINRFull, formatINRCompact } from "@/lib/format-currency";

describe("formatINR", () => {
  describe("amounts below 1 lakh", () => {
    it("formats zero", () => {
      expect(formatINR(0)).toBe("0");
    });

    it("formats small numbers", () => {
      expect(formatINR(1000)).toBe("1,000");
      expect(formatINR(45000)).toBe("45,000");
      expect(formatINR(99999)).toBe("99,999");
    });
  });

  describe("amounts in lakhs (1,00,000 - 9,99,99,999)", () => {
    it("formats 1 lakh exactly", () => {
      expect(formatINR(100000)).toBe("1.00 L");
    });

    it("formats 1.5 lakhs", () => {
      expect(formatINR(150000)).toBe("1.50 L");
    });

    it("formats 25 lakhs", () => {
      expect(formatINR(2500000)).toBe("25.00 L");
    });

    it("formats amounts just below 1 crore", () => {
      expect(formatINR(9999999)).toBe("100.00 L");
    });
  });

  describe("amounts in crores (>= 1,00,00,000)", () => {
    it("formats 1 crore exactly", () => {
      expect(formatINR(10000000)).toBe("1.00 Cr");
    });

    it("formats 5 crores", () => {
      expect(formatINR(50000000)).toBe("5.00 Cr");
    });

    it("formats fractional crores", () => {
      expect(formatINR(12345678)).toBe("1.23 Cr");
    });
  });

  describe("negative amounts", () => {
    it("handles negative lakhs", () => {
      expect(formatINR(-250000)).toBe("-2.50 L");
    });

    it("handles negative crores", () => {
      expect(formatINR(-50000000)).toBe("-5.00 Cr");
    });

    it("handles negative small amounts", () => {
      expect(formatINR(-5000)).toBe("-5,000");
    });
  });
});

describe("formatINRFull", () => {
  it("formats zero", () => {
    expect(formatINRFull(0)).toBe("₹0");
  });

  it("formats with ₹ prefix", () => {
    const result = formatINRFull(100000);
    expect(result).toMatch(/^₹/);
  });

  it("formats negative amounts", () => {
    const result = formatINRFull(-100000);
    expect(result).toMatch(/^-₹/);
  });
});

describe("formatINRCompact", () => {
  it("adds ₹ prefix", () => {
    expect(formatINRCompact(100000)).toBe("₹1.00 L");
  });
});

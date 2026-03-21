import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyDisplay } from "@/components/shared/currency-display";

describe("CurrencyDisplay", () => {
  it("displays formatted INR amount", () => {
    render(<CurrencyDisplay amount={1000000} />);
    expect(screen.getByText("₹10.00 L")).toBeDefined();
  });

  it("uses pre-formatted string when provided", () => {
    render(<CurrencyDisplay amount={5000000} formatted="₹50.00 L" />);
    expect(screen.getByText("₹50.00 L")).toBeDefined();
  });

  it("shows + prefix for positive amounts with showSign", () => {
    render(<CurrencyDisplay amount={100000} showSign />);
    const el = screen.getByText(/\+/);
    expect(el).toBeDefined();
  });

  it("shows no + prefix for positive amounts without showSign", () => {
    render(<CurrencyDisplay amount={100000} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("applies red color class for negative amounts", () => {
    const { container } = render(<CurrencyDisplay amount={-100000} />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-red-600");
  });

  it("applies green color class for positive amounts with showSign", () => {
    const { container } = render(<CurrencyDisplay amount={100000} showSign />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-green-600");
  });

  it("does not apply color class for positive amounts without showSign", () => {
    const { container } = render(<CurrencyDisplay amount={100000} />);
    const span = container.querySelector("span");
    expect(span?.className).not.toContain("text-green");
    expect(span?.className).not.toContain("text-red");
  });
});

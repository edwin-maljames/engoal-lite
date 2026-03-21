import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RAGBadge } from "@/components/shared/rag-badge";

describe("RAGBadge", () => {
  it('renders "On Track" for green status', () => {
    render(<RAGBadge status="green" />);
    expect(screen.getByText("On Track")).toBeDefined();
  });

  it('renders "Slightly Behind" for amber status', () => {
    render(<RAGBadge status="amber" />);
    expect(screen.getByText("Slightly Behind")).toBeDefined();
  });

  it('renders "Significantly Behind" for red status', () => {
    render(<RAGBadge status="red" />);
    expect(screen.getByText("Significantly Behind")).toBeDefined();
  });

  it('renders "Not Started" for not_started status', () => {
    render(<RAGBadge status="not_started" />);
    expect(screen.getByText("Not Started")).toBeDefined();
  });

  it("shows progress percentage when provided", () => {
    render(<RAGBadge status="green" progressPct={104.6} />);
    expect(screen.getByText("(104.6%)")).toBeDefined();
  });

  it("does not show progress when not provided", () => {
    render(<RAGBadge status="green" />);
    expect(screen.queryByText(/\d+\.\d+%/)).toBeNull();
  });

  it("applies size classes correctly", () => {
    const { container: sm } = render(<RAGBadge status="green" size="sm" />);
    expect(sm.firstChild).toBeDefined();

    const { container: lg } = render(<RAGBadge status="green" size="lg" />);
    expect(lg.firstChild).toBeDefined();
  });
});

/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MeterHealthBadge } from "./MeterHealthBadge.jsx";

describe("MeterHealthBadge", () => {
  it("renders a button for default ok health", () => {
    render(<MeterHealthBadge />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("renders ok state label", () => {
    render(<MeterHealthBadge health="ok" />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("OK");
  });

  it("renders degraded state label", () => {
    render(<MeterHealthBadge health="degraded" />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Degraded");
  });

  it("renders stopped state label", () => {
    render(<MeterHealthBadge health="stopped" />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Stopped");
  });

  it("renders error state label", () => {
    render(<MeterHealthBadge health="error" />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Error");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<MeterHealthBadge health="ok" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("falls back to ok for unknown health value", () => {
    render(<MeterHealthBadge health="unknown-value" />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("OK");
  });
});

/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpPopover } from "./HelpPopover.jsx";

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("HelpPopover", () => {
  it("renders the trigger button", () => {
    render(<HelpPopover items={["Scroll wheel to zoom"]} />);
    expect(screen.getByRole("button", { name: /shortcuts/i })).toBeTruthy();
  });

  it("popover content is not visible before trigger click", () => {
    render(<HelpPopover items={["Scroll wheel to zoom"]} />);
    expect(screen.queryByText("Scroll wheel to zoom")).toBeNull();
  });

  it("shows item text after trigger click", () => {
    render(<HelpPopover items={["Scroll wheel to zoom"]} />);
    fireEvent.click(screen.getByRole("button", { name: /shortcuts/i }));
    expect(screen.getByText("Scroll wheel to zoom")).toBeTruthy();
  });

  it("renders multiple items", () => {
    render(<HelpPopover items={["Left click to select", "Right click to pan"]} />);
    fireEvent.click(screen.getByRole("button", { name: /shortcuts/i }));
    expect(screen.getByText("Left click to select")).toBeTruthy();
    expect(screen.getByText("Right click to pan")).toBeTruthy();
  });

  it("renders an empty list without error", () => {
    render(<HelpPopover items={[]} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });
});

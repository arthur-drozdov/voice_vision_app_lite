import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import GlassContainer from "@/components/GlassContainer";

describe("GlassContainer", () => {
  it("renders children correctly", () => {
    render(<GlassContainer>Hello Glass</GlassContainer>);
    expect(screen.getByText("Hello Glass")).toBeInTheDocument();
  });

  it("applies dark variant styles by default", () => {
    const { container } = render(<GlassContainer>Content</GlassContainer>);
    const el = container.firstChild as HTMLElement;
    expect(el.dataset.glassVariant).toBe("dark");
    expect(el.style.backdropFilter).toBe("blur(10px)");
    expect(el.style.background).toContain("rgba(10, 12, 15");
  });

  it("applies bright variant styles when specified", () => {
    const { container } = render(
      <GlassContainer variant="bright">Content</GlassContainer>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.dataset.glassVariant).toBe("bright");
    expect(el.style.backdropFilter).toBe("blur(8px)");
    expect(el.style.background).toContain("rgba(255, 255, 255");
  });

  it("applies size classes correctly", () => {
    const { container: sm } = render(
      <GlassContainer size="sm">Small</GlassContainer>
    );
    expect((sm.firstChild as HTMLElement).className).toContain("px-3");
    expect((sm.firstChild as HTMLElement).className).toContain("py-2");

    const { container: lg } = render(
      <GlassContainer size="lg">Large</GlassContainer>
    );
    expect((lg.firstChild as HTMLElement).className).toContain("px-6");
    expect((lg.firstChild as HTMLElement).className).toContain("py-5");
  });

  it("passes through className prop", () => {
    const { container } = render(
      <GlassContainer className="my-custom-class">Content</GlassContainer>
    );
    expect((container.firstChild as HTMLElement).className).toContain("my-custom-class");
  });

  it("passes through onClick handler", () => {
    let clicked = false;
    const { container } = render(
      <GlassContainer onClick={() => (clicked = true)}>Clickable</GlassContainer>
    );
    (container.firstChild as HTMLElement).click();
    expect(clicked).toBe(true);
  });
});

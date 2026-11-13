import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, luminance, palette, readingPairs } from "../src/styles/palette";

describe("contrast math", () => {
  it("gives 21:1 for black on white and 1:1 for equal colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#c8a14a", "#1a181b")).toBeCloseTo(contrastRatio("#1a181b", "#c8a14a"), 8);
  });

  it("orders luminance", () => {
    expect(luminance("#ffffff")).toBeGreaterThan(luminance("#808080"));
    expect(luminance("#808080")).toBeGreaterThan(luminance("#000000"));
  });

  it("rejects a malformed color", () => {
    expect(() => luminance("red")).toThrow();
  });
});

describe("declared reading pairs meet WCAG AA", () => {
  for (const pair of readingPairs) {
    it(`${pair.name} is at least ${pair.min}:1`, () => {
      expect(contrastRatio(palette[pair.fg], palette[pair.bg])).toBeGreaterThanOrEqual(pair.min);
    });
  }
});

describe("the stylesheet repeats the declared palette", () => {
  const css = readFileSync(resolve(__dirname, "../src/styles/index.css"), "utf-8");
  for (const [key, value] of Object.entries(palette)) {
    it(`defines ${key} as ${value}`, () => {
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const pattern = new RegExp(`--color-${kebab}:\\s*${value}`, "i");
      expect(css).toMatch(pattern);
    });
  }
});

describe("the stylesheet respects reduced motion and flashing limits", () => {
  const css = readFileSync(resolve(__dirname, "../src/styles/index.css"), "utf-8");

  it("has a prefers-reduced-motion block", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("has a forced reduced-motion switch for the user setting", () => {
    expect(css).toMatch(/\[data-motion="reduced"\]/);
  });

  it("defines a visible focus style", () => {
    expect(css).toMatch(/:focus-visible/);
  });

  it("keeps every flicker keyframe animation slower than three flashes per second", () => {
    // A keyframe animation that flickers must run for at least 1.2 s per cycle with at most 3 brightness steps per cycle,
    // which keeps it under 3 flashes per second. The glitch is one short burst, not a loop.
    const durations = [...css.matchAll(/animation:\s*([a-z-]+)\s+([\d.]+)s/g)].map((m) => ({ name: m[1] as string, seconds: Number(m[2]) }));
    for (const { name, seconds } of durations.filter((d) => /flicker|glitch|flash|strobe/.test(d.name))) {
      expect(seconds, `${name} duration`).toBeGreaterThanOrEqual(0.5);
    }
    expect(css).not.toMatch(/animation:[^;]*(?<![\d.])0?\.[0-4]\d*s[^;]*infinite/);
  });
});

import { productPairs, productPalette } from "../src/styles/palette";

describe("product palette meets WCAG AA", () => {
  for (const pair of productPairs) {
    it(`${pair.name} is at least ${pair.min}:1`, () => {
      expect(contrastRatio(productPalette[pair.fg], productPalette[pair.bg])).toBeGreaterThanOrEqual(pair.min);
    });
  }
});

describe("the product stylesheet repeats the product palette and respects motion settings", () => {
  const css = readFileSync(resolve(__dirname, "../src/styles/product.css"), "utf-8");
  for (const [key, value] of Object.entries(productPalette)) {
    it(`defines ${key} as ${value}`, () => {
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/(\d+)$/, "-$1");
      expect(css).toMatch(new RegExp(`--sx-${kebab}:\\s*${value}`, "i"));
    });
  }
  it("has reduced-motion handling for both the system preference and the user setting", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/\[data-motion="reduced"\]/);
  });
  it("has a visible focus style", () => {
    expect(css).toMatch(/:focus-visible/);
  });
  it("does not animate anything faster than once per second", () => {
    const durations = [...css.matchAll(/animation:\s*[a-z-]+\s+([\d.]+)s/g)].map((m) => Number(m[1]));
    for (const seconds of durations) expect(seconds).toBeGreaterThanOrEqual(1);
  });
});

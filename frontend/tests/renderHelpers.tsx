/**
 * Minimal DOM test helpers built on React's own APIs, so no testing-library dependency is needed.
 *
 * `render` mounts a tree into document.body inside act. `cleanup` unmounts every mounted tree. The query helpers read the
 * real DOM, and the interaction helpers dispatch real DOM events inside act.
 */

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// React expects this flag when act is used outside a test renderer.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Mounted {
  root: Root;
  container: HTMLElement;
}

const mounted: Mounted[] = [];

export async function render(element: ReactElement): Promise<{ container: HTMLElement; rerender: (next: ReactElement) => Promise<void>; unmount: () => Promise<void> }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    rerender: async (next) => {
      await act(async () => {
        root.render(next);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      const index = mounted.findIndex((entry) => entry.root === root);
      if (index >= 0) mounted.splice(index, 1);
    },
  };
}

export function cleanup(): void {
  for (const entry of mounted.splice(0)) {
    try {
      act(() => {
        entry.root.unmount();
      });
    } catch {
      // A tree that already unmounted during the test is fine.
    }
    entry.container.remove();
  }
  document.body.innerHTML = "";
}

export function byRole(role: string, name?: string | RegExp, scope: ParentNode = document): HTMLElement | null {
  const wanted = (element: Element): boolean => {
    if (name === undefined) return true;
    const label = accessibleName(element);
    return typeof name === "string" ? label === name : name.test(label);
  };
  const implicit: Record<string, string> = {
    button: "button, [role=button]",
    textbox: "input:not([type]), input[type=text], textarea, [role=textbox]",
    heading: "h1, h2, h3, h4, [role=heading]",
    link: "a[href], [role=link]",
    checkbox: "input[type=checkbox], [role=checkbox]",
    slider: "input[type=range], [role=slider]",
    status: "[role=status], output",
    alert: "[role=alert]",
    group: "fieldset, [role=group]",
    region: "section[aria-label], [role=region]",
    img: "img, [role=img]",
    radio: "input[type=radio], [role=radio]",
    main: "main, [role=main]",
    dialog: "dialog, [role=dialog]",
  };
  const selector = implicit[role] ?? `[role=${role}]`;
  return (Array.from(scope.querySelectorAll(selector)).find(wanted) as HTMLElement | undefined) ?? null;
}

export function allByRole(role: string, scope: ParentNode = document): HTMLElement[] {
  const found: HTMLElement[] = [];
  const implicit: Record<string, string> = {
    button: "button, [role=button]",
    link: "a[href], [role=link]",
    heading: "h1, h2, h3, h4, [role=heading]",
    listitem: "li, [role=listitem]",
    article: "article, [role=article]",
    status: "[role=status], output",
    alert: "[role=alert]",
  };
  const selector = implicit[role] ?? `[role=${role}]`;
  scope.querySelectorAll(selector).forEach((element) => found.push(element as HTMLElement));
  return found;
}

export function accessibleName(element: Element): string {
  const labelled = element.getAttribute("aria-labelledby");
  if (labelled) {
    return labelled
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
      .trim();
  }
  const aria = element.getAttribute("aria-label");
  if (aria) return aria.trim();
  const id = element.getAttribute("id");
  if (id) {
    // useId values contain characters that are awkward in selectors, so labels are matched by property.
    const label = Array.from(document.querySelectorAll("label")).find((candidate) => candidate.htmlFor === id);
    if (label) return label.textContent?.trim() ?? "";
  }
  const wrapping = element.closest("label");
  if (wrapping) return wrapping.textContent?.trim() ?? "";
  return element.textContent?.trim() ?? "";
}

export function text(scope: ParentNode = document): string {
  return (scope as HTMLElement).textContent ?? "";
}

export async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

export async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function pressKey(element: Element | Document | Window, key: string, init: KeyboardEventInit = {}): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true, ...init }));
  });
}

/** Run pending timers, effects, and promise callbacks inside act. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

export { act };

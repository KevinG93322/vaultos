import { afterEach, describe, expect, it } from "vitest";

import { readInjectedProvider, type Eip1193Provider } from "@/components/console/wallet";

type MockProvider = Eip1193Provider & { label?: string };

function install(ethereum: MockProvider | undefined) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { ethereum },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("injected wallet selection", () => {
  it("returns null when the page has no injected provider", () => {
    install(undefined);
    expect(readInjectedProvider()).toBeNull();
  });

  it("uses the single injected provider", () => {
    const provider: MockProvider = { label: "browser", request: async () => [] };
    install(provider);
    expect(readInjectedProvider()).toBe(provider);
  });

  it("prefers MetaMask when several wallets inject a provider", () => {
    const other: MockProvider = { label: "other", request: async () => [] };
    const metaMask: MockProvider = { label: "metamask", isMetaMask: true, request: async () => [] };
    install({ request: async () => [], providers: [other, metaMask] });
    expect(readInjectedProvider()).toBe(metaMask);
  });

  it("uses another injected wallet when MetaMask is absent", () => {
    const other: MockProvider = { label: "other", request: async () => [] };
    install({ request: async () => [], providers: [other] });
    expect(readInjectedProvider()).toBe(other);
  });
});

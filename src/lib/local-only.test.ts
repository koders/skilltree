import { describe, expect, it } from "vitest";
import { isLocalHost, isLocalOrigin, rejectNonLocal } from "@/lib/local-only";

describe("isLocalHost", () => {
  it("accepts loopback names with or without a port", () => {
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000", "[::1]", "[::1]:3000", "LOCALHOST:3000"]) {
      expect(isLocalHost(host), host).toBe(true);
    }
  });

  it("rejects LAN addresses, other names and missing hosts (DNS rebinding sends the attacker's name)", () => {
    for (const host of ["192.168.0.187:3000", "evil.example:3000", "localhost.evil.example", "127.0.0.1.nip.io:3000", "", null, undefined]) {
      expect(isLocalHost(host), String(host)).toBe(false);
    }
  });
});

describe("isLocalOrigin", () => {
  it("accepts http(s) origins on a loopback host", () => {
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("rejects other origins, opaque origins and junk", () => {
    expect(isLocalOrigin("http://evil.example:3000")).toBe(false);
    expect(isLocalOrigin("null")).toBe(false);
    expect(isLocalOrigin("not a url")).toBe(false);
  });
});

describe("rejectNonLocal", () => {
  const req = (method: string, headers: Record<string, string>) => ({ method, headers: new Headers(headers) });

  it("lets local requests through", () => {
    expect(rejectNonLocal(req("GET", { host: "localhost:3000" }))).toBeNull();
    expect(rejectNonLocal(req("POST", { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }))).toBeNull();
    // A handcrafted local POST without Origin (curl, scripts) is fine: it can only come from this machine.
    expect(rejectNonLocal(req("POST", { host: "localhost:3000" }))).toBeNull();
  });

  it("refuses a request addressed to another host, whatever its Origin", () => {
    expect(rejectNonLocal(req("GET", { host: "192.168.0.187:3000" }))).toMatch(/host/i);
    expect(rejectNonLocal(req("POST", { host: "evil.example:3000", origin: "http://evil.example:3000" }))).toMatch(/host/i);
  });

  it("refuses a write sent from a page on another origin", () => {
    expect(rejectNonLocal(req("POST", { host: "localhost:3000", origin: "http://evil.example" }))).toMatch(/origin/i);
    expect(rejectNonLocal(req("POST", { host: "localhost:3000", origin: "null" }))).toMatch(/origin/i);
  });
});

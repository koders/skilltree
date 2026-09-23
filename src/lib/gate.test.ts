import { describe, expect, it } from "vitest";
import {
  checkPassword,
  createSessionToken,
  gatePassword,
  safeNextPath,
  SESSION_DAYS,
  verifySessionToken,
} from "@/lib/gate";

const NOW = Date.UTC(2026, 8, 23, 3, 0);

describe("gatePassword", () => {
  it("is off when APP_PASSWORD is unset or blank", () => {
    expect(gatePassword({})).toBeNull();
    expect(gatePassword({ APP_PASSWORD: "   " })).toBeNull();
    expect(gatePassword({ APP_PASSWORD: " open sesame " })).toBe("open sesame");
  });
});

describe("checkPassword", () => {
  it("accepts only the exact passphrase", async () => {
    expect(await checkPassword("open sesame", "open sesame")).toBe(true);
    expect(await checkPassword("open sesame", "open sesam")).toBe(false);
    expect(await checkPassword("open sesame", "")).toBe(false);
    expect(await checkPassword("open sesame", "OPEN SESAME")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips until expiry", async () => {
    const token = await createSessionToken("s3cret", NOW);
    expect(await verifySessionToken("s3cret", token, NOW + 1000)).toBe(true);
    expect(await verifySessionToken("s3cret", token, NOW + SESSION_DAYS * 86_400_000 - 1)).toBe(true);
    expect(await verifySessionToken("s3cret", token, NOW + SESSION_DAYS * 86_400_000)).toBe(false);
  });

  it("rejects tampering, other passphrases and junk", async () => {
    const token = await createSessionToken("s3cret", NOW);
    const [expires, sig] = token.split(".");
    expect(await verifySessionToken("other", token, NOW)).toBe(false);
    expect(await verifySessionToken("s3cret", `${Number(expires) + 86_400_000}.${sig}`, NOW)).toBe(false);
    expect(await verifySessionToken("s3cret", `${expires}.${sig.slice(0, -1)}x`, NOW)).toBe(false);
    for (const junk of [undefined, "", ".", "abc", `${expires}`, `x.${sig}`, `-1.${sig}`]) {
      expect(await verifySessionToken("s3cret", junk, NOW)).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths and refuses redirects elsewhere", () => {
    expect(safeNextPath("/quest")).toBe("/quest");
    expect(safeNextPath("/?skill=crypto.consensus&view=list")).toBe("/?skill=crypto.consensus&view=list");
    for (const bad of [null, undefined, "", "quest", "//evil.example", "/\\evil.example", "https://evil.example", "/unlock", "/unlock?next=/"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

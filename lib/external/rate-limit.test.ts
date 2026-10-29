import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIdOf, createRateLimiter } from "./rate-limit";

const limiter = () =>
  createRateLimiter({
    global: { capacity: 3, refillMs: 1000 },
    perClient: { capacity: 2, refillMs: 10000 },
  });

const takes = (l: ReturnType<typeof limiter>, id: string, n: number) =>
  Array.from({ length: n }, () => l.tryTake(id));

describe("createRateLimiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("limits each client to its burst and refills over time", () => {
    const l = limiter();
    expect(takes(l, "a", 3)).toEqual([true, true, false]);
    vi.advanceTimersByTime(9999);
    expect(l.tryTake("a")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(l.tryTake("a")).toBe(true);
  });

  it("caps all clients together with the global bucket", () => {
    const l = limiter();
    expect([...takes(l, "a", 2), ...takes(l, "b", 2)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(l.tryTake("c")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(l.tryTake("c")).toBe(true);
  });

  it("does not spend the global token when the client is refused", () => {
    const l = limiter();
    takes(l, "a", 2);
    expect(l.tryTake("a")).toBe(false);
    expect(l.tryTake("b")).toBe(true);
  });
});

describe("clientIdOf", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://test", { headers });

  it("takes the first forwarded hop, then x-real-ip, then unknown", () => {
    expect(clientIdOf(req({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe(
      "1.1.1.1",
    );
    expect(clientIdOf(req({ "x-real-ip": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIdOf(req({}))).toBe("unknown");
  });
});

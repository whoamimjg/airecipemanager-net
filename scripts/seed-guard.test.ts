/**
 * The safety guard is the whole reason this script is allowed near a production
 * database, so it gets tested directly rather than trusted by inspection.
 *
 * Contract: whichever identifier is supplied, the resolved account's email must
 * equal DEMO_EMAIL or the process aborts before anything is written.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveDemoUser } from "./seed-demo";
import { DEMO_EMAIL } from "./demo-data";

const DEMO_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";

/** Minimal stand-in for the bits of the admin client resolveDemoUser touches. */
function fakeAdmin(users: { id: string; email: string }[]) {
  let served = false;
  return {
    auth: {
      admin: {
        listUsers: async () => {
          if (served) return { data: { users: [] }, error: null };
          served = true;
          return { data: { users }, error: null };
        },
      },
    },
  } as never;
}

const ACCOUNTS = [
  { id: DEMO_ID, email: DEMO_EMAIL },
  { id: OTHER_ID, email: "a.real.customer@example.com" },
];

/** die() calls process.exit; make that throw so the test can observe the abort. */
function trapExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`EXIT:${code}`);
  }) as never);
}

afterEach(() => vi.restoreAllMocks());

describe("resolveDemoUser", () => {
  it("resolves the demo account by email", async () => {
    const user = await resolveDemoUser(fakeAdmin(ACCOUNTS), { email: DEMO_EMAIL });
    expect(user).toEqual({ id: DEMO_ID, email: DEMO_EMAIL });
  });

  it("resolves the demo account by user id", async () => {
    const user = await resolveDemoUser(fakeAdmin(ACCOUNTS), { userId: DEMO_ID });
    expect(user.email).toBe(DEMO_EMAIL);
  });

  it("REFUSES a real customer's user id", async () => {
    trapExit();
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveDemoUser(fakeAdmin(ACCOUNTS), { userId: OTHER_ID })).rejects.toThrow("EXIT:1");
    expect(stderr.mock.calls.join(" ")).toContain("REFUSING TO RUN");
  });

  it("REFUSES a non-demo email", async () => {
    trapExit();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      resolveDemoUser(fakeAdmin(ACCOUNTS), { email: "a.real.customer@example.com" }),
    ).rejects.toThrow("EXIT:1");
  });

  it("refuses when no identifier is supplied", async () => {
    trapExit();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveDemoUser(fakeAdmin(ACCOUNTS), {})).rejects.toThrow("EXIT:1");
  });

  it("fails loudly when the account does not exist", async () => {
    trapExit();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      resolveDemoUser(fakeAdmin(ACCOUNTS), { email: "nobody@nowhere.test" }),
    ).rejects.toThrow("EXIT:1");
  });

  it("matches the demo email case-insensitively", async () => {
    const user = await resolveDemoUser(fakeAdmin(ACCOUNTS), { email: DEMO_EMAIL.toUpperCase() });
    expect(user.id).toBe(DEMO_ID);
  });
});

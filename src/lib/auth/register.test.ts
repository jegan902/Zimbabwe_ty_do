import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  consumeRateLimit: vi.fn(),
  hashPassword: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/lib/utils/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
    },
  },
}));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/utils/crypto", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/auth/session", () => ({ createSession: mocks.createSession }));

import { POST } from "@/app/api/auth/register/route";

const createdUser = {
  id: "user-test-1",
  email: "person@example.com",
  username: "person@example.com",
  role: "USER",
  status: "ACTIVE",
  fullName: null,
  avatar: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue(undefined);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.hashPassword.mockResolvedValue("argon2-hash");
    mocks.userCreate.mockResolvedValue(createdUser);
    mocks.createSession.mockResolvedValue(undefined);
  });

  it("creates a normal user and wallet, hashes the password, and starts a session", async () => {
    const response = await POST(
      request({
        email: " Person@Example.com ",
        password: "correct-horse-battery",
        confirmPassword: "correct-horse-battery",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.hashPassword).toHaveBeenCalledWith("correct-horse-battery");
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "person@example.com",
          username: "person@example.com",
          passwordHash: "argon2-hash",
          wallet: { create: {} },
        }),
      })
    );
    expect(mocks.userCreate.mock.calls[0][0].data).not.toHaveProperty("role");
    expect(mocks.createSession).toHaveBeenCalledWith("user-test-1", expect.any(Object));

    const body = await response.json();
    expect(body.data.user).toMatchObject({ id: "user-test-1", role: "USER" });
    expect(body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects client-supplied roles instead of allowing privilege escalation", async () => {
    const response = await POST(
      request({
        email: "person@example.com",
        password: "correct-horse-battery",
        confirmPassword: "correct-horse-battery",
        role: "ADMIN",
      })
    );

    expect(response.status).toBe(422);
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("does not create a duplicate account", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "existing-user" });

    const response = await POST(
      request({
        email: "person@example.com",
        password: "correct-horse-battery",
        confirmPassword: "correct-horse-battery",
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});

// The sign-in cookie must be stored by the browser. Browsers drop Secure cookies on plain HTTP,
// so the flag follows the scheme the visitor used (the live site is http://<ip> until HTTPS).

import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const login = (proto: string, ip: string) =>
  request(createApp())
    .post("/api/auth/login")
    .set("X-Forwarded-For", ip)
    .set("X-Forwarded-Proto", proto)
    .send({ email: "operator@vistachase.com", password: "Operator2026!" });

const authCookie = (res: request.Response) => ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("vc_token="));

afterEach(() => {
  delete process.env.COOKIE_SECURE;
});

describe("sign-in cookie", () => {
  it("is not Secure on plain HTTP, so the browser keeps it", async () => {
    const res = await login("http", "10.8.0.1");
    expect(res.status).toBe(200);
    expect(authCookie(res)).toMatch(/HttpOnly/);
    expect(authCookie(res)).not.toMatch(/Secure/);
  });

  it("is Secure on HTTPS", async () => {
    const res = await login("https", "10.8.0.2");
    expect(authCookie(res)).toMatch(/Secure/);
  });

  it("can be forced with COOKIE_SECURE", async () => {
    process.env.COOKIE_SECURE = "true";
    const res = await login("http", "10.8.0.3");
    expect(authCookie(res)).toMatch(/Secure/);
  });
});

import { describe, expect, it } from "vitest";
import { resetPasswordForm } from "./auth";

describe("resetPasswordForm", () => {
  const form = { token: "abc", password: "a-long-password" };

  it("accepts a repeated password that matches", () => {
    expect(resetPasswordForm.safeParse({ ...form, confirm: form.password }).success).toBe(true);
  });

  it("flags the repeat field when the passwords differ", () => {
    const result = resetPasswordForm.safeParse({ ...form, confirm: "a-long-passw0rd" });
    expect(result.success).toBe(false);
    expect(result.error!.issues).toEqual([
      expect.objectContaining({ path: ["confirm"], message: "The passwords don't match." }),
    ]);
  });

  it("applies the register password rules", () => {
    const result = resetPasswordForm.safeParse({ ...form, password: "short", confirm: "short" });
    expect(result.error!.issues[0]).toMatchObject({ path: ["password"] });
  });
});

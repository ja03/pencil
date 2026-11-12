import { expect, test, type Page } from "@playwright/test";
import { linkInEmail, newUser } from "./mailpit";

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("forgot password, reset it, then log in with the new one", async ({ page }) => {
  const user = newUser();
  const newPassword = "e2e-password-2";
  const registered = await page.request.post("/api/auth/register", {
    data: { username: user.username, email: user.email, password: user.password },
  });
  expect(registered.ok()).toBe(true);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await linkInEmail(user.email, "/reset-password"));
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Repeat new password").fill(newPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL("/");

  // Saving signed this browser in; sign out to log in with the new password.
  // (Logins are rate-limited per IP, so the journey logs in only once.)
  await page.context().clearCookies();
  await logIn(page, user.email, newPassword);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

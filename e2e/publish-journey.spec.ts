import { expect, test } from "@playwright/test";
import { linkInEmail, newUser } from "./mailpit";

test("register, verify email, publish a post, then like and comment on it", async ({ page }) => {
  const user = newUser();

  await page.goto("/register");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

  await page.goto(await linkInEmail(user.email, "/verify/confirm"));
  await expect(page.getByRole("heading", { name: "You're verified" })).toBeVisible();
  await page.getByRole("link", { name: "Write your first post" }).click();

  const title = `Notes from ${user.username}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("textbox", { name: "Post content" }).fill("Written and published end to end.");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const like = page.getByRole("button", { name: /^Like,/ });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Add a comment").fill("First!");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("list", { name: "Comments" })).toContainText("First!");

  // Both survive a reload, so they were saved, not just shown.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Like,/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("list", { name: "Comments" })).toContainText("First!");
});

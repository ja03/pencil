import { expect } from "@playwright/test";
import { MAILPIT_URL } from "../tests/setup/env";

type MessageSummary = { ID: string };

/**
 * The path and query of the link to `path` in the newest email sent to
 * `address`, read from Mailpit's API. The app sends email in the background,
 * so this waits for the email to arrive.
 */
export async function linkInEmail(address: string, path: string): Promise<string> {
  const query = encodeURIComponent(`to:"${address}"`);
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
        const { messages } = (await res.json()) as { messages: MessageSummary[] };
        id = messages[0]?.ID;
        return id;
      },
      { message: `no email reached ${address}`, timeout: 15_000 },
    )
    .toBeDefined();

  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  const { Text } = (await res.json()) as { Text: string };
  const link = Text.match(new RegExp(`\\S+${path}\\?token=\\S+`))?.[0];
  expect(link, `the email has no ${path} link`).toBeDefined();
  const url = new URL(link!);
  return `${url.pathname}${url.search}`;
}

/** A fresh username and email, so runs never collide with earlier ones. */
export function newUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { username: `e2e_${id}`, email: `e2e-${id}@pencil.test`, password: "e2e-password-1" };
}

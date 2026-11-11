import { expect } from "vitest";
import { backgroundTasksSettled } from "@/server/background";
import { MAILPIT_URL } from "../setup/env";

type MessageSummary = { ID: string; Subject: string; To: { Address: string }[] };

/**
 * Every email Mailpit received for `address`, newest first. Waits for the
 * app's background sends to finish first, so a test can call this right
 * after the request that sends the email.
 */
export async function emailsTo(address: string): Promise<MessageSummary[]> {
  await backgroundTasksSettled();
  const query = encodeURIComponent(`to:"${address}"`);
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  expect(res.ok).toBe(true);
  const { messages } = (await res.json()) as { messages: MessageSummary[] };
  return messages;
}

/** The plain-text body of a Mailpit message. */
async function textOf(id: string): Promise<string> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  expect(res.ok).toBe(true);
  return ((await res.json()) as { Text: string }).Text;
}

/**
 * The token in the link to `path` in the newest email sent to `address`.
 * Fails the test if there is no email, or it has no such link.
 */
async function linkTokenFor(address: string, path: string): Promise<string> {
  const [latest] = await emailsTo(address);
  expect(latest, `no email was sent to ${address}`).toBeDefined();
  const pattern = new RegExp(`\\S+${path}\\?token=\\S+`);
  const link = (await textOf(latest.ID)).match(pattern)?.[0];
  expect(link, `the email has no ${path} link`).toBeDefined();
  return new URL(link!).searchParams.get("token")!;
}

/** The token in the newest verification email sent to `address`. */
export const verificationTokenFor = (address: string) => linkTokenFor(address, "/verify/confirm");

/** The token in the newest password reset email sent to `address`. */
export const resetTokenFor = (address: string) => linkTokenFor(address, "/reset-password");

import type { Mail } from "./mailer";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The email that proves a new user owns their address. */
export function verificationEmail({
  to,
  username,
  link,
}: {
  to: string;
  username: string;
  link: string;
}): Mail {
  const text = [
    `Hi @${username},`,
    "",
    "Confirm your email address to start publishing, liking and commenting on Pencil:",
    "",
    link,
    "",
    "The link works once and expires in 24 hours. If you didn't create a Pencil account, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#f4eee3;color:#2a1e16;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px;border-radius:20px;background:#fbf8f2;border:1px solid #e0d3bf">
    <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px">Verify your email</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi @${escapeHtml(username)}, confirm your email address to start publishing, liking and commenting on Pencil.</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#241a13;color:#fbf8f2;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase">Verify email</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6a5848">The link works once and expires in 24 hours. If you didn't create a Pencil account, you can ignore this email.</p>
  </div>
</body>
</html>`;

  return { to, subject: "Verify your email for Pencil", text, html };
}

/** The email with the link to choose a new password. */
export function passwordResetEmail({
  to,
  username,
  link,
}: {
  to: string;
  username: string;
  link: string;
}): Mail {
  const text = [
    `Hi @${username},`,
    "",
    "Someone asked to reset the password for your Pencil account. Choose a new one here:",
    "",
    link,
    "",
    "The link works once and expires in 1 hour. Saving a new password signs you out on every other device. If you didn't ask for this, you can ignore this email and your password stays the same.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#f4eee3;color:#2a1e16;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px;border-radius:20px;background:#fbf8f2;border:1px solid #e0d3bf">
    <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px">Reset your password</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi @${escapeHtml(username)}, someone asked to reset the password for your Pencil account.</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#241a13;color:#fbf8f2;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase">Choose a new password</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6a5848">The link works once and expires in 1 hour. Saving a new password signs you out on every other device. If you didn't ask for this, you can ignore this email and your password stays the same.</p>
  </div>
</body>
</html>`;

  return { to, subject: "Reset your Pencil password", text, html };
}

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/server/env";

/** One email, with a plain-text body and an HTML version of the same content. */
export type Mail = { to: string; subject: string; text: string; html: string };

// Singleton: one SMTP transport (and connection pool) per process, kept on
// globalThis like the Prisma and S3 clients. Mailpit locally, Mailtrap in
// production: only the env vars differ.
const globalForMail = globalThis as unknown as { mailer?: Transporter };

function transport(): Transporter {
  const e = env();
  globalForMail.mailer ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    // Port 465 speaks TLS from the start; others upgrade with STARTTLS when offered.
    secure: e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
  });
  return globalForMail.mailer;
}

/** Sends `mail` from the configured sender. Rejects when the SMTP server refuses it. */
export async function sendMail(mail: Mail): Promise<void> {
  await transport().sendMail({ from: env().MAIL_FROM, ...mail });
}

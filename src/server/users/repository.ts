import { Prisma, type User } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type { User };

export function findUserById(id: string): Promise<User | null> {
  return db().user.findUnique({ where: { id } });
}

export function findUserByUsername(username: string): Promise<User | null> {
  return db().user.findUnique({ where: { username } });
}

export function findUserByEmail(email: string): Promise<User | null> {
  return db().user.findUnique({ where: { email } });
}

/** Records that the user proved they own their email. A user verified earlier keeps the first date. */
export async function markEmailVerified(id: string, at: Date): Promise<void> {
  await db().user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: at } });
}

export type UniqueUserField = "email" | "username";

/** Which of `email` and `username` already belong to an account. */
export async function findTakenFields(
  email: string,
  username: string,
): Promise<UniqueUserField[]> {
  const rows = await db().user.findMany({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  const taken: UniqueUserField[] = [];
  if (rows.some((r) => r.email === email)) taken.push("email");
  if (rows.some((r) => r.username === username)) taken.push("username");
  return taken;
}

export type CreateUserResult =
  | { ok: true; user: User }
  | { ok: false; taken: UniqueUserField[] };

/**
 * Inserts a user. The unique indexes are the final word on duplicates: if a
 * concurrent request took the email or username first, this reports which.
 */
export async function createUser(data: {
  email: string;
  username: string;
  passwordHash: string;
}): Promise<CreateUserResult> {
  try {
    return { ok: true, user: await db().user.create({ data }) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, taken: await findTakenFields(data.email, data.username) };
    }
    throw error;
  }
}

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Who the list is for and which posts it must leave out. */
export type Audience = {
  /** The signed-in reader; their own posts and the posts they liked are left out. */
  viewerId: string | null;
  /** Posts already shown, such as the one being read. */
  skip: string[];
};

const uuid = (id: string) => Prisma.sql`${id}::uuid`;

/**
 * The rule every recommendation follows, on `posts p`: published, not
 * deleted, not skipped, and when someone is signed in, neither theirs nor
 * already liked by them.
 */
function eligible({ viewerId, skip }: Audience): Prisma.Sql {
  const viewer = viewerId
    ? Prisma.sql`
      AND p."authorId" <> ${uuid(viewerId)}
      AND NOT EXISTS (
        SELECT 1 FROM likes seen WHERE seen."userId" = ${uuid(viewerId)} AND seen."postId" = p.id
      )`
    : Prisma.empty;
  const skipped =
    skip.length > 0 ? Prisma.sql`AND p.id NOT IN (${Prisma.join(skip.map(uuid))})` : Prisma.empty;
  return Prisma.sql`p."publishedAt" IS NOT NULL AND p."deletedAt" IS NULL ${viewer} ${skipped}`;
}

/** Ties go to the more-liked post, then the newer one. */
const thenLikedThenNewest = Prisma.sql`
  (SELECT COUNT(*) FROM likes lc WHERE lc."postId" = p.id) DESC,
  p."publishedAt" DESC,
  p.id DESC`;

async function ids(query: Prisma.Sql): Promise<string[]> {
  const rows = await db().$queryRaw<{ id: string }[]>(query);
  return rows.map((row) => row.id);
}

/**
 * Posts sharing tags with the posts `userId` liked, best first. A tag counts
 * once for every liked post that carries it, so tags the reader likes often
 * weigh more. Posts sharing no tag are left out.
 */
export function findByLikedTags(userId: string, audience: Audience, take: number) {
  return ids(Prisma.sql`
    WITH liked_tags AS (
      SELECT pt."tagId", COUNT(*) AS weight
      FROM likes l
      JOIN post_tags pt ON pt."postId" = l."postId"
      WHERE l."userId" = ${uuid(userId)}
      GROUP BY pt."tagId"
    )
    SELECT p.id
    FROM posts p
    JOIN post_tags pt ON pt."postId" = p.id
    JOIN liked_tags lt ON lt."tagId" = pt."tagId"
    WHERE ${eligible(audience)}
    GROUP BY p.id
    ORDER BY SUM(lt.weight) DESC, ${thenLikedThenNewest}
    LIMIT ${take}`);
}

/** Posts sharing tags with `postId`, most shared tags first. Posts sharing none are left out. */
export function findBySharedTags(postId: string, audience: Audience, take: number) {
  return ids(Prisma.sql`
    SELECT p.id
    FROM posts p
    JOIN post_tags pt ON pt."postId" = p.id
    WHERE pt."tagId" IN (SELECT "tagId" FROM post_tags WHERE "postId" = ${uuid(postId)})
      AND ${eligible(audience)}
    GROUP BY p.id
    ORDER BY COUNT(*) DESC, ${thenLikedThenNewest}
    LIMIT ${take}`);
}

/** Posts published since `since`, most liked first, then newest. */
export function findPopularSince(since: Date, audience: Audience, take: number) {
  return ids(Prisma.sql`
    SELECT p.id
    FROM posts p
    WHERE p."publishedAt" >= ${since} AND ${eligible(audience)}
    ORDER BY ${thenLikedThenNewest}
    LIMIT ${take}`);
}

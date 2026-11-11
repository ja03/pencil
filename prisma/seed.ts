// Seed data for local development (`docker compose up` runs this after
// migrating). Must stay idempotent: it runs on every container start.
import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { checkPostContent, type BlockNode } from "../src/contracts/post-content";
import { hashPassword } from "../src/server/auth/password";
import { db } from "../src/server/db";
import { env } from "../src/server/env";
import { excerptOf } from "../src/server/posts/excerpt";
import { readingMinutesOf } from "../src/server/posts/reading-time";
import { slugify } from "../src/server/posts/slug";
import { publicReadPolicy, s3 } from "../src/server/storage";

/** Every demo account signs in with this password. */
const DEMO_PASSWORD = "pencil-demo";

/** Creates the bucket if needed and lets anyone read images from it. */
async function ensureBucket() {
  await createBucket();
  const Bucket = env().S3_BUCKET;
  await s3().send(new PutBucketPolicyCommand({ Bucket, Policy: publicReadPolicy(Bucket) }));
}

async function createBucket() {
  const Bucket = env().S3_BUCKET;
  for (let attempt = 1; ; attempt++) {
    try {
      await s3().send(new HeadBucketCommand({ Bucket }));
      return;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) {
        await s3().send(new CreateBucketCommand({ Bucket }));
        console.log(`Created bucket ${Bucket}.`);
        return;
      }
      // Storage may still be starting; retry for ~30 seconds.
      if (attempt >= 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Demo authors are verified, so publishing, liking and commenting can be
// tried before email verification exists.
const AUTHORS = ["lina_k", "omar_h", "devnotes", "sara_m"] as const;
type Author = (typeof AUTHORS)[number];

const text = (t: string) => ({ type: "text" as const, text: t });
const p = (t: string): BlockNode => ({ type: "paragraph", content: [text(t)] });
const h2 = (t: string): BlockNode => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });
const quote = (t: string): BlockNode => ({ type: "blockquote", content: [p(t)] });
const list = (...items: string[]): BlockNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});

type SeedPost = {
  author: Author;
  title: string;
  description?: string;
  tags: string[];
  body: BlockNode[];
};

// Oldest first; each is published a day after the one before.
const POSTS: SeedPost[] = [
  {
    author: "omar_h",
    title: "Notes on a slower internet",
    tags: ["internet", "habits"],
    body: [
      p("For a month I opened the web only twice a day, once in the morning and once after dinner. Everything else waited."),
      p("The surprise was not how much I missed, but how little. The pages I cared about were still there in the evening, and most of the urgent ones had stopped mattering by then."),
      p("A slower internet is not a smaller one. It is the same web, read on purpose."),
    ],
  },
  {
    author: "devnotes",
    title: "Editing is mostly deleting",
    tags: ["writing", "editing"],
    description: "The best edit I ever made to a post was removing its first three paragraphs.",
    body: [
      p("Most drafts start before the idea does. The first few paragraphs are the writer warming up, and the reader can tell."),
      h2("A simple test"),
      p("Cover the opening paragraph with your hand. If the piece still makes sense, the paragraph can go. Repeat until it stops making sense, then put the last one back."),
      quote("Cutting is not losing work. It is finding out which work mattered."),
    ],
  },
  {
    author: "sara_m",
    title: "Why I keep a commonplace book",
    tags: ["reading", "habits"],
    body: [
      p("A commonplace book is a notebook of other people's sentences: lines from books, things overheard, a recipe note, a phrase from a letter."),
      p("Copying a sentence by hand makes you read it at the speed it was written. You notice the commas."),
      list(
        "Write the source under every entry.",
        "Don't organise it. Let the index grow at the back.",
        "Reread a random page once a week.",
      ),
    ],
  },
  {
    author: "lina_k",
    title: "The craft of the second sentence",
    tags: ["writing", "craft"],
    description: "First sentences get all the attention. The second one decides whether anyone reads the third.",
    body: [
      p("A strong opening line makes a promise. The second sentence is where you start keeping it."),
      p("When I rewrite an opening now, I leave the first line alone and work on the one after it. It is almost always the weaker of the two."),
    ],
  },
  {
    author: "sara_m",
    title: "Margins are where thinking happens",
    tags: ["reading", "thinking"],
    body: [
      p("The most useful part of any book I own is the margin. That is where the argument with the author lives."),
      p("Reading on paper with a pencil turns reading into a conversation. Reading on a screen, I mostly nod along."),
    ],
  },
  {
    author: "omar_h",
    title: "Letters I never sent",
    tags: ["writing"],
    description: "On writing for one reader, and why it makes the rest of your writing better.",
    body: [
      p("I keep a folder of letters I never sent. Most were written to people I couldn't say something to in person; a few were written to people who were no longer around to read them."),
      p("They are the clearest things I have written. With only one reader in mind, there was nobody to impress and nothing to hedge."),
      p("Now, when a post won't come together, I rewrite it as a letter to one person. It usually comes together."),
    ],
  },
  {
    author: "lina_k",
    title: "Gardens, compilers and patience",
    tags: ["programming", "gardening"],
    description: "Two hobbies that reward the same thing: showing up and waiting for results.",
    body: [
      p("A garden and a large codebase have more in common than either community would admit. Both punish impatience and reward small, regular attention."),
      h2("Water a little, often"),
      p("You can't fix a neglected garden in one weekend, and you can't refactor a neglected module in one pull request. Both need a habit, not a heroic effort."),
      p("The compiler, like the soil, tells you the truth eventually. The trick is to listen before it gets loud."),
    ],
  },
  {
    author: "sara_m",
    title: "Learning to read slowly again",
    tags: ["reading", "habits"],
    description: "Notes from a month of reading one essay a day, on paper, with a pencil in hand.",
    body: [
      p("I used to measure reading in books per year. This month I measured it in essays per day, and the number was one."),
      p("One essay, read twice, with notes in the margin. By the end of the month I could tell you what each of them argued, which is more than I can say for most of last year's books."),
      quote("Speed is a fine way to find a book. It is a poor way to read one."),
    ],
  },
  {
    author: "devnotes",
    title: "A small case for boring technology",
    tags: ["programming", "software"],
    description: "Postgres, a single container and a cron job will carry you further than you think.",
    body: [
      p("Every new tool in a stack is a new way for it to fail at three in the morning. Boring technology has already failed in all the interesting ways, and someone wrote down the fix."),
      h2("What boring buys you"),
      list(
        "Answers that already exist on the first page of search results.",
        "Fewer moving parts to deploy, monitor and upgrade.",
        "More time spent on the problem your users actually have.",
      ),
      p("Reach for the exciting tool when the boring one has clearly run out. Not before."),
    ],
  },
  {
    author: "omar_h",
    title: "What old maps get right about uncertainty",
    tags: ["maps", "design"],
    description: "Cartographers left blank spaces on purpose. Our dashboards could learn from them.",
    body: [
      p("Old maps were honest about the edges of what their makers knew. Coastlines trailed off into dotted lines; interiors were simply left blank."),
      p("Modern dashboards rarely do this. Every number is drawn with the same confident line, whether it comes from a thousand samples or three."),
      p("A dotted line is not a failure of the map. It is the most useful thing on it."),
    ],
  },
  {
    author: "lina_k",
    title: "On walking the same loop every morning",
    tags: ["walking", "habits"],
    body: [
      p("I walk the same loop most mornings: down the hill, along the river, back past the bakery that is never open yet."),
      p("Because the route never changes, I stop looking at it. What is left is room to think, and most of my drafts start somewhere between the bridge and the bakery."),
    ],
  },
  {
    author: "lina_k",
    title: "The quiet discipline of first drafts",
    tags: ["writing", "craft", "habits"],
    description: "Why the worst version of an idea teaches you the most, and how to keep writing past it.",
    body: [
      p("Every first draft I have written was embarrassing. Not some of them. All of them. The surprise, after a few years, was that the embarrassment stopped being a reason to stop."),
      p("A first draft is not a worse version of the finished piece. It is a different object: a map of what you think you know, drawn quickly, with the blank spaces left honest."),
      h2("Write past the bad part"),
      p("The worst paragraph usually sits right before the one you needed. Keep a short list of rules on the desk:"),
      list(
        "Don't fix a sentence until the page is full.",
        "Mark gaps with [TK] and keep moving.",
        "Stop mid-sentence, so tomorrow starts easy.",
      ),
      quote("You can't edit a blank page, but you can edit a terrible one."),
    ],
  },
];

async function seedAuthors(): Promise<Map<Author, string>> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids = new Map<Author, string>();
  for (const username of AUTHORS) {
    const email = `${username.replace("_", ".")}@pencil.local`;
    const user = await db().user.upsert({
      where: { email },
      create: { email, username, passwordHash, emailVerifiedAt: new Date() },
      update: {},
    });
    if (!user.emailVerifiedAt) {
      await db().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }
    ids.set(username, user.id);
  }
  return ids;
}

/** Join rows linking `postId` to `names`, creating any tag that is missing. */
async function tagRows(names: string[], postId: string) {
  await db().tag.createMany({ data: names.map((name) => ({ name })), skipDuplicates: true });
  const rows = await db().tag.findMany({ where: { name: { in: names } } });
  return names.map((name, position) => ({
    postId,
    tagId: rows.find((row) => row.name === name)!.id,
    position,
  }));
}

async function seedPosts(authorIds: Map<Author, string>) {
  const day = 24 * 60 * 60 * 1000;
  const start = Date.now() - POSTS.length * day;
  let created = 0;
  for (const [i, post] of POSTS.entries()) {
    const checked = checkPostContent({ type: "doc", content: post.body });
    if (!checked.ok) throw new Error(`Seed post "${post.title}": ${checked.issue.message}`);
    const content = checked.content;
    const slug = slugify(post.title);
    const existing = await db().post.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      // Posts seeded before tags existed get theirs; ones that have tags keep them.
      if ((await db().postTag.count({ where: { postId: existing.id } })) === 0) {
        await db().postTag.createMany({ data: await tagRows(post.tags, existing.id) });
      }
      continue;
    }
    const { id } = await db().post.create({
      data: {
        slug,
        authorId: authorIds.get(post.author)!,
        title: post.title,
        description: post.description ?? null,
        excerpt: excerptOf(content),
        readingMinutes: readingMinutesOf(content),
        content,
        publishedAt: new Date(start + i * day),
      },
      select: { id: true },
    });
    await db().postTag.createMany({ data: await tagRows(post.tags, id) });
    created++;
  }
  console.log(`Seeded ${created} demo post(s).`);
}

/**
 * A spread of likes between the demo authors, so like counts (and #20's
 * most-liked fallback) have something to show. Each post gets 0 to 3 likes
 * from the other authors, a few hours after it was published. Likes that
 * already exist are left alone.
 */
async function seedLikes(authorIds: Map<Author, string>) {
  const hour = 60 * 60 * 1000;
  const posts = await db().post.findMany({
    where: { slug: { in: POSTS.map((post) => slugify(post.title)) } },
    select: { id: true, authorId: true, publishedAt: true },
    orderBy: { publishedAt: "asc" },
  });
  const readers = [...authorIds.values()];
  const data = posts.flatMap((post, i) => {
    const others = readers.filter((id) => id !== post.authorId);
    const published = (post.publishedAt ?? new Date()).getTime();
    return others.slice(0, (i * 3 + 1) % 4).map((userId, n) => ({
      userId,
      postId: post.id,
      createdAt: new Date(Math.min(Date.now(), published + (n + 1) * 3 * hour)),
    }));
  });
  const { count } = await db().like.createMany({ data, skipDuplicates: true });
  console.log(`Seeded ${count} demo like(s).`);
}

type SeedComment = { by: Author; body: string; replies?: { by: Author; body: string }[] };

// A few conversations, keyed by post title, so comment threads and counts
// have something to show.
const COMMENTS: Record<string, SeedComment[]> = {
  "The quiet discipline of first drafts": [
    {
      by: "sara_m",
      body: "The [TK] trick changed how I draft. I used to stall on every missing fact.",
      replies: [{ by: "lina_k", body: "Same. It turns a stop sign into a bookmark." }],
    },
    {
      by: "devnotes",
      body: "Stopping mid-sentence is underrated. Tomorrow-me always thanks today-me.",
    },
  ],
  "A small case for boring technology": [
    {
      by: "omar_h",
      body: "Postgres and a cron job have outlived three of the queues I replaced them with.",
      replies: [
        { by: "devnotes", body: "The best incident report is the one you never had to write." },
        { by: "lina_k", body: "Saving this for the next architecture review." },
      ],
    },
  ],
  "Margins are where thinking happens": [
    { by: "omar_h", body: "I buy used books for the margins as much as for the text." },
  ],
};

/**
 * The demo conversations, an hour or so after each post was published.
 * Posts that already have comments are left alone.
 */
async function seedComments(authorIds: Map<Author, string>) {
  const minute = 60 * 1000;
  let created = 0;
  for (const [title, threads] of Object.entries(COMMENTS)) {
    const post = await db().post.findUnique({
      where: { slug: slugify(title) },
      select: { id: true, publishedAt: true, _count: { select: { comments: true } } },
    });
    if (!post || post._count.comments > 0) continue;
    let at = (post.publishedAt ?? new Date()).getTime() + 60 * minute;
    const when = () => new Date(Math.min(Date.now(), (at += 17 * minute)));
    for (const thread of threads) {
      const { id } = await db().comment.create({
        data: {
          postId: post.id,
          authorId: authorIds.get(thread.by)!,
          body: thread.body,
          createdAt: when(),
        },
        select: { id: true },
      });
      created++;
      for (const reply of thread.replies ?? []) {
        await db().comment.create({
          data: {
            postId: post.id,
            parentId: id,
            authorId: authorIds.get(reply.by)!,
            body: reply.body,
            createdAt: when(),
          },
        });
        created++;
      }
    }
  }
  console.log(`Seeded ${created} demo comment(s).`);
}

async function main() {
  await ensureBucket();
  const authorIds = await seedAuthors();
  await seedPosts(authorIds);
  await seedLikes(authorIds);
  await seedComments(authorIds);
  console.log(`Seed complete. Demo authors sign in with password "${DEMO_PASSWORD}".`);
}

main()
  .finally(() => db().$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

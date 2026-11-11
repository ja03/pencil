// Placeholder home page; the public feed replaces it in a later ticket.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 px-4 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Pencil</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        A place to publish rich posts and find writing you&apos;ll like.
      </p>
    </main>
  );
}

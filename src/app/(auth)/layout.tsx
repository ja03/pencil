import Link from "next/link";
import { Logo } from "@/components/logo";
import { PageTransition } from "@/components/page-transition";

/** Login and register: an illustrated panel beside the form, stacked on phones. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <PageTransition>
      <div className="flex min-h-dvh flex-wrap gap-2 bg-bg p-3 text-ink sm:gap-6 sm:p-6">
        <aside
          aria-hidden="true"
          className="relative flex min-h-[150px] flex-[1_1_100%] flex-col justify-between gap-6 overflow-hidden rounded-[18px] p-5 text-[#FBF4E8] md:min-h-[calc(100dvh-48px)] md:flex-[0_1_46%] md:rounded-[28px] md:p-10"
          style={{
            background:
              "repeating-linear-gradient(118deg, rgba(255,240,222,0.05) 0 1px, transparent 1px 7px), radial-gradient(circle at 80% 15%, rgba(240,178,128,0.55), transparent 45%), radial-gradient(circle at 10% 95%, rgba(80,30,14,0.6), transparent 50%), linear-gradient(150deg, #9A3E1F, #BC5A2F)",
          }}
        >
          <Logo nib="#FBF4E8" cut="#A9482A" />
          <svg
            viewBox="0 0 360 240"
            className="hidden w-4/5 max-w-[380px] self-center md:block"
            fill="none"
            stroke="#F6D7B8"
            strokeWidth="1.3"
            strokeLinecap="round"
          >
            <path d="M30 210 C110 185 170 185 180 200 C190 185 250 185 330 210" />
            <path d="M180 200 V70" />
            <path d="M44 196 C112 172 168 172 180 186 M50 180 C116 158 166 158 180 170 M58 164 C120 144 166 144 180 154" />
            <path d="M316 196 C248 172 192 172 180 186 M310 180 C244 158 194 158 180 170 M302 164 C240 144 194 144 180 154" />
            <path d="M245 30 L320 140 L308 147 L233 37 Z" />
            <path d="M320 140 L326 160 L308 147" />
            <circle cx="90" cy="60" r="30" strokeDasharray="2 5" />
            <circle cx="90" cy="60" r="4" fill="#F6D7B8" />
          </svg>
          <div className="flex flex-col gap-3.5">
            <p className="m-0 font-serif text-2xl leading-tight tracking-tight md:text-[40px]">
              Write the first draft badly. Then write the second.
            </p>
            <span className="label-mono hidden text-[rgba(251,244,232,0.8)] md:block">
              A journal for many hands
            </span>
          </div>
        </aside>

        <main className="flex min-w-0 flex-[1_1_420px] items-center justify-center px-2 pt-6 pb-10 md:p-10">
          <div className="flex w-full max-w-[420px] flex-col gap-[22px]">
            <Link href="/" className="label-mono self-start text-mut no-underline hover:text-ink">
              ← Back to Pencil
            </Link>
            {children}
          </div>
        </main>
      </div>
    </PageTransition>
  );
}

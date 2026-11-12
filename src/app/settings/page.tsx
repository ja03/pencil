import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { parseTheme, THEME_COOKIE, type Theme } from "@/client/theme";
import { PageTransition } from "@/components/page-transition";
import type { CurrentUser } from "@/contracts/auth";
import { profilePath } from "@/contracts/users";
import { ResendVerificationButton } from "@/components/resend-verification-button";
import { LogOutButton, SettingsNav } from "@/components/settings-nav";
import { parseSettingsTab, settingsPath, type SettingsTab } from "@/components/settings-tabs";
import { ThemePicker } from "@/components/theme-picker";
import { requirePageUser } from "@/server/auth/page-guard";

export const metadata: Metadata = { title: "Settings · Pencil" };

type Props = PageProps<"/settings">;

/**
 * Account, sign-in and appearance settings, one section at a time chosen by
 * `?tab=`. The proxy sends visitors who aren't signed in to log in.
 */
export default function SettingsPage({ searchParams }: Props) {
  return (
    <PageTransition>
      <main className="mx-auto box-border flex w-full max-w-[1120px] flex-col gap-7 px-4 pt-5 pb-16 sm:px-10 sm:pt-10 sm:pb-24">
        <h1 className="m-0 font-serif text-[40px] font-normal tracking-[-0.02em] sm:text-[56px]">
          Settings
        </h1>
        <Suspense fallback={<SettingsSkeleton />}>
          <SettingsView searchParams={searchParams} />
        </Suspense>
      </main>
    </PageTransition>
  );
}

async function SettingsView({ searchParams }: Pick<Props, "searchParams">) {
  const tab = parseSettingsTab((await searchParams).tab);
  const cookieStore = await cookies();
  const user = await requirePageUser(cookieStore, settingsPath(tab));

  const sections: Record<SettingsTab, ReactNode> = {
    account: <AccountSection user={user} />,
    security: <SecuritySection user={user} />,
    appearance: <ThemeSection initial={parseTheme(cookieStore.get(THEME_COOKIE)?.value)} />,
  };

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start">
      <SettingsNav current={tab} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">{sections[tab]}</div>
    </div>
  );
}

function Card({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-[22px] rounded-[20px] border border-line bg-surf p-5 sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="m-0 font-serif text-[28px] font-normal">
          {title}
        </h2>
        <p className="m-0 text-sm text-mut">{intro}</p>
      </div>
      {children}
    </section>
  );
}

const field = "flex h-12 items-center gap-2 rounded-xl px-3.5";
const fieldInput = "min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none";
const chip = "label-mono inline-flex flex-none items-center rounded-full px-2.5 py-[5px] text-[10px]";

function AccountSection({ user }: { user: CurrentUser }) {
  return (
    <>
      <Card id="account-title" title="Account" intro="How you appear on Pencil and how we reach you.">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-username" className="text-[13px] font-medium">
            Username
          </label>
          <div className={`${field} border border-dashed border-line bg-soft text-mut`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="flex-none">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="settings-username"
              value={`@${user.username}`}
              readOnly
              aria-describedby="settings-username-hint"
              className={fieldInput}
            />
          </div>
          <span id="settings-username-hint" className="text-xs leading-normal text-mut">
            Usernames can&rsquo;t be changed, so links to your profile never break. Your profile
            lives at {profilePath(user.username)}.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="settings-email" className="text-[13px] font-medium">
            Email
          </label>
          <div className={`${field} gap-2.5 border border-line bg-bg`}>
            <input id="settings-email" value={user.email} readOnly className={fieldInput} />
            {user.emailVerified ? (
              <span className={`${chip} bg-pub-bg text-ok`}>Verified</span>
            ) : (
              <span className={`${chip} bg-warn-bg text-warn-ink`}>Not verified</span>
            )}
          </div>
          {!user.emailVerified && (
            <p className="m-0 mt-2 rounded-[14px] bg-warn-bg px-4 py-3.5 text-sm leading-normal text-warn-ink">
              Until you verify, you can read and write drafts but not publish, like or comment.{" "}
              <ResendVerificationButton
                email={user.email}
                className="cursor-pointer bg-transparent p-0 font-semibold text-warn-ink underline underline-offset-2 disabled:cursor-wait disabled:opacity-70"
              >
                Resend link
              </ResendVerificationButton>
            </p>
          )}
        </div>
      </Card>
      <LogOutButton className="label-mono h-12 cursor-pointer rounded-full border border-line bg-transparent tracking-[0.1em] text-ink disabled:opacity-60 md:hidden" />
    </>
  );
}

function SecuritySection({ user }: { user: CurrentUser }) {
  return (
    <Card id="security-title" title="Password & sign-in" intro="How you sign in to Pencil.">
      {user.hasPassword && (
        <SignInMethod
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          }
          title="Email and password"
          detail={<>You sign in as {user.email}.</>}
          action={
            <Link href="/forgot-password" className="text-[13px] text-acc">
              Forgot your password?
            </Link>
          }
        />
      )}
      {user.googleLinked && (
        <SignInMethod
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 12.2a8 8 0 1 1-2.4-5.7" />
              <path d="M20 12h-8" />
            </svg>
          }
          title="Google"
          detail={<>Connected as {user.email}.</>}
          action={<span className={`${chip} bg-pub-bg text-ok`}>Connected</span>}
        />
      )}
    </Card>
  );
}

/** One way the account can sign in: what it is, who it signs in as, and what to do about it. */
function SignInMethod({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
      <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-full border-[1.5px] border-ink">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <span className="text-sm break-words text-mut">{detail}</span>
      </div>
      {action}
    </div>
  );
}

function ThemeSection({ initial }: { initial: Theme }) {
  return (
    <Card
      id="appearance-title"
      title="Appearance"
      intro="Saved on this browser, so pages load in the right theme with no flash."
    >
      <ThemePicker initial={initial} />
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your settings" className="flex flex-col gap-8 md:flex-row md:items-start">
      <div className="flex gap-1 md:w-[220px] md:flex-col">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-11 w-28 rounded-xl bg-soft md:w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-[22px] rounded-[20px] border border-line bg-surf p-5 sm:p-8">
        <span className="h-8 w-40 rounded-md bg-soft" />
        <span className="h-12 rounded-xl bg-soft" />
        <span className="h-12 rounded-xl bg-soft" />
      </div>
    </div>
  );
}

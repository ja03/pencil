"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { apiErrorOf } from "@/client/api";
import { selectCurrentUser } from "@/client/auth-slice";
import {
  confirmed,
  likeState,
  rollBack,
  shown,
  toggled,
  unsent,
  type LikeState,
} from "@/client/like-state";
import { useLikePostMutation, useUnlikePostMutation } from "@/client/posts-api";
import { useAppSelector } from "@/client/store";
import type { LikeResponse } from "@/contracts/likes";
import { HeartIcon, likesLabel } from "./heart-icon";
import { useToast } from "./toaster";

/**
 * Like and unlike a post with one button. The heart and count change at
 * once; requests go out one at a time until the server agrees with the
 * reader's last click, and a failure rolls back to what the server last
 * confirmed. Visitors and unverified readers get a prompt instead.
 */
export function LikeButton({ postId, initial }: { postId: string; initial: LikeResponse }) {
  const user = useAppSelector(selectCurrentUser);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [like] = useLikePostMutation();
  const [unlike] = useUnlikePostMutation();

  const [state, setState] = useState(() => likeState(initial));
  // The latest state, readable from the request loop without waiting for a render.
  const latest = useRef(state);
  const sending = useRef(false);

  function update(change: (current: LikeState) => LikeState) {
    latest.current = change(latest.current);
    setState(latest.current);
  }

  async function send() {
    if (sending.current) return;
    sending.current = true;
    try {
      for (let next = unsent(latest.current); next !== null; next = unsent(latest.current)) {
        try {
          const server = await (next ? like(postId) : unlike(postId)).unwrap();
          update((current) => confirmed(current, server));
        } catch (error) {
          update(rollBack);
          toast.error(apiErrorOf(error)?.message ?? "Couldn't save your like. Please try again.", {
            key: "like",
          });
          return;
        }
      }
    } finally {
      sending.current = false;
    }
  }

  function onClick() {
    if (!user) {
      toast.error("Log in to like posts.", {
        key: "like",
        action: {
          label: "Log in",
          onClick: () => router.push(`/login?next=${encodeURIComponent(pathname)}`),
        },
      });
      return;
    }
    if (!user.emailVerified) {
      toast.error("Verify your email to like posts.", { key: "like" });
      return;
    }
    update(toggled);
    void send();
  }

  const { liked, likeCount } = shown(state);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={`Like, ${likesLabel(likeCount)}`}
      className={`label-mono flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-transparent px-4 tracking-[0.1em] hover:bg-soft ${liked ? "text-acc" : "text-ink"}`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{likeCount}</span>
    </button>
  );
}

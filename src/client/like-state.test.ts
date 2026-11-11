import { describe, expect, it } from "vitest";
import { confirmed, likeState, rollBack, shown, toggled, unsent } from "./like-state";

describe("like state", () => {
  it("shows the server's state when nothing is pending", () => {
    const state = likeState({ liked: false, likeCount: 4 });

    expect(shown(state)).toEqual({ liked: false, likeCount: 4 });
    expect(unsent(state)).toBeNull();
  });

  it("shows a like straight away, before the server answers", () => {
    const state = toggled(likeState({ liked: false, likeCount: 4 }));

    expect(shown(state)).toEqual({ liked: true, likeCount: 5 });
    expect(unsent(state)).toBe(true);
  });

  it("shows an unlike straight away", () => {
    const state = toggled(likeState({ liked: true, likeCount: 4 }));

    expect(shown(state)).toEqual({ liked: false, likeCount: 3 });
    expect(unsent(state)).toBe(false);
  });

  it("has nothing to send after toggling twice", () => {
    const state = toggled(toggled(likeState({ liked: false, likeCount: 4 })));

    expect(shown(state)).toEqual({ liked: false, likeCount: 4 });
    expect(unsent(state)).toBeNull();
  });

  it("takes the server's count once it answers, including other readers' likes", () => {
    const state = confirmed(toggled(likeState({ liked: false, likeCount: 4 })), {
      liked: true,
      likeCount: 7,
    });

    expect(shown(state)).toEqual({ liked: true, likeCount: 7 });
    expect(unsent(state)).toBeNull();
  });

  it("keeps a toggle made while a request was in flight", () => {
    // Liked, then unliked before the like's answer arrived.
    const state = confirmed(toggled(toggled(likeState({ liked: false, likeCount: 4 }))), {
      liked: true,
      likeCount: 5,
    });

    expect(shown(state)).toEqual({ liked: false, likeCount: 4 });
    expect(unsent(state)).toBe(false);
  });

  it("rolls back to the last state the server confirmed when a request fails", () => {
    const state = rollBack(toggled(likeState({ liked: false, likeCount: 4 })));

    expect(shown(state)).toEqual({ liked: false, likeCount: 4 });
    expect(unsent(state)).toBeNull();
  });

  it("never shows a negative count", () => {
    const state = toggled(likeState({ liked: true, likeCount: 0 }));

    expect(shown(state).likeCount).toBe(0);
  });
});

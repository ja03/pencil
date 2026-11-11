import type {
  CommentResponse,
  CommentsResponse,
  CreateCommentBody,
} from "@/contracts/comments";
import { api } from "./api";

/**
 * A post's comments after its server-rendered first page. The cursor that
 * page ended on is part of the key, so each server render gets its own cache
 * entry and pages never mix across refreshes.
 */
export type CommentListArg = { postId: string; after: string };

/** Post lists carry comment counts, so they refresh after a comment. */
const POST_LISTS = { type: "Post", id: "LIST" } as const;

export const commentsApi = api.enhanceEndpoints({ addTagTypes: ["Post"] }).injectEndpoints({
  endpoints: (build) => ({
    /** Older top-level comments, 20 a page, each with all its replies. */
    getComments: build.infiniteQuery<CommentsResponse, CommentListArg, string>({
      infiniteQueryOptions: {
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: `/posts/${queryArg.postId}/comments`,
        params: { cursor: pageParam },
      }),
    }),
    /** A new top-level comment, or a reply when `parentId` is set. */
    createComment: build.mutation<CommentResponse, { postId: string } & CreateCommentBody>({
      query: ({ postId, ...body }) => ({ url: `/posts/${postId}/comments`, method: "POST", body }),
      invalidatesTags: [POST_LISTS],
    }),
  }),
});

export const { useGetCommentsInfiniteQuery, useCreateCommentMutation } = commentsApi;

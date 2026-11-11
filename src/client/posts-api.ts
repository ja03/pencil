import type {
  CreatePostBody,
  FeedResponse,
  PostResponse,
  UpdatePostBody,
} from "@/contracts/posts";
import type { TagSuggestionsResponse } from "@/contracts/tags";
import { api } from "./api";

/**
 * Which list to page through, and the cursor its server-rendered first page
 * ended on. The cursor is part of the key, so each server render gets its own
 * cache entry and pages never mix across refreshes.
 */
export type PostListArg = { after: string; tag?: string };

const LIST = { type: "Post", id: "LIST" } as const;

/** Post endpoints. `Post` tags let lists (feed, My posts) refresh after a change. */
export const postsApi = api.enhanceEndpoints({ addTagTypes: ["Post"] }).injectEndpoints({
  endpoints: (build) => ({
    createPost: build.mutation<PostResponse, CreatePostBody>({
      query: (body) => ({ url: "/posts", method: "POST", body }),
      invalidatesTags: [LIST],
    }),
    updatePost: build.mutation<PostResponse, { id: string } & UpdatePostBody>({
      query: ({ id, ...body }) => ({ url: `/posts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Post", id }, LIST],
    }),
    publishPost: build.mutation<PostResponse, string>({
      query: (id) => ({ url: `/posts/${id}/publish`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Post", id }, LIST],
    }),
    /** The feed, or a tag page, after its server-rendered first page. */
    getFeed: build.infiniteQuery<FeedResponse, PostListArg, string>({
      infiniteQueryOptions: {
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: queryArg.tag ? `/tags/${encodeURIComponent(queryArg.tag)}/posts` : "/posts",
        params: { cursor: pageParam },
      }),
      providesTags: [LIST],
    }),
    /** Existing tags starting with the query, for the editor's autocomplete. */
    searchTags: build.query<TagSuggestionsResponse, string>({
      query: (q) => ({ url: "/tags", params: { q } }),
      keepUnusedDataFor: 30,
    }),
  }),
});

export const {
  useCreatePostMutation,
  useUpdatePostMutation,
  usePublishPostMutation,
  useGetFeedInfiniteQuery,
  useSearchTagsQuery,
} = postsApi;

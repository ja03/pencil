import type {
  CreatePostBody,
  FeedResponse,
  PostResponse,
  UpdatePostBody,
} from "@/contracts/posts";
import { api } from "./api";

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
    /**
     * The feed after its server-rendered first page. The argument is the
     * cursor that page ended on, so each server render gets its own cache
     * entry and pages never mix across refreshes.
     */
    getFeed: build.infiniteQuery<FeedResponse, string, string>({
      infiniteQueryOptions: {
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({ url: "/posts", params: { cursor: pageParam } }),
      providesTags: [LIST],
    }),
  }),
});

export const {
  useCreatePostMutation,
  useUpdatePostMutation,
  usePublishPostMutation,
  useGetFeedInfiniteQuery,
} = postsApi;

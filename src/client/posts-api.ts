import type { CreatePostBody, PostResponse, UpdatePostBody } from "@/contracts/posts";
import { api } from "./api";

/** Post endpoints. `Post` tags let later lists (feed, My posts) refresh after a save. */
export const postsApi = api.enhanceEndpoints({ addTagTypes: ["Post"] }).injectEndpoints({
  endpoints: (build) => ({
    createPost: build.mutation<PostResponse, CreatePostBody>({
      query: (body) => ({ url: "/posts", method: "POST", body }),
      invalidatesTags: [{ type: "Post", id: "LIST" }],
    }),
    updatePost: build.mutation<PostResponse, { id: string } & UpdatePostBody>({
      query: ({ id, ...body }) => ({ url: `/posts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Post", id },
        { type: "Post", id: "LIST" },
      ],
    }),
  }),
});

export const { useCreatePostMutation, useUpdatePostMutation } = postsApi;

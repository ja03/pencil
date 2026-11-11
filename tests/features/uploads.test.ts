import { describe, expect, it } from "vitest";
import { POST as upload } from "@/app/api/uploads/route";
import { MAX_UPLOAD_BYTES } from "@/contracts/uploads";
import { env } from "@/server/env";
import { signedIn } from "../helpers/auth";
import { IMAGE_BYTES, imageForm, keyOf, padded, storedKeys, storedObject } from "../helpers/images";
import { call } from "../helpers/request";

function send(body: unknown, headers: Record<string, string> = {}) {
  return call(upload, { method: "POST", path: "/api/uploads", body, headers });
}

describe("POST /api/uploads", () => {
  it.each([
    ["PNG", IMAGE_BYTES.png, "image/png", "png"],
    ["JPEG", IMAGE_BYTES.jpeg, "image/jpeg", "jpg"],
    ["WebP", IMAGE_BYTES.webp, "image/webp", "webp"],
  ])("stores a %s in the bucket and returns its public URL", async (_, head, type, ext) => {
    // Unverified users write drafts, so they can upload images for them too.
    const { user, headers } = await signedIn({ verified: false });
    const bytes = padded(head, 2048);

    const res = await send(imageForm(bytes, `photo.${ext}`, type), headers);

    expect(res.status).toBe(201);
    expect(res.body.upload).toEqual({
      url: expect.stringMatching(
        new RegExp(`^${env().S3_PUBLIC_URL}/images/${user.id}/[0-9a-f-]{36}\\.${ext}$`),
      ),
      contentType: type,
      size: 2048,
    });
    const stored = await storedObject(keyOf(res.body.upload.url));
    expect(stored.contentType).toBe(type);
    expect(stored.bytes).toEqual(bytes);
  });

  it("serves the stored image publicly at the returned URL", async () => {
    const { headers } = await signedIn();
    const bytes = padded(IMAGE_BYTES.png, 512);

    const res = await send(imageForm(bytes), headers);
    const image = await fetch(res.body.upload.url);

    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
  });

  it("gives every upload its own URL, even for the same file", async () => {
    const { headers } = await signedIn();
    const bytes = padded(IMAGE_BYTES.png, 64);

    const first = await send(imageForm(bytes), headers);
    const second = await send(imageForm(bytes), headers);

    expect(first.body.upload.url).not.toBe(second.body.upload.url);
  });

  it("detects the type from the bytes, not the name or the claimed type", async () => {
    const { headers } = await signedIn();

    const res = await send(imageForm(padded(IMAGE_BYTES.webp, 64), "photo.png", "image/png"), headers);

    expect(res.status).toBe(201);
    expect(res.body.upload.contentType).toBe("image/webp");
    expect(res.body.upload.url).toMatch(/\.webp$/);
  });

  it.each([
    ["text", new TextEncoder().encode("just some text, not an image")],
    ["an HTML page", new TextEncoder().encode("<html><script>alert(1)</script></html>")],
    ["an SVG", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["a GIF", new TextEncoder().encode("GIF89a\x01\x00\x01\x00")],
  ])("rejects %s named .png with a valid image type and stores nothing", async (_, bytes) => {
    const { user, headers } = await signedIn();

    const res = await send(imageForm(bytes, "photo.png", "image/png"), headers);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_FAILED",
      message: "Upload a JPEG, PNG or WebP image.",
      fields: { file: ["Upload a JPEG, PNG or WebP image."] },
    });
    expect(await storedKeys(`images/${user.id}/`)).toEqual([]);
  });

  it("accepts an image of exactly 5 MB", async () => {
    const { headers } = await signedIn();

    const res = await send(imageForm(padded(IMAGE_BYTES.jpeg, MAX_UPLOAD_BYTES)), headers);

    expect(res.status).toBe(201);
    expect(res.body.upload.size).toBe(MAX_UPLOAD_BYTES);
  });

  it("rejects an image over 5 MB with a clear message and stores nothing", async () => {
    const { user, headers } = await signedIn();

    const res = await send(imageForm(padded(IMAGE_BYTES.jpeg, MAX_UPLOAD_BYTES + 1)), headers);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_FAILED",
      message: "Images must be 5 MB or smaller.",
      fields: { file: ["Images must be 5 MB or smaller."] },
    });
    expect(await storedKeys(`images/${user.id}/`)).toEqual([]);
  });

  it("rejects a request body far over the limit without reading it all", async () => {
    const { headers } = await signedIn();

    const res = await send(imageForm(padded(IMAGE_BYTES.png, 3 * MAX_UPLOAD_BYTES)), headers);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Images must be 5 MB or smaller.");
  });

  it("returns 401 when nobody is signed in", async () => {
    const res = await send(imageForm(padded(IMAGE_BYTES.png, 64)));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a form without a file", async () => {
    const { headers } = await signedIn();
    const form = new FormData();
    form.set("file", "not a file");

    const res = await send(form, headers);

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ file: ["Choose an image to upload."] });
  });

  it("rejects a body that isn't multipart form data", async () => {
    const { headers } = await signedIn();

    const res = await send({ file: "photo.png" }, headers);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

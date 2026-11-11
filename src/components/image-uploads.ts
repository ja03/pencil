import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { Extension, type Editor } from "@tiptap/react";
import { uploadImage, UploadError } from "@/client/upload-image";
import { isUnderImageBase } from "@/contracts/post-content";
import { IMAGE_TYPES } from "@/contracts/uploads";

// Inline images upload the moment they're inserted. While a file uploads, a
// placeholder widget holds its place in the document (as drawn in the UI
// Design: "Uploading name…" and a progress bar); it isn't part of the saved
// content, and it moves with the text around it as the author keeps typing.
// When the upload finishes, the image node replaces the placeholder.

type Placeholder = { id: string; pos: number; dom: HTMLElement };
type Meta = { add: Placeholder } | { remove: string };

const key = new PluginKey<DecorationSet>("image-uploads");

function placeholderPos(state: EditorState, id: string): number | null {
  const found = key.getState(state)?.find(undefined, undefined, (spec) => spec.id === id);
  return found?.[0]?.from ?? null;
}

function placeholderDom(fileName: string): { dom: HTMLElement; bar: HTMLElement } {
  const dom = document.createElement("div");
  dom.className = "upload-placeholder";
  dom.setAttribute("role", "status");
  dom.contentEditable = "false";
  const label = document.createElement("span");
  label.textContent = `Uploading ${fileName}…`;
  const track = document.createElement("span");
  track.className = "upload-placeholder-track";
  const bar = document.createElement("span");
  bar.className = "upload-placeholder-bar";
  track.append(bar);
  dom.append(label, track);
  return { dom, bar };
}

export type ImageUploadHandlers = {
  /** An upload started or ended; the editor shows "Uploading…" meanwhile. */
  onBusyChange(delta: 1 | -1): void;
  onError(error: UploadError): void;
};

/**
 * Uploads `file` and inserts it as an image at `pos`, holding the place with
 * a placeholder until the upload finishes. Errors go to `handlers.onError`
 * and leave the document as it was.
 */
export async function insertUploadedImage(
  editor: Editor,
  file: File,
  pos: number,
  handlers: ImageUploadHandlers,
) {
  const id = crypto.randomUUID();
  const { dom, bar } = placeholderDom(file.name);
  editor.view.dispatch(editor.state.tr.setMeta(key, { add: { id, pos, dom } } satisfies Meta));
  handlers.onBusyChange(1);
  try {
    const upload = await uploadImage(file, (fraction) => {
      bar.style.width = `${Math.round(fraction * 100)}%`;
    });
    if (editor.isDestroyed) return;
    const at = placeholderPos(editor.state, id);
    // The placeholder's text may have been deleted meanwhile; then so is the image.
    if (at === null) return;
    // If the cursor is still where the image goes, continue typing after it.
    // If the author moved on while it uploaded, leave their cursor alone.
    const { empty, from } = editor.state.selection;
    const continueAfter = empty && from === at;
    editor
      .chain()
      .command(({ tr }) => {
        tr.setMeta(key, { remove: id } satisfies Meta);
        return true;
      })
      .insertContentAt(
        at,
        { type: "image", attrs: { src: upload.url } },
        { updateSelection: continueAfter },
      )
      .command(({ tr, state }) => {
        // Inserting leaves the image itself selected, so the next keystroke
        // would replace it; put a text cursor after it instead, adding an
        // empty paragraph when the image is the last thing in the post.
        if (!continueAfter || !(tr.selection instanceof NodeSelection)) return true;
        const end = tr.selection.to;
        let cursor = Selection.findFrom(tr.doc.resolve(end), 1, true);
        if (!cursor) {
          tr.insert(end, state.schema.nodes.paragraph.create());
          cursor = TextSelection.create(tr.doc, end + 1);
        }
        tr.setSelection(cursor);
        return true;
      })
      .run();
  } catch (error) {
    if (!editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta(key, { remove: id } satisfies Meta));
    }
    handlers.onError(
      error instanceof UploadError ? error : new UploadError("Couldn't upload the image."),
    );
  } finally {
    handlers.onBusyChange(-1);
  }
}

const isImageFile = (file: File) => (IMAGE_TYPES as readonly string[]).includes(file.type);

function imageFilesOf(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(isImageFile);
}

/**
 * Pasted HTML can carry images from other sites, which posts can't hold
 * (no tracking pixels). Keep only those already in Pencil's storage.
 */
function dropForeignImages(html: string, imageBase: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    if (!isUnderImageBase(img.getAttribute("src") ?? "", imageBase)) img.remove();
  }
  return doc.body.innerHTML;
}

type Options = { imageBase: string; handlers: ImageUploadHandlers };

/**
 * Upload placeholders, plus pasting and dropping image files into the editor.
 * Configure with Pencil's storage address and the editor's handlers.
 */
export const ImageUploads = Extension.create<Options>({
  name: "imageUploads",

  addOptions() {
    return {
      imageBase: "",
      handlers: { onBusyChange: () => {}, onError: () => {} },
    };
  },

  addProseMirrorPlugins() {
    const { imageBase, handlers } = this.options;
    const editor = this.editor;
    const upload = (files: File[], pos: number) => {
      for (const file of files) void insertUploadedImage(editor, file, pos, handlers);
    };

    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(key) as Meta | undefined;
            if (meta && "add" in meta) {
              const { id, pos, dom } = meta.add;
              next = next.add(tr.doc, [Decoration.widget(pos, dom, { id })]);
            } else if (meta && "remove" in meta) {
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === meta.remove));
            }
            return next;
          },
        },
        props: {
          decorations: (state) => key.getState(state),
          transformPastedHTML: (html) => dropForeignImages(html, imageBase),
          handlePaste(view: EditorView, event: ClipboardEvent) {
            const files = imageFilesOf(event.clipboardData?.files);
            if (files.length === 0) return false;
            upload(files, view.state.selection.from);
            return true;
          },
          handleDrop(view: EditorView, event: DragEvent) {
            const files = imageFilesOf(event.dataTransfer?.files);
            if (files.length === 0) return false;
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            upload(files, at?.pos ?? view.state.selection.from);
            return true;
          },
        },
      }),
    ];
  },
});

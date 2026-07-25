import clipboard from "clipboardy";

/**
 * Copies text to the system clipboard.
 *
 * Clipboard access is unavailable on headless machines, so failure is reported
 * as a value instead of an exception: a tunnel session must never end because
 * the URL could not be copied.
 */
export type ClipboardWriter = (text: string) => Promise<boolean>;

/**
 * Copies `text` to the system clipboard.
 *
 * @param text - Content to place on the clipboard.
 * @returns `true` when the copy succeeded, `false` when clipboard access failed.
 */
export const copyToClipboard: ClipboardWriter = async (text) => {
  try {
    await clipboard.write(text);
    return true;
  } catch {
    return false;
  }
};

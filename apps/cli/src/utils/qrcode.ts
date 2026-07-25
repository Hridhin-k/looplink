import qrcode from "qrcode-terminal";

/**
 * Renders text as a terminal-drawable QR code.
 */
export type QrCodeRenderer = (text: string) => Promise<string>;

/**
 * Renders `text` as a compact QR code block.
 *
 * @param text - Content to encode, typically the public tunnel URL.
 * @returns The QR code as printable terminal text.
 */
export const renderQrCode: QrCodeRenderer = (text) =>
  new Promise<string>((resolve) => {
    qrcode.generate(text, { small: true }, (code) => {
      resolve(code);
    });
  });

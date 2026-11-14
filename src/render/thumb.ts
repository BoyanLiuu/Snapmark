const WIDTH = 256;

/** A small copy for the library list, made once when an image is first kept. */
export const makeThumb = (bitmap: ImageBitmap) => {
  const scale = Math.min(1, WIDTH / bitmap.width);
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  );
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
};

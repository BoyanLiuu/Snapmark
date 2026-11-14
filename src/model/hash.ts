/** SHA-256 of an image's bytes, in hex: its key in this browser, whatever the file is called. */
export const hashBlob = async (blob: Blob) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

/** The first 12 hex digits, as the address shows them. */
export const shortKey = (hash: string) => hash.slice(0, 12);

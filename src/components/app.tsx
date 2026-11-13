"use client";

import { useState } from "react";
import type { LoadedImage } from "@/model/image";
import { EditorShell } from "./editor/editor-shell";
import { OpenScreen } from "./open/open-screen";

interface Session {
  image: LoadedImage;
  /** The sample photo, shown with the design file's sample layers. */
  sample: boolean;
}

/** Open an image, then annotate it. Hash routes replace this switch in M10. */
export const App = () => {
  const [session, setSession] = useState<Session | null>(null);

  const close = () => {
    // Frames drawn after this skip a closed bitmap (render/image.ts).
    session?.image.bitmap.close();
    setSession(null);
  };

  return session ? (
    <EditorShell
      image={session.image}
      sample={session.sample}
      onClose={close}
    />
  ) : (
    <OpenScreen onOpen={(image, sample) => setSession({ image, sample })} />
  );
};

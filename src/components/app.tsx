"use client";

import { ExportPage } from "./export/export-page";
import { EditorShell } from "./editor/editor-shell";
import { NotInBrowser } from "./open/not-in-browser";
import { OpenScreen } from "./open/open-screen";
import { useSession } from "./use-session";

/** Open an image, annotate it, export it: one page, addressed by the hash. */
export const App = () => {
  const {
    route,
    session,
    refusal,
    editing,
    recovery,
    openFile,
    openSample,
    home,
  } = useSession();

  // An image still being hashed has no address yet, so it shows over the open page's.
  if (!session || (route.page === "open" && session.key !== null))
    return (
      <OpenScreen refusal={refusal} onFile={openFile} onSample={openSample} />
    );
  if (session.state === "finding") return null;
  if (session.state === "missing")
    return <NotInBrowser address={session.key} onOpen={home} />;
  if (route.page === "export")
    return <ExportPage session={session} onHome={home} />;
  return (
    <EditorShell
      session={session}
      editing={editing}
      recovery={recovery}
      onHome={home}
    />
  );
};

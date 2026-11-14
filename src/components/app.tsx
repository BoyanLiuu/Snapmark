"use client";

import { ExportPage } from "./export/export-page";
import { EditorShell } from "./editor/editor-shell";
import { NoPage, NotInBrowser } from "./open/dead-ends";
import { OpenScreen } from "./open/open-screen";
import { useSession } from "./use-session";

/** Open an image, annotate it, export it: one page, addressed by the hash. */
export const App = () => {
  const { route, session, refusal, openFile, openSample, home } = useSession();

  if (route.page === "nowhere") return <NoPage onOpen={home} />;
  if (route.page === "missing")
    return <NotInBrowser address={route.key} onOpen={home} />;
  // An image still being hashed has no address yet, so it shows over the open page's.
  if (!session || (route.page === "open" && session.key !== null))
    return (
      <OpenScreen
        route={route}
        refusal={refusal}
        onFile={openFile}
        onSample={openSample}
      />
    );
  if (session.state === "finding") return null;
  if (session.state === "missing")
    return <NotInBrowser address={session.key} onOpen={home} />;
  if (route.page === "export")
    return <ExportPage route={route} session={session} onHome={home} />;
  // Keyed, so each image starts with its own tool, selection and state from the address.
  return (
    <EditorShell
      key={session.key}
      route={route}
      session={session}
      onHome={home}
    />
  );
};

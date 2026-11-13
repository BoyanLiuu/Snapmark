import { SAMPLE } from "@/model/sample";

/** The sample photo's credit. CC0 asks for none; the photographer gets one anyway. */
export const SampleCredit = ({ className }: { className?: string }) => {
  const { title, author, source, licence, licenceUrl } = SAMPLE.credit;
  const link = "underline underline-offset-2 hover:text-foreground";
  return (
    <p className={className}>
      Sample photo:{" "}
      <a className={link} href={source} target="_blank" rel="noreferrer">
        {title}
      </a>{" "}
      by {author}, Unsplash via Wikimedia Commons,{" "}
      <a className={link} href={licenceUrl} target="_blank" rel="noreferrer">
        {licence}
      </a>
      .
    </p>
  );
};

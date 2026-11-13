import type { Doc } from "@/model/types";

// Spelled out, not Intl: en-GB writes "Sept" in newer ICU versions, and browsers differ.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const two = (n: number) => String(n).padStart(2, "0");

/** "12 Nov 2026, 09:41 UTC", as the design file writes times. */
export const formatWhen = (d: Date) =>
  `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;

/** The status line under the stage: what is on the image and when it last changed. */
export const statusLine = (doc: Doc) => {
  const n = doc.order.length;
  if (n === 0 || !doc.editedAt)
    return `Nothing drawn yet. Opened ${formatWhen(doc.openedAt)}.`;
  return `${n} annotation${n === 1 ? "" : "s"}, last edited ${formatWhen(doc.editedAt)}.`;
};

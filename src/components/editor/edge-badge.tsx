import { Button } from "@/components/ui/button";

/** Screen 19: annotations run past the image's edge, and the PNG will cut them off. */
export const EdgeBadge = ({
  count,
  onSelect,
}: {
  count: number;
  onSelect: () => void;
}) => (
  <div
    role="status"
    className="absolute top-4 left-4 z-10 flex items-center gap-4 border border-primary bg-background py-1 pr-1 pl-4 text-sm before:size-1.5 before:shrink-0 before:bg-primary"
  >
    <p>
      {count === 1 ? "1 annotation runs" : `${count} annotations run`} past the
      edge. The PNG cuts {count === 1 ? "it" : "them"} off.
    </p>
    <Button variant="outline" size="control" onClick={onSelect}>
      {count === 1 ? "Select it" : "Select them"}
    </Button>
  </div>
);

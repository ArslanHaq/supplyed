import { useState } from "react";
import { useApplicationHistory } from "@/features/applications/use-applications";
import { statusLabel } from "@/features/applications/status";
import { Btn } from "../atoms";
export function ApplicationHistory({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const history = useApplicationHistory(id, open);
  return (
    <div className="mt-3">
      <Btn size="sm" variant="ghost" onClick={() => setOpen(!open)}>
        {open ? "Hide history" : "Status history"}
      </Btn>
      {open ? (
        <div className="mt-2 border-l-2 border-border pl-4 text-sm" aria-live="polite">
          {history.isLoading ? (
            <p>Loading history...</p>
          ) : history.isError ? (
            <p role="alert">
              History could not be loaded. <button onClick={() => void history.refetch()}>Retry</button>
            </p>
          ) : (
            <ol className="space-y-2">
              {history.data?.map((item) => (
                <li key={item.id}>
                  <strong className="capitalize">{statusLabel(item.toStatus)}</strong>
                  <span className="ml-2 text-muted">{new Date(item.createdAt).toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}

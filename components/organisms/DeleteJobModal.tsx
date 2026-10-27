import type { Job } from "@/features/jobs/types";

import { Btn, Tag } from "../atoms";
import { Modal } from "../molecules";

export function DeleteJobModal({ job, onClose, onConfirm, pending }: {
  job: Job | null;
  onClose: () => void;
  onConfirm: (job: Job) => void;
  pending: boolean;
}) {
  return (
    <Modal label="Delete job" open={job?.canDelete === true} onClose={() => { if (!pending) onClose(); }}>
      <div className="p-6 sm:p-7">
        <Tag tone="red">Delete job</Tag>
        <h2 className="mt-4 break-words font-heading text-2xl">Delete {job?.title}?</h2>
        <p className="mt-3 text-sm leading-6 text-muted">This cannot be undone.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={pending} onClick={onClose} variant="secondary">Keep job</Btn>
          <Btn loading={pending} loadingLabel="Deleting" onClick={() => { if (job?.canDelete === true) onConfirm(job); }} variant="danger">Delete job</Btn>
        </div>
      </div>
    </Modal>
  );
}

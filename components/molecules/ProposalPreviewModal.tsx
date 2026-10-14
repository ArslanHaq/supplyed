"use client";

import { useState } from "react";

import { Avatar, Btn, Icon } from "../atoms";
import { Modal } from "./Modal";
import { ProposalContent } from "./ProposalContent";

type ProposalDetails = {
  applicantName: string;
  applicantImage?: string | null;
  jobTitle?: string | null;
  schoolName?: string | null;
  submittedAt?: string | null;
  value: string;
};

export type ProposalPreviewModalProps = ProposalDetails & {
  onClose: () => void;
  open: boolean;
};

/** The complete proposal always uses the same sanitised renderer as the page. */
export function ProposalPreviewModal({
  applicantImage,
  applicantName,
  jobTitle,
  onClose,
  open,
  schoolName,
  submittedAt,
  value,
}: ProposalPreviewModalProps) {
  const timestamp = submittedAt ? Date.parse(submittedAt) : Number.NaN;
  const submittedLabel = Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp))
    : null;

  return (
    <Modal label={`Proposal from ${applicantName}`} onClose={onClose} open={open} size="xl">
      <article className="proposal-reader">
        <header className="proposal-reader-header">
          <div className="proposal-reader-title-row">
            <div><p className="proposal-reader-eyebrow">Application proposal</p><h2>Full proposal</h2></div>
            <button aria-label="Close full proposal" className="proposal-reader-close" onClick={onClose} type="button"><Icon name="x" size={19} /></button>
          </div>
          <div className="proposal-reader-identity">
            <Avatar name={applicantName} src={applicantImage} />
            <div><strong>{applicantName}</strong>{jobTitle ? <p>{jobTitle}</p> : null}{schoolName ? <span>{schoolName}</span> : null}</div>
          </div>
        </header>
        <div aria-label="Full proposal text" className="proposal-reader-body" role="region" tabIndex={0}>
          <div className="proposal-reader-paper"><ProposalContent className="proposal-reader-content" value={value} /></div>
        </div>
        <footer className="proposal-reader-footer">
          <p><Icon name="file" size={14} />{submittedLabel ? <>Submitted <time dateTime={submittedAt ?? undefined}>{submittedLabel}</time></> : "Application proposal"}</p>
          <Btn onClick={onClose} variant="secondary">Close proposal</Btn>
        </footer>
      </article>
    </Modal>
  );
}

/** A bounded excerpt keeps application details compact without hiding access to the full text. */
export function ProposalPreview({ title = "Proposal", ...details }: ProposalDetails & { title?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section aria-label={title} className="proposal-preview-card">
        <div className="proposal-preview-heading">
          <div><span className="proposal-preview-icon"><Icon name="file" size={18} /></span><h3>{title}</h3></div>
          <Btn aria-haspopup="dialog" className="proposal-preview-open" icon="eye" onClick={() => setOpen(true)} variant="secondary">View full proposal</Btn>
        </div>
        <ProposalContent className="proposal-preview-excerpt line-clamp-3" preview value={details.value} />
      </section>
      <ProposalPreviewModal {...details} onClose={() => setOpen(false)} open={open} />
    </>
  );
}

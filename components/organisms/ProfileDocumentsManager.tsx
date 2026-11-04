"use client";

import { useRef, useState } from "react";
import {
  useCreateProfileDocument,
  useDeleteProfileDocument,
  useProfileDocuments,
  useUpdateProfileDocument,
  useUploadProfileDocument,
} from "@/features/profile-documents/use-profile-documents";
import type { ProfileDocument, ProfileDocumentInput } from "@/features/profile-documents/types";
import type { AppRole, RouteProps } from "@/types/supplyed";
import { Btn, Field, Icon } from "../atoms";
import { SectionLoader } from "../molecules";

const fileTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxBytes = 10 * 1024 * 1024;
const emptyDraft: ProfileDocumentInput = { title: "", description: "", issueDate: "" };

export function ProfileDocumentsManager({ role, toast }: { role: AppRole; toast: RouteProps["toast"] }) {
  const query = useProfileDocuments();
  const create = useCreateProfileDocument();
  const update = useUpdateProfileDocument();
  const remove = useDeleteProfileDocument();
  const upload = useUploadProfileDocument();
  const newFileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [newFile, setNewFile] = useState<File>();
  const [newProgress, setNewProgress] = useState<number>();
  const [editing, setEditing] = useState<string>();
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const noun = role === "teacher" ? "certificate" : "achievement";
  const title = role === "teacher" ? "Certificates" : "Achievements and accreditations";

  async function add() {
    if (!newFile) return toast({ title: "Choose a file", msg: `Add an image or document for this ${noun}.`, tone: "danger" });
    const validationError = fileError(newFile);
    if (validationError) return toast({ title: "File not accepted", msg: validationError, tone: "danger" });

    const created = await create.mutateAsync(draft);
    if (!created.ok) return toast({ title: `Could not add ${noun}`, msg: created.message, tone: "danger" });

    setNewProgress(0);
    try {
      const uploaded = await upload.mutateAsync({ file: newFile, id: created.data.id, onProgress: setNewProgress });
      if (!uploaded.ok) {
        await remove.mutateAsync(created.data.id).catch(() => undefined);
        return toast({ title: "Upload failed", msg: uploaded.message, tone: "danger" });
      }
      setDraft(emptyDraft);
      setNewFile(undefined);
      if (newFileInput.current) newFileInput.current.value = "";
      toast({ title: `${capitalize(noun)} added`, msg: "The image or document is now visible on your profile.", tone: "success" });
    } catch (error) {
      await remove.mutateAsync(created.data.id).catch(() => undefined);
      toast({ title: "Upload failed", msg: error instanceof Error ? error.message : "Try again.", tone: "danger" });
    } finally {
      setNewProgress(undefined);
    }
  }

  async function save(id: string) {
    const result = await update.mutateAsync({ id, input: editDraft });
    if (!result.ok) return toast({ title: "Could not save changes", msg: result.message, tone: "danger" });
    setEditing(undefined);
    toast({ title: "Changes saved", msg: `Your ${noun} was updated.`, tone: "success" });
  }

  async function deleteItem(document: ProfileDocument) {
    if (!window.confirm(`Delete “${document.title}” and its uploaded file?`)) return;
    const result = await remove.mutateAsync(document.id);
    toast(result.ok
      ? { title: `${capitalize(noun)} deleted`, msg: "The file was removed from your profile.", tone: "success" }
      : { title: "Could not delete", msg: result.message, tone: "danger" });
  }

  async function uploadFile(document: ProfileDocument, file?: File) {
    if (!file) return;
    const validationError = fileError(file);
    if (validationError) return toast({ title: "File not accepted", msg: validationError, tone: "danger" });
    setProgress((current) => ({ ...current, [document.id]: 0 }));
    try {
      const result = await upload.mutateAsync({ file, id: document.id, onProgress: (value) => setProgress((current) => ({ ...current, [document.id]: value })) });
      if (!result.ok) return toast({ title: "Upload failed", msg: result.message, tone: "danger" });
      toast({ title: "File uploaded", msg: `${document.title} is now visible on your profile.`, tone: "success" });
    } catch (error) {
      toast({ title: "Upload failed", msg: error instanceof Error ? error.message : "Try again.", tone: "danger" });
    } finally {
      setProgress((current) => { const next = { ...current }; delete next[document.id]; return next; });
    }
  }

  return (
    <section className="card card-pad-lg" id="profile-documents">
      <div className="mb-6 flex items-start gap-3 border-b border-border pb-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand"><Icon name="award" size={19} /></div>
        <div><h2 className="font-heading text-xl font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-muted">Add documents that visitors can view on your public profile.</p></div>
      </div>

      <DocumentFields draft={draft} onChange={setDraft} />
      <Field label={`${capitalize(noun)} image or document`} required hint="PDF, Word, JPG, PNG or WebP, up to 10 MB.">
        <input ref={newFileInput} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" className="input" onChange={(event) => setNewFile(event.target.files?.[0])} type="file" />
      </Field>
      {newFile ? <p className="mb-3 flex items-center gap-2 text-sm text-slate"><Icon name="file" size={15} />{newFile.name}</p> : null}
      {newProgress !== undefined ? <UploadProgress value={newProgress} /> : null}
      <Btn disabled={!draft.title.trim() || !newFile} loading={create.isPending || newProgress !== undefined} loadingLabel="Uploading" onClick={add} size="sm" icon="plus">Add {noun}</Btn>

      <div className="mt-7 space-y-4">
        {query.isLoading ? <SectionLoader rows={2} /> : null}
        {query.isError ? <div className="rounded-lg bg-danger-tint p-4 text-sm text-danger">Documents could not be loaded. <button className="font-semibold underline" onClick={() => void query.refetch()} type="button">Try again</button></div> : null}
        {query.data?.length === 0 ? <p className="rounded-lg bg-chalk p-4 text-sm text-muted">No {noun}s added yet.</p> : null}
        {query.data?.map((document) => {
          const isEditing = editing === document.id;
          const uploadProgress = progress[document.id];
          return <article className="rounded-xl border border-border p-4" key={document.id}>
            {document.fileUrl && document.contentType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={document.title} className="mb-4 h-44 w-full rounded-lg border border-border object-cover sm:w-72" src={document.fileUrl} />
            ) : null}
            {isEditing ? <DocumentFields draft={editDraft} onChange={setEditDraft} /> : <div><h3 className="font-semibold text-ink">{document.title}</h3>{document.issueDate ? <p className="mt-1 text-xs text-muted">Issued {formatDate(document.issueDate)}</p> : null}{document.description ? <p className="mt-2 text-sm leading-6 text-slate">{document.description}</p> : null}</div>}
            {uploadProgress !== undefined ? <UploadProgress value={uploadProgress} /> : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isEditing ? <><Btn loading={update.isPending} onClick={() => save(document.id)} size="sm">Save</Btn><Btn onClick={() => setEditing(undefined)} size="sm" variant="ghost">Cancel</Btn></> : <Btn onClick={() => { setEditing(document.id); setEditDraft({ title: document.title, description: document.description ?? "", issueDate: document.issueDate?.slice(0, 10) ?? "" }); }} size="sm" variant="secondary">Edit details</Btn>}
              <label className="ui-button inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-chalk">
                {document.fileUrl ? "Replace file" : "Upload file"}
                <input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" className="sr-only" disabled={uploadProgress !== undefined} onChange={(event) => { void uploadFile(document, event.target.files?.[0]); event.currentTarget.value = ""; }} type="file" />
              </label>
              {document.fileUrl ? <a className="text-sm font-semibold text-brand hover:underline" href={document.fileUrl} rel="noreferrer" target="_blank">View file</a> : null}
              <Btn disabled={remove.isPending} onClick={() => void deleteItem(document)} size="sm" variant="danger">Delete</Btn>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}

function UploadProgress({ value }: { value: number }) {
  return <div className="my-4"><div className="mb-1 flex justify-between text-xs text-muted"><span>Uploading</span><span>{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-chalk"><div className="h-full bg-brand transition-[width]" style={{ width: `${value}%` }} /></div></div>;
}

function fileError(file: File) {
  if (!fileTypes.has(file.type) || file.size < 1 || file.size > maxBytes) {
    return "Choose a PDF, Word, JPG, PNG or WebP file up to 10 MB.";
  }
  return undefined;
}

function DocumentFields({ draft, onChange }: { draft: ProfileDocumentInput; onChange: (value: ProfileDocumentInput) => void }) {
  return <div className="grid gap-x-4 sm:grid-cols-2" onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}>
    <Field label="Title" required><input className="input" maxLength={120} onChange={(event) => onChange({ ...draft, title: event.target.value })} value={draft.title} /></Field>
    <Field label="Issue date (optional)"><input className="input" onChange={(event) => onChange({ ...draft, issueDate: event.target.value })} type="date" value={draft.issueDate ?? ""} /></Field>
    <div className="sm:col-span-2"><Field label="Description (optional)"><textarea className="textarea" maxLength={1000} onChange={(event) => onChange({ ...draft, description: event.target.value })} rows={3} value={draft.description ?? ""} /></Field></div>
  </div>;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const formatDate = (value: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

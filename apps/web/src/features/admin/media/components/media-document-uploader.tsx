
"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  CheckCircle2,
  CloudUpload,
  FileText,
  LoaderCircle,
} from "lucide-react";

import { uploadDocument } from "../lib/media-documents-api";

type Props = {
  onUploaded: () => void;
};

export function MediaDocumentUploader({
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(files: File[]) {
    if (busy || !files.length) return;

    if (files.length > 20) {
      setErrors(["Maximum 20 files per batch."]);
      return;
    }

    setBusy(true);
    setErrors([]);
    setSuccess("");

    const failures: string[] = [];
    let completed = 0;

    try {
      for (const file of files) {
        try {
          await uploadDocument(file);
          completed++;
        } catch (caught) {
          failures.push(
            `${file.name}: ${
              caught instanceof Error
                ? caught.message
                : "Upload failed"
            }`,
          );
        }
      }

      if (completed > 0) {
        setSuccess(
          `${completed} document(s) uploaded successfully.`,
        );

        onUploaded();
      }

      setErrors(failures);
    } finally {
      setBusy(false);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    void upload(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (!busy) {
      void upload(Array.from(event.dataTransfer.files));
    }
  }

  return (
    <section className="rounded-2xl border border-[#E6EAF3] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-[#EEEBFF] p-3">
          <FileText className="size-5 text-[#6D5DF6]" />
        </div>

        <div>
          <h2 className="text-base font-bold text-[#172444]">
            Upload Documents
          </h2>

          <p className="mt-1 text-xs text-[#8794AC]">
            PDF, TXT and CSV — Private Storage
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {errors.map((item, index) => (
            <p key={index} className="break-words">
              {item}
            </p>
          ))}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          <CheckCircle2 className="size-4" />
          {success}
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center ${
          dragging
            ? "border-[#6D5DF6] bg-[#EEEBFF]"
            : "border-[#E4E8F1] bg-[#FAFBFE]"
        }`}
      >
        <CloudUpload className="mx-auto size-10 text-[#6D5DF6]" />

        <h3 className="mt-4 text-sm font-semibold text-[#172444]">
          Drag and drop documents
        </h3>

        <p className="mt-2 text-xs text-[#8794AC]">
          PDF, TXT, CSV · Max 20 MB per file
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.csv"
          disabled={busy}
          onChange={onChange}
          className="sr-only"
          aria-label="Select documents"
        />

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <CloudUpload className="size-4" />
          )}

          {busy ? "Uploading..." : "Browse Documents"}
        </button>
      </div>
    </section>
  );
}

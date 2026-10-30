
"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  EditorContent,
  useEditor,
} from "@tiptap/react";

import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";

import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Undo2,
} from "lucide-react";

type Mode = "visual" | "html";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  maxLength: number;
  minHeight?: number;
  disabled?: boolean;
};

function ToolbarButton({
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        active
          ? "bg-[#EEEAFE] text-[#6554D8]"
          : "text-[#66748E] hover:bg-[#F1F3F8]"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProductRichTextEditor({
  value,
  onChange,
  label,
  maxLength,
  minHeight = 220,
  disabled = false,
}: Props) {
  const [mode, setMode] = useState<Mode>("visual");
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [error, setError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    ],

    content: value,

    immediatelyRender: false,

    editable: !disabled,

    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
        class:
          "min-h-[180px] max-w-none outline-none " +
          "[&_p]:mb-3 [&_p]:leading-7 " +
          "[&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold " +
          "[&_h3]:mb-3 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold " +
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 " +
          "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-[#6D5DF6] " +
          "[&_blockquote]:pl-4 [&_blockquote]:italic " +
          "[&_a]:text-[#6554D8] [&_a]:underline " +
          "[&_pre]:overflow-x-auto [&_pre]:rounded-lg " +
          "[&_pre]:bg-[#F3F4F8] [&_pre]:p-3",
      },
    },

    onUpdate: ({ editor: instance }) => {
      const next = instance.getHTML();

      if (next.length > maxLength) {
        setError(
          `Maximum length is ${maxLength.toLocaleString("en-US")} characters.`,
        );
        return;
      }

      setError("");
      onChange(next);
    },
  });

  // Product data can arrive asynchronously on Edit pages.
  useEffect(() => {
    if (!editor || mode !== "visual") return;

    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, {
        emitUpdate: false,
      });
    }
  }, [editor, value, mode]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  function switchMode(next: Mode) {
    if (next === mode) return;

    if (next === "html") {
      setHtmlDraft(value);
      setError("");
      setMode("html");
      return;
    }

    if (htmlDraft.length > maxLength) {
      setError(
        `Maximum length is ${maxLength.toLocaleString("en-US")} characters.`,
      );
      return;
    }

    editor?.commands.setContent(htmlDraft, {
      emitUpdate: false,
    });

    const normalized = editor?.getHTML() ?? htmlDraft;

    if (normalized.length > maxLength) {
      setError("Content is too long.");
      return;
    }

    onChange(normalized);
    setError("");
    setMode("visual");
  }

  function updateHtml(next: string) {
    if (next.length > maxLength) {
      setError("Content is too long.");
      return;
    }

    setHtmlDraft(next);
    onChange(next);
    setError("");
  }

  function insertLink() {
    if (!editor) return;

    const current =
      editor.getAttributes("link").href as string | undefined;

    const entered = window.prompt(
      "Enter an HTTPS URL or email link:",
      current ?? "https://",
    );

    if (entered === null) return;

    const href = entered.trim();

    if (!href) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    if (
      !/^https:\/\/[^\s]+$/i.test(href) &&
      !/^mailto:[^\s@]+@[^\s@]+$/i.test(href)
    ) {
      setError("Only HTTPS and mailto links are allowed.");
      return;
    }

    setError("");

    editor.chain().focus().extendMarkRange("link").setLink({
      href,
      target: "_blank",
    }).run();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E3E8F2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8ECF4] bg-[#FAFBFD] px-3 py-2">
        <div
          role="group"
          aria-label={`${label} editing mode`}
          className="flex rounded-lg border border-[#E5E9F2] bg-white p-0.5"
        >
          <button
            type="button"
            aria-pressed={mode === "visual"}
            onClick={() => switchMode("visual")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === "visual"
                ? "bg-[#EEEAFE] text-[#6554D8]"
                : "text-[#71809B]"
            }`}
          >
            Visual
          </button>

          <button
            type="button"
            aria-pressed={mode === "html"}
            onClick={() => switchMode("html")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === "html"
                ? "bg-[#EEEAFE] text-[#6554D8]"
                : "text-[#71809B]"
            }`}
          >
            <Code2 className="size-3.5" />
            HTML
          </button>
        </div>

        <span className="text-[11px] text-[#95A1B5]">
          {value.length.toLocaleString("en-US")} /{" "}
          {maxLength.toLocaleString("en-US")}
        </span>
      </div>

      {mode === "visual" && (
        <div className="flex flex-wrap gap-0.5 border-b border-[#E8ECF4] px-2 py-2">
          <ToolbarButton
            title="Bold"
            active={editor?.isActive("bold")}
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Italic"
            active={editor?.isActive("italic")}
            disabled={!editor || disabled}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Heading 2"
            active={editor?.isActive("heading", { level: 2 })}
            disabled={!editor || disabled}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Heading 3"
            active={editor?.isActive("heading", { level: 3 })}
            disabled={!editor || disabled}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Bullet List"
            active={editor?.isActive("bulletList")}
            disabled={!editor || disabled}
            onClick={() =>
              editor?.chain().focus().toggleBulletList().run()
            }
          >
            <List className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Numbered List"
            active={editor?.isActive("orderedList")}
            disabled={!editor || disabled}
            onClick={() =>
              editor?.chain().focus().toggleOrderedList().run()
            }
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Blockquote"
            active={editor?.isActive("blockquote")}
            disabled={!editor || disabled}
            onClick={() =>
              editor?.chain().focus().toggleBlockquote().run()
            }
          >
            <Quote className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Insert Link"
            disabled={!editor || disabled}
            onClick={insertLink}
          >
            <Link2 className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Clear Formatting"
            disabled={!editor || disabled}
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <RemoveFormatting className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Undo"
            disabled={!editor || disabled || !editor.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </ToolbarButton>

          <ToolbarButton
            title="Redo"
            disabled={!editor || disabled || !editor.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </ToolbarButton>
        </div>
      )}

      <div
        className="px-4 py-4 text-sm leading-7 text-[#293955] [&_.tiptap]:outline-none"
        style={{ minHeight }}
      >
        {mode === "visual" ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            value={htmlDraft}
            onChange={(event) => updateHtml(event.target.value)}
            disabled={disabled}
            aria-label={`${label} HTML source`}
            spellCheck={false}
            style={{
              minHeight: Math.max(150, minHeight - 32),
            }}
            className="w-full resize-y bg-transparent font-mono text-xs leading-6 outline-none"
            placeholder="<p>Write your HTML here...</p>"
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="border-t border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}

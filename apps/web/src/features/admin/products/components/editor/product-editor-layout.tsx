
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Boxes,
  FileText,
  Layers,
  Package,
  Search,
  Settings2,
  Truck,
} from "lucide-react";

export type EditorTab =
  | "general"
  | "inventory"
  | "shipping"
  | "linked"
  | "attributes"
  | "variations"
  | "advanced"
  | "seo";

const NAVIGATION = [
  { id: "general", label: "General", icon: Box },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "linked", label: "Linked Products", icon: Boxes },
  { id: "attributes", label: "Attributes", icon: Layers },
  { id: "variations", label: "Variations", icon: Layers },
  { id: "advanced", label: "Advanced", icon: Settings2 },
  { id: "seo", label: "SEO", icon: Search },
] as const;

export function EditorPanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E6EAF3] bg-white shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#EDF0F6] px-5 py-4">
        <h2 className="text-sm font-bold text-[#172444]">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EditorField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-[#465575]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] leading-5 text-[#8B97AC]">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ProductEditorLayout({
  editing,
  name,
  tab,
  onTabChange,
  variable,
  generalContent,
  descriptionContent,
  shortDescriptionContent,
  tabContent,
  sidebar,
}: {
  editing: boolean;
  name: string;
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  variable: boolean;
  generalContent: ReactNode;
  descriptionContent: ReactNode;
  shortDescriptionContent: ReactNode;
  tabContent: ReactNode;
  sidebar: ReactNode;
}) {
  const tabs = NAVIGATION.filter(
    (item) => item.id !== "variations" || variable,
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#6D5DF6] hover:underline"
          >
            <ArrowLeft className="size-4" />
            All Products
          </Link>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#172444]">
            {editing ? "Edit Product" : "Add New Product"}
          </h1>

          <p className="mt-1 text-xs text-[#8794AC]">
            Products / {editing ? name || "Edit" : "Add New"}
          </p>
        </div>

        <span className="rounded-lg border border-[#E6E0FF] bg-[#F5F2FF] px-3 py-2 text-xs font-semibold text-[#6654DC]">
          <FileText className="mr-2 inline size-3.5" />
          Product Editor
        </span>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-5">
          <EditorPanel title="Product Name">
            {generalContent}
          </EditorPanel>

          <EditorPanel title="Product Description">
            {descriptionContent}
          </EditorPanel>

          <EditorPanel title="Short Description">
            {shortDescriptionContent}
          </EditorPanel>

          <section className="overflow-hidden rounded-2xl border border-[#E6EAF3] bg-white shadow-sm">
            <div className="border-b border-[#EDF0F6] px-5 py-4">
              <h2 className="text-sm font-bold text-[#172444]">
                Product Data
              </h2>
              <p className="mt-1 text-[11px] text-[#8794AC]">
                Product-specific pricing, inventory and settings
              </p>
            </div>

            <div className="flex flex-col md:min-h-[360px] md:flex-row">
              <nav
                aria-label="Product data sections"
                className="flex gap-1 overflow-x-auto border-b border-[#EDF0F6] bg-[#FAFBFD] p-2 md:w-[185px] md:shrink-0 md:flex-col md:border-b-0 md:border-r"
              >
                {tabs.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id as EditorTab)}
                      aria-current={tab === item.id ? "step" : undefined}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-semibold transition ${
                        tab === item.id
                          ? "bg-[#EEEAFE] text-[#604FDB]"
                          : "text-[#65738E] hover:bg-white hover:text-[#172444]"
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="min-w-0 flex-1 p-5">
                {tabContent}
              </div>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          {sidebar}
        </aside>
      </div>
    </div>
  );
}

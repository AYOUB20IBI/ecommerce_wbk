
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import {
  EditorField,
  EditorPanel,
  ProductEditorLayout,
  type EditorTab,
} from "./editor/product-editor-layout";

import {
  ProductPublishing,
  type PublishingStatus,
} from "./editor/product-publishing";

import {
  ProductTaxonomyFields,
  type ProductTaxonomyValue,
  type TaxonomyOption,
} from "./editor/product-taxonomy-fields";

import { ProductPricing } from "./editor/product-pricing";
import { validatePrices } from "./editor/product-pricing.utils";

import { ProductIdentifiers } from "./editor/product-identifiers";

import {
  validateIdentifiers,
  toOptionalIdentifier,
} from "./editor/product-identifiers.utils";

import {
  ProductStockManagement,
  isValidStockQuantity,
} from "./editor/product-stock-management";

import {
  ProductThumbnailField,
  ProductGalleryField,
  EMPTY_PRODUCT_IMAGES,
  type ProductImageSelection,
} from "./editor/product-image-fields";

import {
  loadProductImages,
  synchronizeProductImages,
  validateProductImages,
  imageSelectionSignature,
} from "./editor/save-product-images";

const RichTextEditor = dynamic(
  () => import("./editor/product-rich-text-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 animate-pulse rounded-xl bg-[#F4F5FA]" />
    ),
  },
);

type ProductType = "simple" | "variable";

type ProductForm = {
  name: string;
  slug: string;
  type: ProductType;
  status: PublishingStatus;
  description: string;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  sku: string;
  ean: string;
  regularPrice: string;
  salePrice: string;
  stockQuantity: string;
  manageStock: boolean;
  isActive: boolean;
};

type ProductVariant = {
  sku: string | null;
  ean: string | null;
  regularPrice: string | null;
  salePrice: string | null;
  stockQuantity: number;
  manageStock: boolean;
  isActive: boolean;
};

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  status: PublishingStatus;
  description: string | null;
  shortDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  variants: ProductVariant[];
};

type ProductRelations = {
  product: { id: string };
  brand: TaxonomyOption | null;
  categories: Array<
    TaxonomyOption & { parent_id?: string | null }
  >;
  tags: TaxonomyOption[];
};

type ApiResult<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

const INITIAL: ProductForm = {
  name: "",
  slug: "",
  type: "simple",
  status: "draft",
  description: "",
  shortDescription: "",
  seoTitle: "",
  seoDescription: "",
  isFeatured: false,
  sku: "",
  ean: "",
  regularPrice: "",
  salePrice: "",
  stockQuantity: "0",
  manageStock: true,
  isActive: true,
};

const EMPTY_TAXONOMIES: ProductTaxonomyValue = {
  categoryIds: [],
  tagIds: [],
  brandId: null,
};

const VARIABLE_TEMPLATE = JSON.stringify(
  {
    attributes: [
      {
        attributeId: "REPLACE_WITH_ATTRIBUTE_UUID",
        valueIds: ["REPLACE_WITH_VALUE_UUID"],
        visible: true,
        usedForVariations: true,
      },
    ],
    variants: [
      {
        sku: null,
        ean: null,
        regularPrice: "199.00",
        salePrice: null,
        stockQuantity: 10,
        manageStock: true,
        isActive: true,
        isDefault: true,
        options: [
          {
            attributeId: "REPLACE_WITH_ATTRIBUTE_UUID",
            valueId: "REPLACE_WITH_VALUE_UUID",
          },
        ],
      },
    ],
  },
  null,
  2,
);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fieldClass =
  "h-11 w-full rounded-xl border border-[#E4E8F1] bg-white px-3 text-sm text-[#172444] outline-none focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10 disabled:bg-[#F8F9FC] disabled:opacity-60";

const textareaClass =
  "w-full rounded-xl border border-[#E4E8F1] bg-white px-3 py-3 text-sm leading-6 text-[#172444] outline-none focus:border-[#6D5DF6] disabled:opacity-60";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function optional(value: string): string | null {
  return value.trim() || null;
}

function normalizedTaxonomies(
  value: ProductTaxonomyValue,
): ProductTaxonomyValue {
  return {
    categoryIds: [...value.categoryIds].sort(),
    tagIds: [...value.tagIds].sort(),
    brandId: value.brandId,
  };
}

function makeSnapshot(
  form: ProductForm,
  variableConfig: string,
  taxonomies: ProductTaxonomyValue,
  images: ProductImageSelection,
): string {
  return JSON.stringify({
    form,
    variableConfig,
    taxonomies: normalizedTaxonomies(taxonomies),
    images: imageSelectionSignature(images),
  });
}

function taxonomiesEqual(
  first: ProductTaxonomyValue,
  second: ProductTaxonomyValue,
): boolean {
  return (
    JSON.stringify(normalizedTaxonomies(first)) ===
    JSON.stringify(normalizedTaxonomies(second))
  );
}

function hasTaxonomies(value: ProductTaxonomyValue): boolean {
  return (
    value.categoryIds.length > 0 ||
    value.tagIds.length > 0 ||
    value.brandId !== null
  );
}

async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
  });

  let body: ApiResult<T>;

  try {
    body = (await response.json()) as ApiResult<T>;
  } catch {
    throw new Error("Invalid server response.");
  }

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  if (!response.ok || body.success !== true) {
    throw new Error(
      body.message || `Request failed (${response.status}).`,
    );
  }

  if (body.data === undefined) {
    throw new Error("Missing API response data.");
  }

  return body.data;
}

function PlannedSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#DFE3EF] bg-[#FAFBFE] p-5">
      <p className="text-sm font-bold text-[#172444]">
        {title}
      </p>
      <div className="mt-2 text-xs leading-6 text-[#8290AC]">
        {children}
      </div>
    </div>
  );
}

export function ProductEditor({
  productId,
  canCreate,
  canUpdate,
}: {
  productId?: string;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();

  const [createdId, setCreatedId] =
    useState<string | null>(null);

  const currentId = productId ?? createdId;
  const editing = Boolean(currentId);
  const canSave = editing ? canUpdate : canCreate;

  const [form, setForm] = useState<ProductForm>(INITIAL);
  const [original, setOriginal] =
    useState<ProductDetail | null>(null);

  const [tab, setTab] = useState<EditorTab>("general");

  const [taxonomies, setTaxonomies] =
    useState<ProductTaxonomyValue>(EMPTY_TAXONOMIES);

  const [savedTaxonomies, setSavedTaxonomies] =
    useState<ProductTaxonomyValue>(EMPTY_TAXONOMIES);

  const [productImages, setProductImages] =
    useState<ProductImageSelection>(EMPTY_PRODUCT_IMAGES);

  const [savedImagesSignature, setSavedImagesSignature] =
    useState(() =>
      imageSelectionSignature(EMPTY_PRODUCT_IMAGES),
    );

  const [initialCategories, setInitialCategories] =
    useState<TaxonomyOption[]>([]);

  const [initialTags, setInitialTags] =
    useState<TaxonomyOption[]>([]);

  const [initialBrand, setInitialBrand] =
    useState<TaxonomyOption | null>(null);

  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId));

  const [relationsReady, setRelationsReady] =
    useState(!productId);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [variableConfig, setVariableConfig] =
    useState(VARIABLE_TEMPLATE);

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    makeSnapshot(
      INITIAL,
      VARIABLE_TEMPLATE,
      EMPTY_TAXONOMIES,
      EMPTY_PRODUCT_IMAGES,
    ),
  );

  const dirty =
    makeSnapshot(
      form,
      variableConfig,
      taxonomies,
      productImages,
    ) !== savedSnapshot;

  const dirtyRef = useRef(false);
  const leavingAfterSave = useRef(false);
  const saveLock = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Product, taxonomy relations and images load in parallel.
  // If one fails, editing is blocked to prevent accidental
  // deletion of existing assignments or images.
  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    let active = true;

    void Promise.all([
      api<ProductDetail>(
        `/api/admin/products/${encodeURIComponent(productId)}`,
        { signal: controller.signal },
      ),
      api<ProductRelations>(
        `/api/admin/products/${encodeURIComponent(productId)}/taxonomies`,
        { signal: controller.signal },
      ),
      loadProductImages(productId, controller.signal),
    ])
      .then(([product, relations, images]) => {
        if (!active) return;

        if (
          product.id !== productId ||
          relations.product.id !== productId ||
          !Array.isArray(relations.categories) ||
          !Array.isArray(relations.tags)
        ) {
          throw new Error("Invalid product data.");
        }

        const variant = product.variants?.[0];

        const nextForm: ProductForm = {
          name: product.name,
          slug: product.slug,
          type: product.type,
          status: product.status,
          description: product.description ?? "",
          shortDescription: product.shortDescription ?? "",
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          isFeatured: Boolean(product.isFeatured),
          sku: variant?.sku ?? "",
          ean: variant?.ean ?? "",
          regularPrice: variant?.regularPrice ?? "",
          salePrice: variant?.salePrice ?? "",
          stockQuantity: String(
            variant?.stockQuantity ?? 0,
          ),
          manageStock: variant?.manageStock ?? true,
          isActive: variant?.isActive ?? true,
        };

        const nextTaxonomies: ProductTaxonomyValue = {
          categoryIds: relations.categories.map(
            (item) => item.id,
          ),
          tagIds: relations.tags.map(
            (item) => item.id,
          ),
          brandId: relations.brand?.id ?? null,
        };

        setOriginal(product);
        setForm(nextForm);
        setTaxonomies(nextTaxonomies);
        setSavedTaxonomies(nextTaxonomies);
        setProductImages(images);

        setSavedImagesSignature(
          imageSelectionSignature(images),
        );

        setInitialCategories(relations.categories);
        setInitialTags(relations.tags);
        setInitialBrand(relations.brand);

        setSlugEdited(true);
        setRelationsReady(true);

        setSavedSnapshot(
          makeSnapshot(
            nextForm,
            VARIABLE_TEMPLATE,
            nextTaxonomies,
            images,
          ),
        );
      })
      .catch((caught) => {
        if (!active) return;

        setRelationsReady(false);

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load product details.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [productId]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (
        dirtyRef.current &&
        !leavingAfterSave.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  function update<K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function changeName(value: string) {
    setForm((previous) => ({
      ...previous,
      name: value,
      slug: slugEdited
        ? previous.slug
        : slugify(value),
    }));
  }

  function buildVariant(
    targetStatus: PublishingStatus,
  ): ProductVariant {
    const pricing = validatePrices(
      form.regularPrice,
      form.salePrice,
      targetStatus === "published",
    );

    if (!pricing.valid) {
      setTab("general");

      throw new Error(
        pricing.regularError ??
          pricing.saleError ??
          "Invalid product pricing.",
      );
    }

    const identifiers = validateIdentifiers(form.sku, form.ean);

    if (!identifiers.valid) {
      setTab("inventory");

      throw new Error(
        identifiers.skuError ??
          identifiers.eanError ??
          "Invalid product identifiers.",
      );
    }

    if (
      form.manageStock &&
      !isValidStockQuantity(form.stockQuantity)
    ) {
      setTab("inventory");
      throw new Error("Enter a valid stock quantity.");
    }

    const quantity = isValidStockQuantity(form.stockQuantity)
      ? Number(form.stockQuantity)
      : 0;

    if (
      targetStatus === "published" &&
      !form.isActive
    ) {
      setTab("inventory");
      throw new Error(
        "Publishing requires an active variant.",
      );
    }

    return {
      sku: toOptionalIdentifier(form.sku),
      ean: toOptionalIdentifier(form.ean),
      regularPrice: optional(form.regularPrice),
      salePrice: optional(form.salePrice),
      stockQuantity: quantity,
      manageStock: form.manageStock,
      isActive: form.isActive,
    };
  }

  async function save(targetStatus: PublishingStatus) {
    if (
      saveLock.current ||
      saving ||
      loading ||
      !canSave ||
      !relationsReady
    ) {
      return;
    }

    setError("");
    setNotice("");

    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
    ) {
      setError(
        "A valid product name and slug are required.",
      );
      return;
    }

    if (
      form.description.length > 100000 ||
      form.shortDescription.length > 5000
    ) {
      setError("Description exceeds the allowed size.");
      return;
    }

    if (
      taxonomies.categoryIds.length > 100 ||
      taxonomies.tagIds.length > 100 ||
      new Set(taxonomies.categoryIds).size !==
        taxonomies.categoryIds.length ||
      new Set(taxonomies.tagIds).size !==
        taxonomies.tagIds.length
    ) {
      setError("Invalid taxonomy selection.");
      return;
    }

    if (
      [
        ...taxonomies.categoryIds,
        ...taxonomies.tagIds,
        ...(taxonomies.brandId
          ? [taxonomies.brandId]
          : []),
      ].some((id) => !UUID.test(id))
    ) {
      setError("Invalid taxonomy ID.");
      return;
    }

    try {
      validateProductImages(productImages);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Invalid product images.",
      );
      return;
    }

    const common = {
      name: form.name.trim(),
      slug: form.slug,
      status: targetStatus,
      description: optional(form.description),
      shortDescription: optional(form.shortDescription),
      seoTitle: optional(form.seoTitle),
      seoDescription: optional(form.seoDescription),
      isFeatured: form.isFeatured,
    };

    let simpleVariant: ProductVariant | null = null;

    if (form.type === "simple") {
      try {
        simpleVariant = buildVariant(targetStatus);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Invalid variant data.",
        );
        return;
      }
    }

    // Validate variable-product JSON before performing
    // any database write.
    let variablePayload: {
      attributes: unknown[];
      variants: unknown[];
    } | null = null;

    if (!currentId && form.type === "variable") {
      try {
        const parsed: unknown = JSON.parse(variableConfig);

        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed) ||
          !("attributes" in parsed) ||
          !("variants" in parsed) ||
          !Array.isArray(parsed.attributes) ||
          !Array.isArray(parsed.variants)
        ) {
          throw new Error("Invalid variable configuration.");
        }

        variablePayload = {
          attributes: parsed.attributes,
          variants: parsed.variants,
        };
      } catch {
        setError("Invalid variable product JSON.");
        setTab("variations");
        return;
      }
    }

    saveLock.current = true;
    setSaving(true);

    let savedProductId = currentId ?? null;
    let productWriteSucceeded = false;
    let lastStage = "product";

    try {
      if (savedProductId) {
        if (
          original?.type === "variable" ||
          form.type === "variable"
        ) {
          await api(
            `/api/admin/products/${encodeURIComponent(savedProductId)}?action=variable`,
            {
              method: "PATCH",
              body: JSON.stringify(common),
            },
          );
        } else {
          await api(
            `/api/admin/products/${encodeURIComponent(savedProductId)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                ...common,
                variant: simpleVariant,
              }),
            },
          );
        }
      } else {
        const payload =
          form.type === "simple"
            ? {
                ...common,
                type: "simple" as const,
                variant: simpleVariant,
              }
            : {
                ...common,
                type: "variable" as const,
                ...variablePayload,
              };

        const created = await api<{ id: string }>(
          "/api/admin/products",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        if (!created || !UUID.test(created.id)) {
          throw new Error(
            "Product may have been created but no valid ID was returned. Check Products before retrying.",
          );
        }

        savedProductId = created.id;
        setCreatedId(created.id);
      }

      productWriteSucceeded = true;

      if (!savedProductId) {
        throw new Error("Missing saved product ID.");
      }

      lastStage = "taxonomies";

      const shouldSaveTaxonomies = productId
        ? !taxonomiesEqual(taxonomies, savedTaxonomies)
        : hasTaxonomies(taxonomies);

      if (shouldSaveTaxonomies) {
        if (!canUpdate) {
          throw new Error(
            "Assigning taxonomies requires products.update permission.",
          );
        }

        await api<ProductRelations>(
          `/api/admin/products/${encodeURIComponent(savedProductId)}/taxonomies`,
          {
            method: "PATCH",
            body: JSON.stringify({
              categoryIds: taxonomies.categoryIds,
              tagIds: taxonomies.tagIds,
              brandId: taxonomies.brandId,
            }),
          },
        );
      }

      lastStage = "images";

      const currentImageSignature =
        imageSelectionSignature(productImages);

      if (
        currentImageSignature !== savedImagesSignature ||
        !productId
      ) {
        if (
          (productImages.thumbnail ||
            productImages.gallery.length > 0 ||
            productId) &&
          !canUpdate
        ) {
          throw new Error(
            "Saving product images requires products.update permission.",
          );
        }

        if (canUpdate) {
          await synchronizeProductImages(
            savedProductId,
            productImages,
          );
        }
      }

      const savedForm: ProductForm = {
        ...form,
        status: targetStatus,
      };

      setForm(savedForm);
      setSavedTaxonomies(taxonomies);

      setSavedImagesSignature(
        imageSelectionSignature(productImages),
      );

      setSavedSnapshot(
        makeSnapshot(
          savedForm,
          variableConfig,
          taxonomies,
          productImages,
        ),
      );

      leavingAfterSave.current = true;

      router.push("/admin/products");
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to save product.";

      if (productWriteSucceeded && savedProductId) {
        setError(
          `Product details were saved, but ${lastStage} could not be completed: ${message} You can retry without creating a duplicate product.`,
        );

        setNotice(
          `Saved Product ID: ${savedProductId}`,
        );
      } else {
        setError(message);
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-[#6D5DF6]" />
      </div>
    );
  }

  const disabled = saving || !canSave || !relationsReady;

  const nameContent = (
    <div className="space-y-5">
      <EditorField label="Product Name *">
        <input
          required
          disabled={disabled}
          maxLength={255}
          value={form.name}
          onChange={(event) => changeName(event.target.value)}
          placeholder="Enter a product name"
          className={fieldClass}
        />
      </EditorField>

      <EditorField
        label="Product Slug *"
        hint="Changing an existing slug may affect product URLs."
      >
        <input
          required
          disabled={disabled}
          maxLength={255}
          value={form.slug}
          onChange={(event) => {
            setSlugEdited(true);
            update("slug", slugify(event.target.value));
          }}
          placeholder="product-name"
          className={fieldClass}
        />
      </EditorField>
    </div>
  );

  const descriptionContent = (
    <RichTextEditor
      label="Product Description"
      value={form.description}
      onChange={(value) => update("description", value)}
      maxLength={100000}
      minHeight={280}
      disabled={disabled}
    />
  );

  const shortDescriptionContent = (
    <RichTextEditor
      label="Short Description"
      value={form.shortDescription}
      onChange={(value) => update("shortDescription", value)}
      maxLength={5000}
      minHeight={170}
      disabled={disabled}
    />
  );

  let tabContent: ReactNode;

  if (tab === "general") {
    tabContent = (
      <div className="space-y-5">
        <EditorField label="Product Type">
          <select
            value={form.type}
            disabled={editing || disabled}
            onChange={(event) =>
              update(
                "type",
                event.target.value as ProductType,
              )
            }
            className={fieldClass}
          >
            <option value="simple">Simple Product</option>
            <option value="variable">Variable Product</option>
          </select>
        </EditorField>

        {form.type === "simple" ? (
          <ProductPricing
            regularPrice={form.regularPrice}
            salePrice={form.salePrice}
            onRegularPriceChange={(value) =>
              update("regularPrice", value)
            }
            onSalePriceChange={(value) =>
              update("salePrice", value)
            }
            requireRegular={form.status === "published"}
            disabled={disabled}
          />
        ) : (
          <PlannedSection title="Variable Product Pricing">
            Prices are managed independently per variation.
            The visual variation builder follows in AD.4.3.8.
          </PlannedSection>
        )}
      </div>
    );
  } else if (tab === "inventory") {
    tabContent =
      form.type === "simple" ? (
        <div className="space-y-6">
          <ProductIdentifiers
            sku={form.sku}
            ean={form.ean}
            onSkuChange={(value) =>
              update("sku", value)
            }
            onEanChange={(value) =>
              update("ean", value)
            }
            disabled={disabled}
          />

          <div className="border-t border-[#EDF0F6] pt-5">
            <ProductStockManagement
              manageStock={form.manageStock}
              stockQuantity={form.stockQuantity}
              isActive={form.isActive}
              onManageStockChange={(value) =>
                update("manageStock", value)
              }
              onStockQuantityChange={(value) =>
                update("stockQuantity", value)
              }
              onIsActiveChange={(value) =>
                update("isActive", value)
              }
              disabled={disabled}
            />
          </div>
        </div>
      ) : (
        <PlannedSection title="Variable Product Inventory">
          Inventory is managed per variation.
          The visual builder follows in AD.4.3.8.
        </PlannedSection>
      );
  } else if (tab === "variations") {
    tabContent = editing ? (
      <PlannedSection title="Variations">
        Existing variations are preserved.
        The visual builder follows in AD.4.3.8.
      </PlannedSection>
    ) : (
      <div className="space-y-4">
        <PlannedSection title="Technical Variable Configuration">
          Use real attribute and value UUIDs.
          The visual builder follows in AD.4.3.8.
        </PlannedSection>

        <textarea
          disabled={disabled}
          value={variableConfig}
          onChange={(event) =>
            setVariableConfig(event.target.value)
          }
          rows={18}
          spellCheck={false}
          aria-label="Variable attributes and variants JSON"
          className={`${textareaClass} font-mono text-xs`}
        />
      </div>
    );
  } else if (tab === "seo") {
    tabContent = (
      <div className="space-y-5">
        <EditorField label="SEO Title">
          <input
            disabled={disabled}
            maxLength={255}
            value={form.seoTitle}
            onChange={(event) =>
              update("seoTitle", event.target.value)
            }
            className={fieldClass}
          />
        </EditorField>

        <EditorField label="Meta Description">
          <textarea
            disabled={disabled}
            rows={4}
            maxLength={2000}
            value={form.seoDescription}
            onChange={(event) =>
              update("seoDescription", event.target.value)
            }
            className={textareaClass}
          />
        </EditorField>

        <div className="rounded-xl border border-[#E5E9F2] p-4">
          <p className="text-[11px] text-[#8794AC]">
            Search Result Preview
          </p>

          <p className="mt-2 text-sm font-semibold text-[#3556AF]">
            {form.seoTitle || form.name || "Product Title"}
          </p>

          <p className="mt-1 text-xs text-emerald-700">
            /products/{form.slug || "product-slug"}
          </p>

          <p className="mt-2 text-xs text-[#66748E]">
            {form.seoDescription ||
              "Add a meta description to preview your search snippet."}
          </p>
        </div>
      </div>
    );
  } else {
    const labels: Record<
      "shipping" | "linked" | "attributes" | "advanced",
      string
    > = {
      shipping: "Shipping Settings",
      linked: "Linked Products",
      attributes: "Product Attributes",
      advanced: "Advanced Settings",
    };

    const selected = tab as keyof typeof labels;

    tabContent = (
      <PlannedSection title={labels[selected]}>
        This section will be connected to validated backend APIs
        in its dedicated implementation step.
      </PlannedSection>
    );
  }

  const sidebar = (
    <>
      <ProductPublishing
        status={form.status}
        onStatusChange={(status) =>
          update("status", status)
        }
        featured={form.isFeatured}
        onFeaturedChange={(featured) =>
          update("isFeatured", featured)
        }
        editing={editing}
        saving={saving}
        disabled={disabled}
        dirty={dirty}
        onSave={() => void save(form.status)}
        onSaveDraft={() => void save("draft")}
      />

      <EditorPanel title="Product Categories">
        <ProductTaxonomyFields
          value={taxonomies}
          onChange={setTaxonomies}
          initialCategories={initialCategories}
          initialTags={initialTags}
          initialBrand={initialBrand}
          disabled={disabled}
        />
      </EditorPanel>

      <EditorPanel title="Product Thumbnail">
        <ProductThumbnailField
          value={productImages}
          onChange={setProductImages}
          disabled={disabled}
        />
      </EditorPanel>

      <EditorPanel title="Product Gallery">
        <ProductGalleryField
          value={productImages}
          onChange={setProductImages}
          disabled={disabled}
        />
      </EditorPanel>

      <EditorPanel title="SEO">
        <button
          type="button"
          onClick={() => setTab("seo")}
          className="text-xs font-semibold text-[#6D5DF6] hover:underline"
        >
          Edit SEO Title & Meta Description
        </button>
      </EditorPanel>
    </>
  );

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}

          {createdId && (
            <div className="mt-3">
              <Link
                href={`/admin/products/${createdId}/edit`}
                className="font-semibold text-[#6554D8] underline"
              >
                Edit Saved Product
              </Link>
            </div>
          )}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"
        >
          {notice}
        </div>
      )}

      {!relationsReady && productId && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          Product media or relations could not be loaded.
          Saving is disabled to protect existing data.
        </div>
      )}

      <ProductEditorLayout
        editing={editing}
        name={form.name}
        tab={tab}
        onTabChange={setTab}
        variable={form.type === "variable"}
        generalContent={nameContent}
        descriptionContent={descriptionContent}
        shortDescriptionContent={shortDescriptionContent}
        tabContent={tabContent}
        sidebar={sidebar}
      />
    </div>
  );
}

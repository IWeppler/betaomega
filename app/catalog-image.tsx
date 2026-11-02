"use client";

import { useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageSquare, UploadSimple, X } from "@phosphor-icons/react";

export function CatalogImage({
  image,
  name,
  className = "",
}: {
  image?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState("");
  if (!image || failed === image) return null;
  return (
    <Image
      className={`catalog-image ${className}`}
      src={image}
      alt={name}
      width={720}
      height={480}
      unoptimized
      onError={() => setFailed(image)}
    />
  );
}

/** `site` stores the photo in that site's folder of the bucket. */
export function ImageField({
  value,
  onChange,
  onBusy,
  label = "Imagen de la ficha",
  site,
}: {
  value?: string;
  label?: string;
  site?: string;
  onChange: (value: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 5 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Elegí una imagen JPG, PNG o WebP.");
      return;
    }
    setUploading(true);
    onBusy(true);
    try {
      const body = new FormData();
      body.set("image", file);
      if (site) body.set("site", site);
      const response = await fetch("/api/images", { method: "POST", body });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo subir la imagen.");
      onChange(result.image);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      onBusy(false);
    }
  };
  return (
    <fieldset className="image-field">
      <legend>
        <ImageSquare size={20} aria-hidden="true" />
        {label}
      </legend>
      {value && (
        <CatalogImage
          image={value}
          name="Vista previa de la imagen"
          className="image-preview"
        />
      )}
      <div className="toolbar-actions">
        <label className="button">
          <UploadSimple size={20} aria-hidden="true" />
          {uploading ? "Subiendo…" : value ? "Cambiar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            hidden
            onChange={(e) => void upload(e)}
          />
        </label>
        {value && (
          <button
            type="button"
            className="button"
            disabled={uploading}
            onClick={() => onChange("")}
          >
            <X size={20} aria-hidden="true" />
            Quitar
          </button>
        )}
      </div>
      <small>JPG, PNG o WebP, hasta 5 MB. Se convierte sola a WebP de hasta 1 MB.</small>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
    </fieldset>
  );
}

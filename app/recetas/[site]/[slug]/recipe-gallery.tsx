"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { RecipePhoto } from "../recipe-card";

/** The recipe's photos: the big one (click to see it full size), and small ones right under it to switch between. */
export function RecipeGallery({ title, images, sizes }: { title: string; images: string[]; sizes: string }) {
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const many = images.length > 1;
  const go = (step: number) => setCurrent(n => (n + step + images.length) % images.length);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  if (!images.length) return <RecipePhoto title={title} sizes={sizes} />;
  return <div className="r-gallery">
    <button type="button" className="r-photo-button" onClick={() => setOpen(true)} aria-label={`Ver la foto de ${title} en grande`}>
      <RecipePhoto key={images[current]} title={title} image={images[current]} priority={current === 0} sizes={sizes} />
    </button>
    {many && <ul className="r-thumbs no-print" aria-label="Fotos de la receta">
      {images.map((src, n) => <li key={src}>
        <button type="button" aria-pressed={n === current} aria-label={`Foto ${n + 1} de ${images.length}`} onClick={() => setCurrent(n)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading="lazy" />
        </button>
      </li>)}
    </ul>}
    <dialog ref={dialog} className="r-lightbox no-print" aria-label={`Foto de ${title}`} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}
      onKeyDown={event => { if (event.key === "ArrowLeft" && many) go(-1); if (event.key === "ArrowRight" && many) go(1); }}>
      {open && <>
        {/* The full-size file is the point here, so next/image's resizing is skipped. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[current]} alt={title} />
        <button type="button" className="r-lightbox-close" aria-label="Cerrar" onClick={() => setOpen(false)}><X size={22} weight="bold" aria-hidden="true" /></button>
        {many && <>
          <button type="button" className="r-lightbox-prev" aria-label="Foto anterior" onClick={() => go(-1)}><CaretLeft size={24} weight="bold" aria-hidden="true" /></button>
          <button type="button" className="r-lightbox-next" aria-label="Foto siguiente" onClick={() => go(1)}><CaretRight size={24} weight="bold" aria-hidden="true" /></button>
          <p className="r-lightbox-count" aria-live="polite">{current + 1} / {images.length}</p>
        </>}
      </>}
    </dialog>
  </div>;
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownToLine, ChevronDown, Smartphone } from "lucide-react";

export function DownloadButton({
  apkUrl,
  compact = false,
}: {
  apkUrl: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const android = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    android.current?.focus();
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className={`download-control${compact ? " compact" : ""}`}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        type="button"
        className="download-button"
        ref={trigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <ArrowDownToLine size={18} aria-hidden="true" />
        Download
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="download-popover" id={id} aria-label="Download options">
          <a ref={android} href={apkUrl} onClick={() => setOpen(false)}>
            <Smartphone size={22} aria-hidden="true" />
            <span>
              <strong>Android</strong>
              <small>Download APK · 102.7 MB</small>
            </span>
            <ArrowDownToLine size={18} aria-hidden="true" />
          </a>
          <button type="button" disabled>
            <Smartphone size={22} aria-hidden="true" />
            <span>
              <strong>iOS</strong>
              <small>Not available</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

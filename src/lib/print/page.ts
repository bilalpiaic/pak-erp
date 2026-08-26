export type PrintOrientation = "portrait" | "landscape";

const STYLE_ID = "garmentloop-print-page";

/** Inject an A4 @page rule, then open the browser print dialog. */
export function printDocument(orientation: PrintOrientation = "portrait"): void {
  if (typeof document === "undefined") return;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  const margin = orientation === "landscape" ? "8mm 8mm 10mm" : "10mm 8mm 12mm";
  style.textContent = `@page { size: A4 ${orientation}; margin: ${margin}; }`;
  document.documentElement.dataset.printOrientation = orientation;
  window.print();
}

import "./style.css";
import { TreeViewer } from "./tree-viewer";

const container = document.getElementById("treeViewer");
const fileInput = document.getElementById("xsdFile") as HTMLInputElement | null;

if (!(container instanceof HTMLElement) || !(fileInput instanceof HTMLInputElement)) {
  throw new Error("Required UI elements are missing");
}

const viewer = new TreeViewer(container);
const rootSelect = document.getElementById("rootElementSelect") as HTMLSelectElement | null;

fileInput.addEventListener("change", (event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    viewer.parseFiles(files);
  }
});

rootSelect?.addEventListener("change", () => {
  viewer.handleGenerateExampleXml();
});

void viewer.restoreCachedFiles();

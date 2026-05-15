/** Side-effect module: patch globals before pdf-parse/pdf.js evaluates. */

import { installPdfJsNodePolyfills } from "./pdfNodePolyfill";

installPdfJsNodePolyfills();

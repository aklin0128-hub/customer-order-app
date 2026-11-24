declare module "jsbarcode" {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    background?: string;
    lineColor?: string;
    textMargin?: number;
  }

  export default function JsBarcode(
    element: string | HTMLElement | SVGSVGElement,
    data: string,
    options?: JsBarcodeOptions
  ): void;
}

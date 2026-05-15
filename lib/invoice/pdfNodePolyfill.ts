/**
 * pdf.js (bundled with pdf-parse) expects browser geometry globals.
 * Node / Vercel runtimes often lack `DOMMatrix`, which throws during `import("pdf-parse")`.
 */

type Point = { x: number; y: number; z?: number; w?: number };

export function installPdfJsNodePolyfills(): void {
  const g = globalThis as typeof globalThis & { DOMMatrix?: unknown; Path2D?: unknown };

  if (typeof g.DOMMatrix !== "undefined") return;

  class DOMMatrixStub {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    m11 = 1;
    m12 = 0;
    m13 = 0;
    m14 = 0;
    m21 = 0;
    m22 = 1;
    m23 = 0;
    m24 = 0;
    m31 = 0;
    m32 = 0;
    m33 = 1;
    m34 = 0;
    m41 = 0;
    m42 = 0;
    m43 = 0;
    m44 = 1;
    is2D = true;
    isIdentity = true;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = Number(init[0]);
        this.b = Number(init[1]);
        this.c = Number(init[2]);
        this.d = Number(init[3]);
        this.e = Number(init[4]);
        this.f = Number(init[5]);
        this.m11 = this.a;
        this.m12 = this.b;
        this.m21 = this.c;
        this.m22 = this.d;
        this.m41 = this.e;
        this.m42 = this.f;
        this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      }
    }

    static fromMatrix(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    static fromFloat32Array(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    static fromFloat64Array(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    multiply(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    invert(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    multiplySelf(): DOMMatrixStub {
      return this;
    }

    preMultiplySelf(): DOMMatrixStub {
      return this;
    }

    translate(tx = 0, ty = 0): DOMMatrixStub {
      const next = new DOMMatrixStub();
      next.e = tx;
      next.f = ty;
      next.m41 = tx;
      next.m42 = ty;
      next.isIdentity = false;
      return next;
    }

    translateSelf(tx = 0, ty = 0): DOMMatrixStub {
      this.e += tx;
      this.f += ty;
      this.m41 += tx;
      this.m42 += ty;
      this.isIdentity = false;
      return this;
    }

    scale(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    scaleSelf(): DOMMatrixStub {
      return this;
    }

    scaleNonUniform(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    rotate(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    rotateSelf(): DOMMatrixStub {
      return this;
    }

    rotateFromVector(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    rotateFromVectorSelf(): DOMMatrixStub {
      return this;
    }

    rotateAxisAngle(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    skewX(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    skewY(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    skewXSelf(): DOMMatrixStub {
      return this;
    }

    skewYSelf(): DOMMatrixStub {
      return this;
    }

    flipX(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    flipY(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    inverse(): DOMMatrixStub {
      return new DOMMatrixStub();
    }

    invertSelf(): DOMMatrixStub {
      return this;
    }

    setMatrixValue(): DOMMatrixStub {
      return this;
    }

    transformPoint(p: Point): Point {
      return { x: p.x, y: p.y, z: p.z ?? 0, w: p.w ?? 1 };
    }

    toFloat32Array(): Float32Array {
      return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]);
    }

    toFloat64Array(): Float64Array {
      return new Float64Array([this.a, this.b, this.c, this.d, this.e, this.f]);
    }

    toString(): string {
      return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }
  }

  g.DOMMatrix = DOMMatrixStub as unknown as typeof DOMMatrix;

  if (typeof g.Path2D === "undefined") {
    class Path2DStub {
      addPath(): void {}
      closePath(): void {}
      moveTo(): void {}
      lineTo(): void {}
      bezierCurveTo(): void {}
      quadraticCurveTo(): void {}
      rect(): void {}
      arc(): void {}
      arcTo(): void {}
      ellipse(): void {}
      roundRect(): void {}
    }
    g.Path2D = Path2DStub;
  }
}

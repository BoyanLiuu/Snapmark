/**
 * The design file's sample data for screen 09, shown by the M1 shell until the real thing exists.
 * Kept in one file so it is deleted in one place: the image facts go in M3, the layers in M15.
 */

export type LayerKind = "arrow" | "text" | "rect" | "pixelate" | "highlight";

export interface SampleLayer {
  id: string;
  kind: LayerKind;
  name: string;
  /** Size in image px, as the layer list shows it. */
  dims: string;
}

export const SAMPLE_IMAGE = {
  name: "Market-at-Third.jpg",
  naturalWidth: 3840,
  naturalHeight: 2407,
  zoom: 0.24,
};

/** Top of the paint order first, as the layer list reads. */
export const SAMPLE_LAYERS: SampleLayer[] = [
  { id: "Hv8Rc3Ks", kind: "arrow", name: "Sky arrow", dims: "420 × 344" },
  {
    id: "Ra9Kx4Pd",
    kind: "text",
    name: "Two bikes riding the crossing",
    dims: "795 wide",
  },
  {
    id: "Xt4Wd9Bn",
    kind: "text",
    name: "Taxi waiting in the red transit-only lane",
    dims: "583 wide",
  },
  { id: "Ce2Nj5Vu", kind: "rect", name: "Orange rectangle", dims: "678 × 300" },
  { id: "k3Fq9aZ1", kind: "rect", name: "Sky rectangle", dims: "530 × 241" },
  { id: "Gw3Ft7Lh", kind: "pixelate", name: "Pixelate", dims: "120 × 324" },
  { id: "p7Lm2Qx8", kind: "pixelate", name: "Pixelate", dims: "216 × 57" },
  {
    id: "Mz6Yb1Tq",
    kind: "highlight",
    name: "Yellow highlight",
    dims: "1398 × 81",
  },
];

export const SAMPLE_STATUS =
  "8 annotations, last edited 12 Nov 2026, 09:41 UTC.";

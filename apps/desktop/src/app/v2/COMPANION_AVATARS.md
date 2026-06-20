# Companion Live2D avatars

Two Live2D models can be shown in the fixed orb (top-right). Each avatar has its own layout profile so switching does not change framing.

## Orb (CSS)

Defined in `AppV2.css` → `.v2-companion-orb` (wrapper: `CompanionOrb.tsx`):

| Property | Value | Notes |
|---|---|---|
| Position | `fixed`, draggable | Default top-right; position saved in `localStorage` key `v2-companion-orb-position` |
| Size | **220 × 220 px** | CSS size; clip circle via `border-radius: 999px` + `overflow: hidden` |
| Canvas | fills orb | Pixi `resizeTo` host; Retina via `resolution: devicePixelRatio` |

Drag the orb (not the avatar toggle pill) to move it anywhere on screen. Position persists across reloads.

Changing orb CSS size does **not** change model zoom — scale is computed from `layout.refSize` (140px reference), not the live orb size.

## Layout model

Each avatar config in `companion-avatars.ts` has a `layout` object:

```ts
scale = min(refSize / modelW, refSize / modelH) * zoom
anchor = (anchorX, anchorY)   // pivot on internal model bounds
position = (faceX * viewW, faceY * viewH)
```

| Field | Meaning |
|---|---|
| `refSize` | Reference viewport size (px) for scale math. Fixed at **140**. |
| `zoom` | Extra multiplier. Higher = closer on face/bust. |
| `anchorX`, `anchorY` | Pivot on model (0–1). Lower `anchorY` = pivot nearer the head. |
| `faceX`, `faceY` | Placement in canvas (fraction). `faceY > 1` pushes model down so the head stays in the circle when zoomed. |

## Avatar profiles (current)

### Z (`z`)

| Field | Value |
|---|---|
| Model | `/v2/1113_v2/Z.model3.json` |
| refSize | 140 |
| zoom | **1.6** |
| anchor | (0.5, 0.5) — model center |
| faceX / faceY | 0.5 / **0.65** |

Minimal model: blink, physics, mouse focus. No exported motions/expressions.

### 简 (`jian`)

| Field | Value |
|---|---|
| Model | `/v2/jian/简.model3.json` |
| refSize | 140 |
| zoom | **8.4** |
| anchor | (0.5, **0.28**) — pivot on face |
| faceX / faceY | 0.5 / **1.18** |

Full VTuber rig: 10 expressions, 1 idle motion, lip-sync param `ParamMouthOpenY`.

## Tuning workflow

1. Edit values in `companion-avatars.ts` for the target avatar id.
2. Refresh the app (HMR reloads the component when `avatarId` changes).
3. Use the orb toggle (labels **Z** / **简**) to compare both profiles side by side.
4. Update this file when a profile is finalized.

## Toggle (dev)

`AppV2.tsx` → `V2HomeView`: button on the orb switches `avatarId` between `z` and `jian`. State is local to the home view for now.

## Files

| File | Role |
|---|---|
| `companion-avatars.ts` | Model paths + layout constants |
| `CompanionCharacter.tsx` | Pixi/Live2D loader + layout |
| `AppV2.css` | Orb size and position |
| `AppV2.tsx` | Toggle UI |

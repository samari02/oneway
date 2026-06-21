# Companion Live2D avatars

Three Live2D models can be shown in the draggable companion orb. Each avatar has its own layout profile so switching does not change framing.

## Orb (CSS)

Defined in `components/CompanionOrb.css` (wrapper: `CompanionOrb.tsx`):

| Property | Value | Notes |
|---|---|---|
| Position | `fixed`, draggable | Default top-right; saved in `localStorage` key `clarity-companion-orb-position` |
| Size | **220 × 220 px** | Clip circle via `border-radius: 999px` + `overflow: hidden` |
| Canvas | fills orb | Pixi `resizeTo` host; Retina via `resolution: devicePixelRatio` |

Drag the orb (not the avatar toggle pill) to move it anywhere on screen.

Changing orb CSS size does **not** change model zoom — scale uses `layout.refSize` (140px reference).

## Layout model

Each avatar config in `companion-avatars.ts`:

```ts
scale = min(refSize / modelW, refSize / modelH) * zoom
anchor = (anchorX, anchorY)
position = (faceX * viewW, faceY * viewH)
```

## Avatar profiles (current)

### Z (`z`)

| Field | Value |
|---|---|
| Model | `/companion/z/Z.model3.json` |
| zoom | **1.6** |
| anchor | (0.5, 0.5) |
| faceX / faceY | 0.5 / **0.65** |

### 简 (`jian`)

| Field | Value |
|---|---|
| Model | `/companion/jian/简.model3.json` |
| zoom | **8.4** |
| anchor | (0.5, **0.28**) |
| faceX / faceY | 0.5 / **1.18** |

### Asuka (`asuka`)

| Field | Value |
|---|---|
| Model | `/companion/asuka/Asuka.model3.json` |
| zoom | **8.4** |
| anchor | (0.5, **0.28**) |
| faceX / faceY | 0.5 / **1.18** |

## Assets

```
public/companion/
  core/live2dcubismcore.min.js
  z/
  jian/
  asuka/
```

## Toggle

Button cycles **Z → 简 → Asuka → Z**.

## Files

| File | Role |
|---|---|
| `companion-avatars.ts` | Model paths + layout constants |
| `components/CompanionCharacter.tsx` | Pixi/Live2D loader |
| `components/CompanionOrb.tsx` | Drag, toggle, shell |
| `components/CompanionOrb.css` | Orb styling |

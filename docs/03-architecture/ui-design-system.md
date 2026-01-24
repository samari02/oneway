# UI Design System

This document describes the design system used across the Clarity desktop application.

## Overview

The design system is built on **CSS Custom Properties** (CSS Variables) that automatically adapt to light and dark themes. All components should use these semantic tokens instead of hardcoded values.

## File Structure

```
apps/desktop/src/styles/
├── variables.css    # Design tokens (colors, spacing, typography)
├── global.css       # Base styles, resets, utility classes
```

## Design Tokens

### Colors

#### Brand Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-mint` | #7DD8C4 | #6ECEB5 | Primary brand color |
| `--color-mint-light` | #A8E6D8 | #8FDBC9 | Hover states, highlights |
| `--color-mint-dark` | #5BC4AD | #4FB99D | Active states, emphasis |
| `--accent` | (alias for mint) | (alias for mint) | Convenience alias |

#### Semantic Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-success` | #68D391 | #68D391 | Success states |
| `--color-warning` | #F6AD55 | #F6AD55 | Warning states |
| `--color-error` | #FC8181 | #FC8181 | Error states (soft) |
| `--color-danger` | #EF4444 | #EF4444 | Destructive actions (delete) |

#### Text Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--text-primary` | #2D3748 | #E7E9EA | Headings, important text |
| `--text-secondary` | #718096 | #8B98A5 | Body text, descriptions |
| `--text-tertiary` | #A0AEC0 | #6E7C8A | Less important text |
| `--text-muted` | #8B9DB5 | #6E7C8A | Subtle text, hints |
| `--text-on-accent` | #FFFFFF | #FFFFFF | Text on colored backgrounds |

#### Background Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg-primary` | #FFFFFF | #0F1419 | Main page background |
| `--bg-secondary` | #F8FAFC | #1A1F26 | Subtle contrast areas |
| `--bg-tertiary` | #F1F5F9 | #1A1F26 | Third-level backgrounds |
| `--bg-elevated` | #FFFFFF | #242B33 | Cards, modals, elevated surfaces |
| `--bg-card` | (alias) | (alias) | Alias for `--bg-elevated` |
| `--bg-hover` | #F7FAFC | #2A323C | Hover states |

#### Border Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--border-light` | #E2E8F0 | #2F3841 | Subtle dividers |
| `--border-default` | #CBD5E0 | #3D4752 | Standard borders |

### Typography

#### Font Family
```css
--font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
```

#### Font Sizes
| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-xs` | 12px | Labels, badges, fine print |
| `--font-size-sm` | 14px | Secondary text, buttons |
| `--font-size-md` | 16px | Body text (default) |
| `--font-size-lg` | 18px | Subheadings |
| `--font-size-xl` | 24px | Section titles |
| `--font-size-2xl` | 32px | Page titles |

#### Font Weights
| Token | Value | Usage |
|-------|-------|-------|
| `--font-weight-normal` | 400 | Body text |
| `--font-weight-medium` | 500 | Subtle emphasis |
| `--font-weight-semibold` | 600 | Headings, labels |
| `--font-weight-bold` | 700 | Strong emphasis |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight gaps (icons, badges) |
| `--space-sm` | 8px | Small gaps (inline elements) |
| `--space-md` | 16px | Default spacing |
| `--space-lg` | 24px | Section spacing |
| `--space-xl` | 32px | Large sections |
| `--space-2xl` | 48px | Page-level spacing |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 8px | Buttons, inputs |
| `--radius-md` | 12px | Cards |
| `--radius-lg` | 16px | Large cards, modals |
| `--radius-full` | 9999px | Pills, avatars |

### Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation (cards) |
| `--shadow-md` | Medium elevation (dropdowns) |
| `--shadow-lg` | High elevation (modals) |

### Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | 150ms ease | Micro-interactions |
| `--transition-normal` | 200ms ease | Standard animations |
| `--transition-slow` | 300ms ease | Page transitions |

## Global Styles

### Headings

All headings (`h1`-`h6`) automatically use:
- `color: var(--text-primary)`
- `font-weight: var(--font-weight-semibold)`

### Section Titles

Use the `.section-title` class for uppercase section labels:

```html
<h2 class="section-title">System Health</h2>
```

This applies:
- `font-size: var(--font-size-sm)`
- `color: var(--text-primary)`
- `text-transform: uppercase`
- `letter-spacing: 0.5px`

## Page Layout

### Standard Page Structure

All page views should follow this structure for consistent layout:

```tsx
<div className="page-view">
  {/* Sticky header (optional) */}
  <header className="page-view__header">
    <h1>Page Title</h1>
  </header>

  {/* Scrollable content */}
  <div className="page-view__scrollable">
    <div className="page-view__content">
      {/* Centered content here */}
    </div>
  </div>
</div>
```

CSS pattern:
```css
.page-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-view__scrollable {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.page-view__content {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-lg);
}
```

## Best Practices

### Do's

1. **Always use semantic tokens** for colors, spacing, typography
2. **Use `--text-primary`** for headings and important text
3. **Use `--text-secondary`** for body/description text
4. **Use `--text-muted`** for hints and subtle text
5. **Use `--bg-elevated`** for cards and raised surfaces
6. **Test both light and dark modes** when adding new styles

### Don'ts

1. **Never hardcode colors** - always use CSS variables
2. **Never hardcode font sizes** - use the scale
3. **Avoid `!important`** - fix specificity issues properly
4. **Don't create new color values** without adding to `variables.css`

## Dark Mode

Dark mode is activated via `data-theme="dark"` on the `<html>` element. All tokens in `variables.css` are automatically overridden in the `[data-theme="dark"]` block.

To test dark mode compatibility:
1. Toggle theme in the app (top-right sun/moon icon)
2. Verify text is readable
3. Verify contrast is sufficient
4. Verify brand colors remain vibrant

## Adding New Tokens

When you need a new design token:

1. Add to `variables.css` in the appropriate section
2. Add dark mode variant in `[data-theme="dark"]`
3. Document in this file
4. Use throughout the codebase

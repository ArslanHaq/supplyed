# Theme colors

## How the theme changes

Use the palette button at the bottom-right of the site. Public pages use `PublicThemeControls`; signed-in pages use the **Theme** panel. Selecting a color calls `applyBrandTheme()` in `lib/theme.ts`, which updates five CSS variables on the `<html>` element. The selection is kept for the current browser session and returns to Supply blue after a full reload.

## Available colors

| Theme | Accent `--se` | Dark `--se-dark` | Light `--se-tint` | Border `--se-tint-2` |
| --- | --- | --- | --- | --- |
| Supply blue (default) | `#008CC4` | `#006D99` | `#E6F4F9` | `#C7E6F2` |
| Emerald | `#16A34A` | `#117F3A` | `#E8F6ED` | `#CCEBD7` |
| Violet | `#7C3AED` | `#612DB9` | `#F2EBFD` | `#E2D4FB` |
| Rose | `#E11D48` | `#B01738` | `#FCE8ED` | `#F8CDD7` |
| Amber | `#D97706` | `#A95D05` | `#FBF1E6` | `#F7E1C8` |
| Slate | `#334155` | `#283342` | `#EBECEE` | `#D2D5DA` |

`--se-rgb` is the accent converted to RGB values and is used where transparency is needed. Dark is the accent mixed with 22% black; light and border are mixed with 90% and 78% white.

Before JavaScript applies a selection, `app/globals.css` supplies these initial fallback values: `--se: #008CC4`, `--se-rgb: 0 140 196`, `--se-dark: #006E9A`, `--se-tint: #E5F4FA`, and `--se-tint-2: #CFEAF5`.

## Where each token is used

| Token | Exact UI areas |
| --- | --- |
| `--se` / `brand` | Supply**ED** logo mark, icons, links, selected checkboxes, focus rings, active progress steps, card accents, and map markers. |
| `--se-dark` / `brand-dark` | Primary buttons including **Join the waitlist**, workspace quick actions, strong theme text, outgoing message bubbles, and the **Be one of the first in** section background. |
| `--se-tint` / `brand-tint` | Selected navigation and filters, badges, icon backgrounds, form selections, availability cells, dashboard panels, and confirmation areas. |
| `--se-tint-2` / `brand-tint-2` | Themed borders, hover borders, dividers, and subtle card outlines. |
| `--se-rgb` | Transparent shadows, borders, gradients, and map grid details. |

The base defaults and Tailwind mappings live in `app/globals.css`. Theme presets and color derivation live in `lib/theme.ts`. Public-page usage is mainly in `components/styles/public.css` and `components/styles/waitlist.css`; account and app usage is in `account.css`, `foundation.css`, and `workspace.css`.

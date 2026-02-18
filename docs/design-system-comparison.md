# Design System Evaluation: OnceUI vs HeroUI

**Date:** 2026-02-17
**Context:** QTScout - Meeting minutes management system
**Current stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4, TipTap editor

## Current State

QTScout has 10 custom components (7 UI, 1 editor, 1 form, 1 provider) with no external component library. All styling is done with Tailwind CSS 4 utility classes. Complex UI patterns include a rich text editor (TipTap), multi-section forms with dynamic lists, toast/confirm dialogs, loading overlays, and skeleton loaders.

---

## OnceUI

**Site:** [once-ui.com](https://once-ui.com/) | **GitHub:** ~135 stars | **npm:** ~2,600 downloads/week | **License:** MIT

### What it is

An opinionated design system built exclusively for Next.js by a solo creator (Lorant One). Positions itself as "the indie design system" targeting small teams and freelancers. Claims 100+ components.

### Pros

- **Comprehensive component set** (100+): Table, Dialog, Toast, Sidebar, DatePicker, Select, Avatar, Timeline, Carousel, and visual effects (animations, glitch, parallax)
- **Built-in data visualization** via Recharts integration
- **Built-in dark mode** with system preference detection and localStorage persistence
- **Prop-driven API** - components are configured via props rather than utility classes, claims "70% less code than shadcn + Tailwind"
- **Next.js App Router aware** - includes Server/Client component variants (ServerFlex, ClientGrid, etc.)
- **Confirmed compatible** with React 19 and Next.js 15+
- **Free Figma kit** with synced design tokens
- **MIT license**

### Cons

- **Requires replacing Tailwind CSS with SCSS** - OnceUI uses Sass (`.scss`) and CSS custom properties, not Tailwind. This would mean rewriting all existing styling in QTScout. `sass ^1.77.6` is a required peer dependency.
- **Extremely small community** - 135 GitHub stars, ~2,600 npm downloads/week, 8 contributors. For comparison, shadcn/ui has 80k+ stars and HeroUI has 28k+.
- **Single maintainer risk** - The project is primarily maintained by one person. If they step away, the project stalls.
- **Heavy bundled dependencies** - Pulls in `recharts` (~200-400KB), `date-fns`, `prismjs`, `react-icons`, and `compressorjs` even if you don't use charts or code highlighting. Single npm package, so tree-shaking effectiveness is uncertain.
- **No track record at scale** - No publicly known production applications of significant size.
- **Next.js lock-in** - Cannot be used with plain React, Vite, Remix, or any non-Next.js framework.
- **Paywalled premium content** - Advanced templates (Magic Store, Magic Docs, Blocks) require a Pro subscription.

---

## HeroUI

**Site:** [heroui.com](https://www.heroui.com/) | **GitHub:** ~28,000 stars | **npm:** ~120,000 downloads/week | **License:** MIT

### What it is

A React component library formerly known as NextUI, rebranded in January 2025. Built on Tailwind CSS and Adobe's React Aria for accessibility. Two active versions: v2 (stable, Tailwind v3) and v3 (beta, Tailwind v4).

### Pros

- **Tailwind CSS native** - Components are styled with Tailwind classes and customized via a `classNames` prop with named slots. Fits naturally into QTScout's existing Tailwind workflow.
- **Strong accessibility** - Built on React Aria (Adobe), which provides robust ARIA patterns, keyboard navigation, and screen reader support out of the box.
- **Large, active community** - 28k GitHub stars, ~120k weekly npm downloads, 30+ contributors, active development (last commit: Feb 16, 2026).
- **Rich Table component** (v2) - Sorting, pagination, virtualization, row selection, sticky headers. Useful for meeting lists.
- **Good form components** - Input, Textarea, Select, Autocomplete, DatePicker, DateRangePicker, TimeInput, Checkbox, RadioGroup, Switch, Slider.
- **Polished animations** via Framer Motion with minimal configuration.
- **Individual package imports** - Install only what you use (`@heroui/button`, `@heroui/table`, etc.) for smaller bundles.
- **Dark mode** built-in, integrates with `next-themes`.
- **Works beyond Next.js** - Also supports Vite, Remix, Astro.
- **MIT license**

### Cons

- **Tailwind version mismatch** - v2 (stable) uses Tailwind CSS v3. QTScout uses Tailwind v4. v2.8.0 added a Tailwind v4 "compatibility mode," but native v4 support is only in v3 beta.
- **v3 is still in beta** - The v3 release (native Tailwind v4) was targeted for Q4 2025 but has not shipped as of Feb 2026. Missing critical components like Table. Using beta in production carries risk.
- **No Sidebar component** - Neither v2 nor v3 includes a dedicated Sidebar. You would keep the custom one or use the paid HeroUI Pro templates.
- **Framer Motion dependency** - Adds ~212KB to the bundle. Can be mitigated by disabling animations globally (`disableAnimation` on provider), which prevents Framer Motion from being included.
- **v2 to v3 migration has breaking changes** - Adopting v2 now means a future migration effort when v3 stabilizes (ripple removal, changed APIs, removed props).
- **Some components missing from v3 beta** - Table, Navbar, Drawer, Progress, Pagination are not yet ported.
- **HeroUI Pro is paid** - 220+ premium components (including sidebars, dashboards) require a one-time purchase. The open-source library has a more limited set.

---

## Side-by-Side Comparison

| Criteria | OnceUI | HeroUI |
|---|---|---|
| **Tailwind CSS compatible** | No (SCSS-based) | Yes (native) |
| **Migration effort for QTScout** | Very high (rewrite all styles) | Low-medium (add provider + swap components incrementally) |
| **Component count** | 100+ | ~50+ (v2 stable) |
| **Has Sidebar** | Yes | No |
| **Has Table** | Yes | Yes (v2), not yet (v3 beta) |
| **Has DatePicker** | Yes | Yes |
| **Has Toast** | Yes | Via extension (v2), built-in (v3) |
| **Dark mode** | Built-in | Built-in |
| **Accessibility** | Custom implementation | React Aria (Adobe) |
| **GitHub stars** | ~135 | ~28,000 |
| **npm downloads/week** | ~2,600 | ~120,000 |
| **Contributors** | 8 (1 primary) | 30+ |
| **React 19 support** | Yes | Yes |
| **Next.js 15 support** | Yes | Yes |
| **Tailwind v4 support** | N/A | v3 beta only |
| **Styling approach** | SCSS + CSS variables | Tailwind + tailwind-variants |
| **Bundle size concern** | Heavy (recharts, prismjs, etc.) | Medium (framer-motion) |
| **Framework lock-in** | Next.js only | Any React framework |
| **License** | MIT | MIT |
| **Maturity** | Early stage | Established |

---

## Impact on QTScout

### What would need to change

**With OnceUI:**
- Remove Tailwind CSS 4 entirely
- Add Sass as a dependency
- Rewrite **all** component styling from Tailwind classes to OnceUI's prop-based API and SCSS
- Replace custom sidebar, toast, skeleton, loading overlay, theme toggle with OnceUI equivalents
- TipTap editor styling would need to be redone in SCSS
- Essentially a full frontend rewrite

**With HeroUI (v2 stable):**
- Add `@heroui/react` or individual packages
- Add `framer-motion` dependency
- Wrap app with `HeroUIProvider` in root layout
- Deal with Tailwind v3/v4 compatibility (v2.8.0 has a compatibility mode)
- Incrementally replace custom components: form inputs, table/list, toast, skeleton, breadcrumbs
- Keep custom sidebar (HeroUI has no sidebar)
- Keep TipTap editor as-is (Tailwind styling still works)
- Can be done gradually, component by component

**With HeroUI v3 (beta):**
- Native Tailwind v4 support, no compatibility hacks
- But missing Table, Navbar, Pagination - would need to wait or use v2 components alongside
- Risk of breaking changes between beta releases

### Components QTScout could replace

| Current custom component | OnceUI equivalent | HeroUI equivalent |
|---|---|---|
| sidebar.tsx | Sidebar | None (keep custom) |
| breadcrumbs.tsx | N/A (build with Flex) | Breadcrumbs |
| loading-overlay.tsx | Spinner + Feedback | Spinner + Modal |
| toast.tsx | Toast/Toaster | Toast (v3) or sonner integration |
| theme-toggle.tsx | ThemeSwitcher | Use with next-themes |
| skeleton.tsx | Skeleton | Skeleton |
| keyboard-shortcuts.tsx | N/A (keep custom) | N/A (keep custom) |
| meeting-form.tsx inputs | Input, Select, DateInput, TagInput | Input, Select, DatePicker, Autocomplete |

---

## Recommendation Summary

| Factor | Winner |
|---|---|
| Fits current Tailwind stack | **HeroUI** |
| Migration effort | **HeroUI** (incremental vs full rewrite) |
| Component breadth | OnceUI (100+ vs ~50) |
| Community & longevity | **HeroUI** (28k stars, 30+ contributors) |
| Accessibility | **HeroUI** (React Aria) |
| Sidebar included | OnceUI |
| Risk level | **HeroUI** (lower risk, established project) |
| Tailwind v4 today | Neither is ideal (OnceUI: no Tailwind; HeroUI v3: beta) |

**OnceUI** is compelling on paper with more components, but the SCSS requirement makes it impractical for QTScout without a full frontend rewrite. The tiny community and single-maintainer risk add further concern.

**HeroUI** is the safer choice given QTScout's Tailwind-based architecture. The practical path would be to use **v2 stable with Tailwind v4 compatibility mode** today and migrate to v3 when it reaches stable. The main gap is the lack of a Sidebar component (which QTScout already has custom-built).

A third option worth noting: **shadcn/ui** (not evaluated here but widely adopted) uses the same Tailwind + Radix UI approach, gives full code ownership via copy-paste, and has the largest community (~80k stars). It could be worth evaluating as an alternative if the goal is to improve UI consistency without taking on a library dependency.

# LLM Prompt: Generate a Modern Tailwind CSS Theme with shadcn/ui (Light & Dark)

## ---PROMPT START---

You are an expert frontend designer and Tailwind CSS architect. Your task is to generate a **complete, production-ready theme system** for a project using **Tailwind CSS v4+**, **shadcn/ui**, and **CSS custom properties (variables)**.

---

### 🎯 Project Context

- **Project type**: "B2B SaaS dashboard - Retail CTRL"
- **Framework**: "Vue 3 Composition API"
- **UI library**: shadcn/ui (with Tailwind CSS)
- **Design style**: Modern and minimalist
- **Theme modes**: Light mode + Dark mode

---

### 📐 Design Principles to Follow

1. **Minimalist**: Clean layouts, generous whitespace, no visual clutter
2. **Modern**: Subtle shadows, rounded corners, smooth transitions
3. **Accessible**: WCAG 2.1 AA contrast ratios minimum (4.5:1 for text, 3:1 for large text/UI)
4. **Consistent**: Every color, spacing, and radius should come from the theme variables — no hardcoded values
5. **Scalable**: Easy to add new themes (e.g., "high contrast", "brand variation") later

---

### 🎨 Theme Variables to Generate

Generate a **complete CSS variables file** using the **HSL color format** (shadcn/ui standard). Include ALL of these semantic tokens:

#### Core Colors

| Variable                   | Purpose                       |
| -------------------------- | ----------------------------- |
| `--background`             | Page/app background           |
| `--foreground`             | Default text color            |
| `--card`                   | Card/surface background       |
| `--card-foreground`        | Text on cards                 |
| `--popover`                | Popover/dropdown background   |
| `--popover-foreground`     | Text in popovers              |
| `--primary`                | Primary action buttons, links |
| `--primary-foreground`     | Text on primary color         |
| `--secondary`              | Secondary buttons, badges     |
| `--secondary-foreground`   | Text on secondary color       |
| `--muted`                  | Muted/disabled backgrounds    |
| `--muted-foreground`       | Muted/secondary text          |
| `--accent`                 | Hover states, highlights      |
| `--accent-foreground`      | Text on accent color          |
| `--destructive`            | Error/danger actions          |
| `--destructive-foreground` | Text on destructive color     |

#### UI Structure

| Variable   | Purpose               |
| ---------- | --------------------- |
| `--border` | Default borders       |
| `--input`  | Input field borders   |
| `--ring`   | Focus ring color      |
| `--radius` | Default border-radius |

#### Sidebar (if applicable)

| Variable                       | Purpose             |
| ------------------------------ | ------------------- |
| `--sidebar-background`         | Sidebar bg          |
| `--sidebar-foreground`         | Sidebar text        |
| `--sidebar-primary`            | Active sidebar item |
| `--sidebar-primary-foreground` | Text on active item |
| `--sidebar-accent`             | Sidebar hover state |
| `--sidebar-accent-foreground`  | Text on hover state |
| `--sidebar-border`             | Sidebar border      |
| `--sidebar-ring`               | Sidebar focus ring  |

#### Chart Colors (for data visualization)

| Variable                        | Purpose                       |
| ------------------------------- | ----------------------------- |
| `--chart-1` through `--chart-5` | 5 distinct chart/graph colors |

---

### 📦 Output Format

Generate the theme in **this exact structure**:

#### 1. CSS Variables File (`globals.css` or `app.css`)

```css
@layer base {
  :root {
    /* Light theme values here — HSL values WITHOUT hsl() wrapper */
    /* Example: --background: 0 0% 100%; */
  }

  .dark {
    /* Dark theme values here */
  }
}
```

#### 2. Tailwind Config Extension (if needed for v3, or `@theme` block for v4)

Show how to wire the CSS variables into `tailwind.config.js` (v3) or the new `@theme` directive (v4).

#### 3. Theme Toggle Utility

Provide a simple, reusable composable/hook for toggling between light and dark mode that:

- Reads system preference on first load (`prefers-color-scheme`)
- Persists user choice in `localStorage`
- Applies `.dark` class to `<html>` element
- [REPLACE framework: "Write it as a Vue 3 composable" / "Write it as a React hook"]

#### 4. Example Component

Show a **before/after** example of a shadcn/ui `Card` component using the theme variables, demonstrating that it works in both light and dark mode without any code changes.

---

### ⚙️ Best Practices to Apply

- **HSL format without wrapper**: Use `210 40% 98%` not `hsl(210, 40%, 98%)` — shadcn/ui applies the `hsl()` wrapper in Tailwind config
- **Semantic naming**: Never use color-specific names like `--blue-500`. Always use purpose-based names like `--primary`
- **Dark mode contrast**: Don't just invert colors. Dark mode should feel **designed**, not auto-generated. Reduce brightness, slightly warm grays, soften contrasts
- **Neutral palette**: Use slightly warm or cool grays (not pure gray) for a more refined feel. Example: slate, zinc, or stone from Tailwind's palette as a base
- **Consistent spacing scale**: Recommend a spacing/radius scale that pairs well with the theme
- **Transition support**: Add `transition-colors` to `body` or global styles so theme switching feels smooth

---

### 🚫 Avoid These Common Mistakes

1. **Pure black (#000) backgrounds in dark mode** — use dark grays like `hsl(222, 20%, 8%)` instead
2. **Same border colors for both themes** — borders need different opacity/values per theme
3. **Forgetting `--ring` color** — focus rings are critical for keyboard accessibility
4. **Low contrast muted text** — even muted text must meet 4.5:1 ratio
5. **Missing `--input` variable** — input borders often differ from general borders
6. **Hardcoded colors in components** — everything must reference theme variables

---

### 🎨 Color Palette Direction

[CHOOSE ONE OR CUSTOMIZE]:

**Option A — Neutral Minimal** (recommended for SaaS/dashboards):
Base: Slate/Zinc grays, Primary: Subtle blue or indigo, Accent: Warm amber or teal

- i like these colors:
- 'bg-gradient-to-t from-cyan-600 to-cyan-400'
- bg-gradient-to-t from-cyan-600/70 to-cyan-500/50'

Use these color as the base to the website,

---

## ---PROMPT END---

---

# WaaS CMS — UI Engine (Locked Component Templates)

A production-grade, strictly-typed UI rendering engine for the multi-tenant Website-as-a-Service CMS. Built with the **locked-engine philosophy**: no raw HTML execution, no user-supplied JavaScript, no `dangerouslySetInnerHTML`, no `eval`, no template injection.

## Architecture

```
ui-engine/
├── component-registry.js    # All component definitions + schema validation
├── layout-renderer.js       # Full-page renderer from layout configs
├── schemas/
│   ├── school-schema.json   # JSON Schema for school tenant templates
│   └── business-schema.json # JSON Schema for business tenant templates
├── sample-data/
│   ├── school-greenwood.json    # Full layout config for a school tenant
│   └── cafe-riverside.json      # Full layout config for a small business
└── README.md
```

## The Locked-Engine Philosophy

**Components are locked — not extended at runtime.** Every UI component is:

1. **Hardcoded** — each component's render function is hand-written, not generated from templates
2. **Typed** — each component defines a JSON Schema that all incoming data must satisfy
3. **Tested** — every component has comprehensive rendering, accessibility, and XSS tests
4. **Accessible** — semantic HTML5 + ARIA attributes throughout

This means:
- No CMS admin can inject arbitrary HTML/JS through the content editor
- No template engine can be subverted (no `{{ }}`, no `handlebars`, no `ejs`)
- Every page output is deterministic and audit-safe
- XSS is structurally impossible (all text is escaped, no raw HTML passthrough exists)

## Component Registry

All components live in `component-registry.js`. Each component exports `{ type, schema, render }`.

### Available Components

| Type | Purpose | Key ARIA/Semantic |
|------|---------|-------------------|
| `hero` | Hero banner with heading, subheading, CTA | `role="region"`, `<h1>` |
| `nav-bar` | Top navigation with logo, menu, CTA | `role="navigation"`, `<nav>` |
| `notification-banner` | Dismissible alert banners | `role="alert"`/`role="status"` |
| `about-section` | About section with image + text | `role="region"`, `<h2>` |
| `services-grid` | Grid of service cards | `<article>` per card |
| `business-hours` | Weekly hours table | `<table>`, `<thead>`, `<th>` |
| `event-calendar` | Event listings | `<time>` with `datetime` |
| `contact-form` | Accessible form builder | `aria-required`, labels |
| `documents-list` | Downloadable document list | `<ul>`, `download` attr |
| `footer` | Multi-column footer | `<footer>`, `role="contentinfo"` |

### Component API

```js
const { getComponent, renderComponent, validateComponentData } = require('./component-registry');

// Look up a component
const hero = getComponent('hero');

// Validate data against schema
const { valid, errors } = validateComponentData('hero', data);

// Render to HTML string
const html = renderComponent('hero', { heading: 'Welcome' });
```

## Layout Renderer

The `layout-renderer.js` takes an ordered array of slot configurations and produces a complete HTML5 document.

### Usage

```js
const { renderLayout } = require('./layout-renderer');

const result = renderLayout({
  layout: [
    { slot_key: 'nav',   component_type: 'nav-bar', data: { ... } },
    { slot_key: 'hero',  component_type: 'hero',    data: { ... } },
    { slot_key: 'footer',component_type: 'footer',  data: { ... } },
  ],
  pageConfig: {
    title: 'My Site',
    description: 'Site description',
    lang: 'en',
  },
});

console.log(result.html);    // Complete HTML string
console.log(result.warnings); // Any validation warnings
```

### Error Handling

If a component's data fails schema validation, the layout renderer does **not** crash — it renders a fallback error `<div>` in its place and records a warning. This ensures the page always renders.

### Page Features

- HTML5 doctype and structure
- Viewport meta tag for mobile responsiveness
- Language attribute (configurable)
- Skip-to-main-content accessibility link
- Minimal CSS reset and component styles (inline `<style>`)

## Vertical-Specific Schemas

JSON Schema files define which components are required/allowed per vertical:

### School Template (`school-schema.json`)

| Slot | Required |
|------|----------|
| `hero` | ✅ |
| `nav-bar` | ✅ |
| `notification-banner` | ✅ |
| `about-section` | ✅ |
| `event-calendar` | ✅ |
| `documents-list` | ✅ |
| `footer` | ✅ |
| `services-grid` | Optional |
| `contact-form` | Optional |

### Small Business Template (`business-schema.json`)

| Slot | Required |
|------|----------|
| `hero` | ✅ |
| `nav-bar` | ✅ |
| `about-section` | ✅ |
| `services-grid` | ✅ |
| `business-hours` | ✅ |
| `contact-form` | ✅ |
| `footer` | ✅ |
| `notification-banner` | Optional |

## Adding a New Component

1. **Define the render function** in `component-registry.js`:
   - Write a pure function that takes typed data and returns HTML
   - Use `escape()` from the module for all user-supplied text
   - Use semantic HTML5 elements
   - Include ARIA attributes (`role`, `aria-label`, `aria-required`, etc.)

2. **Define the JSON Schema** — declare required fields, types, and enums

3. **Register it** in the `components` object at the top of the file

4. **Add tests** in `tests/test_ui_engine.mjs`:
   - Test valid HTML output
   - Test ARIA/semantic attributes
   - Test schema validation (valid and invalid data)
   - Test XSS escaping

5. **Update vertical schemas** (`school-schema.json`, `business-schema.json`) if the component should be available in those templates

## Running Tests

```bash
node --test tests/test_ui_engine.mjs
```

Or with watch mode:
```bash
node --test --watch tests/test_ui_engine.mjs
```

## Security

- **All user text is HTML-escaped** — the `escape()` function handles `< > & " ' /`
- **No dangerouslySetInnerHTML equivalent** — no function in the registry uses raw HTML insertion
- **No eval, no new Function, no template literals with user data** — only `escape()` + string concatenation
- **Schema validation blocks malformed data** before it reaches render functions
- **Fallback error components** prevent crashes from poisoning page output

## XSS Prevention Guarantee

Every render function escapes all dynamic content through a single `escape()` function. The escape function handles these characters:

| Char | Entity |
|------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#x27;` |
| `/` | `&#x2F;` |

This is applied to all heading text, body text, labels, button text, menu items, descriptions, copyright text, and attribute values (via `escapeAttr()`).

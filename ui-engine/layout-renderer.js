/**
 * Layout Renderer — WaaS CMS Multi-Tenant UI Engine
 *
 * Takes a layout configuration (ordered array of {slot_key, component_type, data})
 * and renders the full page by looking up each component in the registry.
 *
 * ARCHITECTURAL MANDATE:
 * - Schema validation before rendering. Invalid components render a fallback
 *   error component instead of crashing.
 * - All output is valid HTML5 with viewport meta, lang attribute, and semantic
 *   structure.
 * - NO raw HTML execution or user-supplied JavaScript.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { getComponent, renderComponent, validateComponentData, listComponents } = require('./component-registry');

// ─── Fallback Error Component ─────────────────────────────────────────────────

/**
 * Renders a fallback error component when validation fails.
 * This prevents the entire page from crashing.
 */
function renderErrorComponent(slotKey, componentType, errors) {
  const errorSummary = Array.isArray(errors) ? errors.join('; ') : String(errors);
  return `<div class="component-error" role="alert" data-slot="${slotKey}" data-component="${componentType}">
  <p><strong>Component Error:</strong> Failed to render "${componentType}" in slot "${slotKey}"</p>
  <p class="component-error-detail">${escapeHtml(errorSummary)}</p>
</div>`;
}

// ─── XSS Escaping ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─── Layout Config Validation ─────────────────────────────────────────────────

/**
 * Validate the layout configuration structure itself.
 */
function validateLayoutConfig(layout) {
  const errors = [];

  if (!Array.isArray(layout)) {
    return { valid: false, errors: ['Layout configuration must be an array of slot objects'] };
  }

  for (let i = 0; i < layout.length; i++) {
    const slot = layout[i];

    if (!slot || typeof slot !== 'object') {
      errors.push(`Slot at index ${i} is not a valid object`);
      continue;
    }

    if (!slot.slot_key || typeof slot.slot_key !== 'string') {
      errors.push(`Slot at index ${i} is missing required field: "slot_key" (string)`);
    }

    if (!slot.component_type || typeof slot.component_type !== 'string') {
      errors.push(`Slot at index ${i} is missing required field: "component_type" (string)`);
    } else {
      const available = listComponents();
      if (!available.includes(slot.component_type)) {
        errors.push(`Slot "${slot.slot_key}" at index ${i}: unknown component_type "${slot.component_type}". Available: ${available.join(', ')}`);
      }
    }

    if (slot.data !== undefined && (typeof slot.data !== 'object' || slot.data === null)) {
      errors.push(`Slot "${slot.slot_key}" at index ${i}: "data" must be an object or omitted`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

/**
 * Build the <head> content including title and meta tags.
 */
function buildHead(pageConfig = {}) {
  const title = pageConfig.title || 'WaaS CMS Site';
  const description = pageConfig.description || '';
  const lang = pageConfig.lang || 'en';

  return `<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* Minimal reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #1a1a1a; background: #fff; }
    img { max-width: 100%; height: auto; display: block; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    /* Component error */
    .component-error { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 1rem; margin: 0.5rem 0; color: #991b1b; }
    .component-error-detail { font-size: 0.875rem; margin-top: 0.25rem; font-family: monospace; }
    /* Hero */
    .component-hero { padding: 4rem 2rem; text-align: center; background-color: #f0f9ff; min-height: 300px; display: flex; align-items: center; justify-content: center; }
    .component-hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero-subheading { font-size: 1.25rem; color: #4b5563; margin-bottom: 1.5rem; }
    .hero-cta { display: inline-block; padding: 0.75rem 2rem; background: #2563eb; color: #fff; border-radius: 6px; font-weight: 600; }
    .hero-cta:hover { background: #1d4ed8; text-decoration: none; }
    /* About */
    .component-about { padding: 3rem 2rem; display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; max-width: 1200px; margin: 0 auto; }
    .component-about .about-image { width: 100%; max-width: 500px; border-radius: 8px; }
    .component-about .about-text { flex: 1; min-width: 280px; }
    .component-about h2 { font-size: 2rem; margin-bottom: 1rem; }
    /* Services Grid */
    .component-services-grid { padding: 3rem 2rem; background: #f9fafb; }
    .component-services-grid h2 { text-align: center; font-size: 2rem; margin-bottom: 2rem; }
    .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .service-card { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .service-card h3 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .service-icon { font-size: 2rem; display: block; margin-bottom: 0.75rem; }
    .service-price { font-weight: 600; color: #059669; margin-top: 0.5rem; }
    /* Contact Form */
    .component-contact-form { padding: 3rem 2rem; max-width: 600px; margin: 0 auto; }
    .component-contact-form h2 { font-size: 2rem; margin-bottom: 0.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem; }
    .form-group textarea { min-height: 120px; }
    .btn-submit { background: #2563eb; color: #fff; padding: 0.75rem 2rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    .btn-submit:hover { background: #1d4ed8; }
    /* Business Hours */
    .component-business-hours { padding: 3rem 2rem; max-width: 600px; margin: 0 auto; }
    .component-business-hours h2 { font-size: 2rem; margin-bottom: 1rem; }
    .hours-table { width: 100%; border-collapse: collapse; }
    .hours-table th, .hours-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .hours-table th { background: #f9fafb; font-weight: 600; }
    /* Event Calendar */
    .component-event-calendar { padding: 3rem 2rem; max-width: 900px; margin: 0 auto; }
    .component-event-calendar h2 { font-size: 2rem; margin-bottom: 1.5rem; }
    .event-item { display: flex; gap: 1.5rem; padding: 1.5rem 0; border-bottom: 1px solid #e5e7eb; }
    .event-item time { min-width: 100px; font-weight: 700; color: #2563eb; }
    .event-details h3 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .event-meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem; }
    /* Notification Banner */
    .component-notification-banner { padding: 0.75rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .banner-info { background: #eff6ff; color: #1e40af; border-bottom: 1px solid #bfdbfe; }
    .banner-warning { background: #fffbeb; color: #92400e; border-bottom: 1px solid #fde68a; }
    .banner-alert { background: #fef2f2; color: #991b1b; border-bottom: 1px solid #fca5a5; }
    .banner-success { background: #f0fdf4; color: #166534; border-bottom: 1px solid #bbf7d0; }
    .banner-dismiss { background: none; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem; color: inherit; }
    /* Documents List */
    .component-documents-list { padding: 3rem 2rem; max-width: 800px; margin: 0 auto; }
    .component-documents-list h2 { font-size: 2rem; margin-bottom: 1.5rem; }
    .documents-list { list-style: none; }
    .document-item { padding: 1rem 0; border-bottom: 1px solid #e5e7eb; }
    .document-link { display: flex; align-items: center; gap: 0.75rem; }
    .document-icon { font-size: 1.5rem; }
    .document-title { font-weight: 600; }
    .document-meta { color: #6b7280; font-size: 0.875rem; }
    .document-desc { margin-top: 0.25rem; color: #4b5563; font-size: 0.875rem; }
    /* Footer */
    .component-footer { background: #1f2937; color: #e5e7eb; padding: 3rem 2rem 1.5rem; }
    .footer-columns { display: flex; gap: 2rem; flex-wrap: wrap; max-width: 1200px; margin: 0 auto; }
    .footer-column { flex: 1; min-width: 200px; }
    .footer-column h3 { color: #fff; margin-bottom: 1rem; font-size: 1.125rem; }
    .footer-column ul { list-style: none; }
    .footer-column li { margin-bottom: 0.5rem; }
    .footer-column a { color: #9ca3af; }
    .footer-column a:hover { color: #fff; }
    .footer-social { max-width: 1200px; margin: 2rem auto 1rem; text-align: center; }
    .social-link { display: inline-block; margin: 0 0.5rem; color: #9ca3af; font-size: 1.25rem; }
    .footer-bottom { text-align: center; padding-top: 1.5rem; border-top: 1px solid #374151; max-width: 1200px; margin: 1rem auto 0; }
    .footer-bottom p { color: #9ca3af; font-size: 0.875rem; }
    /* Nav Bar */
    .component-nav-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 2rem; background: #fff; border-bottom: 1px solid #e5e7eb; }
    .nav-logo { font-size: 1.5rem; font-weight: 700; color: #1a1a1a; }
    .nav-menu { display: flex; gap: 1.5rem; list-style: none; }
    .nav-menu a { color: #4b5563; font-weight: 500; }
    .nav-menu a:hover { color: #2563eb; }
    .nav-cta { padding: 0.5rem 1.5rem; background: #2563eb; color: #fff; border-radius: 6px; font-weight: 600; }
    .nav-cta:hover { background: #1d4ed8; text-decoration: none; }
    .nav-toggle { display: none; background: none; border: none; font-size: 1.5rem; cursor: pointer; }
    @media (max-width: 768px) { .nav-toggle { display: block; } .nav-menu { display: none; } }
  </style>
  ${pageConfig.headInject || ''}
</head>`;
}

/**
 * Render a full HTML page from a layout configuration.
 *
 * @param {object} options
 * @param {Array}  options.layout       - Ordered array of {slot_key, component_type, data}
 * @param {object} [options.pageConfig] - Page-level config: {title, description, lang, headInject}
 * @returns {{ html: string, warnings: string[] }}
 */
function renderLayout({ layout, pageConfig = {} }) {
  const warnings = [];
  const bodyParts = [];

  // Validate layout config structure
  const layoutValidation = validateLayoutConfig(layout);
  if (!layoutValidation.valid) {
    warnings.push(...layoutValidation.errors.map((e) => `Layout validation: ${e}`));
    // Render what we can
  }

  // Render each component
  for (const slot of layout) {
    if (!slot || !slot.component_type) continue;

    try {
      // Validate component data
      const data = slot.data || {};
      const validation = validateComponentData(slot.component_type, data);

      if (!validation.valid) {
        warnings.push(
          `Slot "${slot.slot_key}" (${slot.component_type}): validation failed — ${validation.errors.join('; ')}`
        );
        bodyParts.push(renderErrorComponent(slot.slot_key, slot.component_type, validation.errors));
      } else {
        const html = renderComponent(slot.component_type, data);
        bodyParts.push(`<!-- slot: ${slot.slot_key} -->\n${html}`);
      }
    } catch (err) {
      warnings.push(`Slot "${slot.slot_key}" (${slot.component_type}): ${err.message}`);
      bodyParts.push(renderErrorComponent(slot.slot_key, slot.component_type, [err.message]));
    }
  }

  const lang = pageConfig.lang || 'en';
  const html = `<!DOCTYPE html>
<html lang="${lang}">
${buildHead(pageConfig)}
<body>
  <a href="#main-content" class="skip-link" style="position:absolute;top:-100%;left:0;background:#2563eb;color:#fff;padding:0.5rem 1rem;z-index:9999;">Skip to main content</a>
  <main id="main-content">
    ${bodyParts.join('\n    ')}
  </main>
</body>
</html>`;

  return { html, warnings };
}

// ─── Load and validate a layout from a JSON file ──────────────────────────────

/**
 * Load a layout configuration from a JSON file path, render it, and return
 * the result. Useful for CLI / integration.
 */
function renderFromFile(filePath, pageConfig = {}) {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  const layout = JSON.parse(raw);
  return renderLayout({ layout, pageConfig });
}

module.exports = {
  renderLayout,
  renderFromFile,
  validateLayoutConfig,
  renderErrorComponent,
};

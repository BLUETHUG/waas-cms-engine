/**
 * Component Registry — Locked Component Templates for WaaS CMS
 *
 * ARCHITECTURAL MANDATE: STRICTLY typed JSON schema blocks → hardcoded,
 * accessible render functions. NO raw HTML execution, NO eval, NO template
 * injection, NO dangerouslySetInnerHTML. Every component is fully accessible
 * with semantic HTML and ARIA attributes.
 *
 * Each component is registered as { type, schema, render(data) } where:
 *   - schema: a JSON Schema describing the expected data shape
 *   - render(data): a pure function returning an HTML string
 *
 * Escape all user-supplied data to prevent XSS.
 */

'use strict';

// ─── HTML Escaping (XSS Prevention) ───────────────────────────────────────────

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

function escape(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

function escapeAttr(str) {
  // Same as escape but safe for attribute context
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// ─── Helper to build attribute strings ────────────────────────────────────────

function attrs(map) {
  const parts = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === true) {
      parts.push(`${key}`);
    } else if (value !== false && value != null) {
      parts.push(`${key}="${escapeAttr(String(value))}"`);
    }
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

// ─── Component Renderers ──────────────────────────────────────────────────────

const components = {};

// --- hero ---
components.hero = {
  type: 'hero',
  schema: {
    type: 'object',
    required: ['heading'],
    properties: {
      heading: { type: 'string' },
      subheading: { type: 'string' },
      cta_text: { type: 'string' },
      cta_url: { type: 'string', format: 'uri' },
      background_image: { type: 'string' },
    },
  },
  render(data) {
    const bgStyle = data.background_image
      ? ` style="background-image: url('${escapeAttr(data.background_image)}'); background-size: cover; background-position: center;"`
      : '';
    const cta =
      data.cta_text && data.cta_url
        ? `<a href="${escapeAttr(data.cta_url)}" class="hero-cta" role="button">${escape(data.cta_text)}</a>`
        : '';

    return `<section class="component-hero"${bgStyle} role="region" aria-label="Hero banner">
  <div class="hero-content">
    <h1>${escape(data.heading)}</h1>
    ${data.subheading ? `<p class="hero-subheading">${escape(data.subheading)}</p>` : ''}
    ${cta}
  </div>
</section>`;
  },
};

// --- about-section ---
components['about-section'] = {
  type: 'about-section',
  schema: {
    type: 'object',
    required: ['title', 'body'],
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      image: { type: 'string' },
    },
  },
  render(data) {
    const imgHtml = data.image
      ? `<img src="${escapeAttr(data.image)}" alt="${escapeAttr(data.title || 'About image')}" class="about-image" loading="lazy" />`
      : '';

    return `<section class="component-about" role="region" aria-label="${escapeAttr(data.title)}">
  ${imgHtml}
  <div class="about-text">
    <h2>${escape(data.title)}</h2>
    <p>${escape(data.body)}</p>
  </div>
</section>`;
  },
};

// --- services-grid ---
components['services-grid'] = {
  type: 'services-grid',
  schema: {
    type: 'object',
    required: ['services'],
    properties: {
      title: { type: 'string' },
      services: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'description'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            icon: { type: 'string' },
            price: { type: 'string' },
          },
        },
      },
    },
  },
  render(data) {
    const titleHtml = data.title ? `<h2>${escape(data.title)}</h2>` : '';
    const items = data.services
      .map(
        (svc, i) => `<article class="service-card" aria-label="${escapeAttr(svc.title)}">
  ${svc.icon ? `<span class="service-icon" aria-hidden="true">${escape(svc.icon)}</span>` : ''}
  <h3>${escape(svc.title)}</h3>
  <p>${escape(svc.description)}</p>
  ${svc.price ? `<p class="service-price">${escape(svc.price)}</p>` : ''}
</article>`
      )
      .join('\n    ');

    return `<section class="component-services-grid" role="region" aria-label="Services">
  ${titleHtml}
  <div class="services-grid">
    ${items}
  </div>
</section>`;
  },
};

// --- contact-form ---
components['contact-form'] = {
  type: 'contact-form',
  schema: {
    type: 'object',
    required: ['fields'],
    properties: {
      title: { type: 'string' },
      subtitle: { type: 'string' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'label', 'required'],
          properties: {
            type: { type: 'string', enum: ['text', 'email', 'tel', 'textarea'] },
            label: { type: 'string' },
            placeholder: { type: 'string' },
            required: { type: 'boolean' },
          },
        },
      },
      submit_text: { type: 'string' },
    },
  },
  render(data) {
    const titleHtml = data.title ? `<h2>${escape(data.title)}</h2>` : '';
    const subtitleHtml = data.subtitle ? `<p>${escape(data.subtitle)}</p>` : '';
    const submitText = data.submit_text || 'Submit';

    const fieldHtml = data.fields
      .map((f, i) => {
        const id = `contact-field-${i}`;
        const requiredAttr = f.required ? ' required' : '';
        const requiredStar = f.required ? ' <span aria-hidden="true">*</span>' : '';

        if (f.type === 'textarea') {
          return `<div class="form-group">
  <label for="${id}">${escape(f.label)}${requiredStar}</label>
  <textarea id="${id}" name="field_${i}" placeholder="${escapeAttr(f.placeholder || '')}"${requiredAttr} aria-required="${f.required}"></textarea>
</div>`;
        }

        return `<div class="form-group">
  <label for="${id}">${escape(f.label)}${requiredStar}</label>
  <input type="${escapeAttr(f.type)}" id="${id}" name="field_${i}" placeholder="${escapeAttr(f.placeholder || '')}"${requiredAttr} aria-required="${f.required}" />
</div>`;
      })
      .join('\n      ');

    return `<section class="component-contact-form" role="region" aria-label="Contact form">
  ${titleHtml}
  ${subtitleHtml}
  <form novalidate onsubmit="return false;" aria-label="Contact form">
    ${fieldHtml}
    <button type="submit" class="btn-submit">${escape(submitText)}</button>
  </form>
</section>`;
  },
};

// --- business-hours ---
components['business-hours'] = {
  type: 'business-hours',
  schema: {
    type: 'object',
    required: ['hours'],
    properties: {
      title: { type: 'string' },
      hours: {
        type: 'array',
        items: {
          type: 'object',
          required: ['day'],
          properties: {
            day: { type: 'string' },
            open: { type: 'string' },
            close: { type: 'string' },
            is_closed: { type: 'boolean' },
          },
        },
      },
    },
  },
  render(data) {
    const titleHtml = data.title ? `<h2>${escape(data.title)}</h2>` : '';
    const rows = data.hours
      .map(
        (h) => `<tr>
  <td scope="row">${escape(h.day)}</td>
  <td>${h.is_closed ? 'Closed' : `${escape(h.open || '')} – ${escape(h.close || '')}`}</td>
</tr>`
      )
      .join('\n      ');

    return `<section class="component-business-hours" role="region" aria-label="Business hours">
  ${titleHtml}
  <table class="hours-table" aria-label="Business hours schedule">
    <thead>
      <tr>
        <th scope="col">Day</th>
        <th scope="col">Hours</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</section>`;
  },
};

// --- event-calendar ---
components['event-calendar'] = {
  type: 'event-calendar',
  schema: {
    type: 'object',
    required: ['events'],
    properties: {
      title: { type: 'string' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date', 'title', 'description', 'time', 'location'],
          properties: {
            date: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            time: { type: 'string' },
            location: { type: 'string' },
            link: { type: 'string' },
          },
        },
      },
    },
  },
  render(data) {
    const titleHtml = data.title ? `<h2>${escape(data.title)}</h2>` : '';
    const items = data.events
      .map(
        (evt, i) => `<article class="event-item" aria-label="${escapeAttr(evt.title)}">
  <time datetime="${escapeAttr(evt.date)}">${escape(evt.date)}</time>
  <div class="event-details">
    <h3>${escape(evt.title)}</h3>
    <p class="event-meta">${escape(evt.time)} &middot; ${escape(evt.location)}</p>
    <p>${escape(evt.description)}</p>
    ${evt.link ? `<a href="${escapeAttr(evt.link)}" class="event-link">More info</a>` : ''}
  </div>
</article>`
      )
      .join('\n      ');

    return `<section class="component-event-calendar" role="region" aria-label="Events calendar">
  ${titleHtml}
  <div class="events-list">
    ${items}
  </div>
</section>`;
  },
};

// --- notification-banner ---
components['notification-banner'] = {
  type: 'notification-banner',
  schema: {
    type: 'object',
    required: ['message', 'type'],
    properties: {
      message: { type: 'string' },
      type: { type: 'string', enum: ['info', 'warning', 'alert', 'success'] },
      dismissible: { type: 'boolean' },
    },
  },
  render(data) {
    const role = data.type === 'alert' ? 'alert' : 'status';
    const dismissibleClass = data.dismissible ? ' is-dismissible' : '';
    const dismissBtn = data.dismissible
      ? `<button class="banner-dismiss" aria-label="Dismiss notification" data-dismiss>&times;</button>`
      : '';

    return `<div class="component-notification-banner banner-${escapeAttr(data.type)}${dismissibleClass}" role="${role}" aria-label="${escapeAttr(data.type)} notification">
  <span class="banner-message">${escape(data.message)}</span>
  ${dismissBtn}
</div>`;
  },
};

// --- documents-list ---
components['documents-list'] = {
  type: 'documents-list',
  schema: {
    type: 'object',
    required: ['documents'],
    properties: {
      title: { type: 'string' },
      documents: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'file_url', 'file_type'],
          properties: {
            title: { type: 'string' },
            file_url: { type: 'string' },
            file_type: { type: 'string' },
            uploaded_at: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
  },
  render(data) {
    const titleHtml = data.title ? `<h2>${escape(data.title)}</h2>` : '';
    const items = data.documents
      .map(
        (doc, i) => `<li class="document-item">
  <a href="${escapeAttr(doc.file_url)}" class="document-link" download aria-label="${escapeAttr(doc.title)} (${escapeAttr(doc.file_type)})">
    <span class="document-icon" aria-hidden="true">&#128196;</span>
    <span class="document-title">${escape(doc.title)}</span>
    <span class="document-meta">${escape(doc.file_type)}${doc.uploaded_at ? ` &middot; ${escape(doc.uploaded_at)}` : ''}</span>
  </a>
  ${doc.description ? `<p class="document-desc">${escape(doc.description)}</p>` : ''}
</li>`
      )
      .join('\n      ');

    return `<section class="component-documents-list" role="region" aria-label="Documents">
  ${titleHtml}
  <ul class="documents-list" aria-label="Document list">
    ${items}
  </ul>
</section>`;
  },
};

// --- footer ---
components.footer = {
  type: 'footer',
  schema: {
    type: 'object',
    required: ['columns', 'copyright'],
    properties: {
      columns: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'links'],
          properties: {
            title: { type: 'string' },
            links: {
              type: 'array',
              items: {
                type: 'object',
                required: ['label', 'url'],
                properties: {
                  label: { type: 'string' },
                  url: { type: 'string' },
                },
              },
            },
          },
        },
      },
      social_links: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label', 'url'],
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
            icon: { type: 'string' },
          },
        },
      },
      copyright: { type: 'string' },
    },
  },
  render(data) {
    const cols = data.columns
      .map(
        (col) => `<div class="footer-column">
  <h3>${escape(col.title)}</h3>
  <ul>
    ${col.links
      .map(
        (link) =>
          `<li><a href="${escapeAttr(link.url)}">${escape(link.label)}</a></li>`
      )
      .join('\n      ')}
  </ul>
</div>`
      )
      .join('\n    ');

    const social =
      data.social_links && data.social_links.length
        ? `<div class="footer-social" aria-label="Social media links">
    ${data.social_links
      .map(
        (s) =>
          `<a href="${escapeAttr(s.url)}" class="social-link" aria-label="${escapeAttr(s.label)}">${s.icon ? escape(s.icon) : escape(s.label)}</a>`
      )
      .join('\n      ')}
  </div>`
        : '';

    return `<footer class="component-footer" role="contentinfo">
  <div class="footer-columns">
    ${cols}
  </div>
  ${social}
  <div class="footer-bottom">
    <p>&copy; ${escape(data.copyright)}</p>
  </div>
</footer>`;
  },
};

// --- nav-bar ---
components['nav-bar'] = {
  type: 'nav-bar',
  schema: {
    type: 'object',
    required: ['menu_items'],
    properties: {
      logo_text: { type: 'string' },
      logo_url: { type: 'string' },
      menu_items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label', 'url'],
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
      cta_text: { type: 'string' },
      cta_url: { type: 'string' },
    },
  },
  render(data) {
    const logoHtml = data.logo_url
      ? `<a href="${escapeAttr(data.logo_url)}" class="nav-logo" aria-label="Home">${escape(data.logo_text || 'Home')}</a>`
      : data.logo_text
        ? `<span class="nav-logo">${escape(data.logo_text)}</span>`
        : '';

    const menuHtml = data.menu_items
      .map(
        (item) =>
          `<li><a href="${escapeAttr(item.url)}">${escape(item.label)}</a></li>`
      )
      .join('\n        ');

    const ctaHtml =
      data.cta_text && data.cta_url
        ? `<a href="${escapeAttr(data.cta_url)}" class="nav-cta" role="button">${escape(data.cta_text)}</a>`
        : '';

    return `<nav class="component-nav-bar" role="navigation" aria-label="Main navigation">
  ${logoHtml}
  <button class="nav-toggle" aria-label="Toggle navigation menu" aria-expanded="false" data-nav-toggle>
    <span aria-hidden="true">&#9776;</span>
  </button>
  <ul class="nav-menu" role="menubar">
    ${menuHtml}
  </ul>
  ${ctaHtml}
</nav>`;
  },
};

// ─── Registry API ─────────────────────────────────────────────────────────────

/**
 * Look up a component by type name.
 * @param {string} type
 * @returns {{ type, schema, render }}
 */
function getComponent(type) {
  const comp = components[type];
  if (!comp) {
    throw new Error(`Unknown component type: "${type}". Available: ${Object.keys(components).join(', ')}`);
  }
  return comp;
}

/**
 * Render a component by type with the given data.
 * @param {string} type
 * @param {object} data
 * @returns {string} HTML string
 */
function renderComponent(type, data) {
  const comp = getComponent(type);
  return comp.render(data);
}

/**
 * Validate data against a component's schema.
 * @param {string} type
 * @param {object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateComponentData(type, data) {
  const comp = getComponent(type);
  const errors = [];

  // Quick schema validation — pragmatic checks for required fields and types
  const schema = comp.schema;

  if (schema.type === 'object' && typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Data must be an object'] };
  }

  // Check required fields
  if (schema.required) {
    for (const req of schema.required) {
      if (data[req] == null) {
        errors.push(`Missing required field: "${req}"`);
      }
    }
  }

  // Type checks on properties
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const value = data[key];
      if (value == null) continue;

      if (propSchema.type === 'string' && typeof value !== 'string') {
        errors.push(`Field "${key}" must be a string`);
      }
      if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Field "${key}" must be a boolean`);
      }
      if (propSchema.type === 'array' && !Array.isArray(value)) {
        errors.push(`Field "${key}" must be an array`);
      }
      if (propSchema.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        errors.push(`Field "${key}" must be an object`);
      }

      // Enum check
      if (propSchema.enum && !propSchema.enum.includes(value)) {
        errors.push(`Field "${key}" must be one of: ${propSchema.enum.join(', ')}`);
      }

      // Nested array items validation
      if (propSchema.type === 'array' && propSchema.items && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (!item || typeof item !== 'object') {
            errors.push(`Item ${i} in "${key}" must be an object`);
            continue;
          }
          // Check required fields on array items
          if (propSchema.items.required) {
            for (const req of propSchema.items.required) {
              if (item[req] == null) {
                errors.push(`Item ${i} in "${key}" missing required field: "${req}"`);
              }
            }
          }
          // Check nested property types and enums on array items
          if (propSchema.items.properties) {
            for (const [propName, propDef] of Object.entries(propSchema.items.properties)) {
              const propValue = item[propName];
              if (propValue == null) continue;
              if (propDef.type === 'string' && typeof propValue !== 'string') {
                errors.push(`Item ${i} in "${key}" field "${propName}" must be a string`);
              }
              if (propDef.type === 'boolean' && typeof propValue !== 'boolean') {
                errors.push(`Item ${i} in "${key}" field "${propName}" must be a boolean`);
              }
              if (propDef.enum && !propDef.enum.includes(propValue)) {
                errors.push(`Item ${i} in "${key}" field "${propName}" must be one of: ${propDef.enum.join(', ')}`);
              }
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get the list of all registered component types.
 * @returns {string[]}
 */
function listComponents() {
  return Object.keys(components);
}

module.exports = {
  components,
  getComponent,
  renderComponent,
  validateComponentData,
  listComponents,
};

/**
 * UI Engine Test Suite
 *
 * Comprehensive tests using Node's built-in test runner.
 * Tests component rendering, accessibility, schema validation, XSS prevention,
 * layout rendering, and full page rendering from sample data.
 */

'use strict';

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  components,
  getComponent,
  renderComponent,
  validateComponentData,
  listComponents,
} from '../ui-engine/component-registry.js';

import { renderLayout, renderFromFile } from '../ui-engine/layout-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helper: check rendered HTML contains required accessibility attributes ───

function hasAriaAttr(html, attr, value) {
  if (value !== undefined) {
    return html.includes(`${attr}="${value}"`);
  }
  // Check that the attribute appears (any value)
  const regex = new RegExp(`${attr}=["']`);
  return regex.test(html);
}

function hasSemanticTag(html, tag) {
  const regex = new RegExp(`<${tag}[\\s>]`);
  return regex.test(html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Component Registry: getComponent, listComponents
// ═══════════════════════════════════════════════════════════════════════════════

test('component registry – all expected types are registered', () => {
  const expected = [
    'hero',
    'about-section',
    'services-grid',
    'contact-form',
    'business-hours',
    'event-calendar',
    'notification-banner',
    'documents-list',
    'footer',
    'nav-bar',
  ];
  const registered = listComponents();
  for (const type of expected) {
    assert.ok(registered.includes(type), `Expected component "${type}" to be registered`);
  }
  assert.equal(registered.length, expected.length, 'Should have exactly the expected components');
});

test('component registry – getComponent returns component with schema and render', () => {
  const comp = getComponent('hero');
  assert.ok(comp, 'Component should exist');
  assert.equal(typeof comp.schema, 'object', 'Component should have a schema');
  assert.equal(typeof comp.render, 'function', 'Component should have a render function');
});

test('component registry – getComponent throws for unknown type', () => {
  assert.throws(() => getComponent('nonexistent-component'), /Unknown component type/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Individual Component Rendering – Valid HTML, Accessibility, ARIA
// ═══════════════════════════════════════════════════════════════════════════════

test('hero component – renders valid HTML with aria attributes', () => {
  const data = {
    heading: 'Welcome',
    subheading: 'Best place ever',
    cta_text: 'Click Me',
    cta_url: 'https://example.com',
  };
  const html = renderComponent('hero', data);
  assert.ok(html.includes('Welcome'), 'Should include heading');
  assert.ok(html.includes('Best place ever'), 'Should include subheading');
  assert.ok(html.includes('Click Me'), 'Should include CTA text');
  assert.ok(html.includes('https://example.com'), 'Should include CTA URL');
  assert.ok(hasAriaAttr(html, 'role', 'region'), 'Hero should have role="region"');
  assert.ok(hasAriaAttr(html, 'aria-label', 'Hero banner'), 'Hero should have aria-label');
  assert.ok(hasSemanticTag(html, 'section'), 'Hero should be wrapped in a <section>');
  assert.ok(hasSemanticTag(html, 'h1'), 'Hero should have an <h1>');
});

test('hero component – renders without optional fields', () => {
  const html = renderComponent('hero', { heading: 'Minimal' });
  assert.ok(html.includes('Minimal'), 'Should include heading');
  assert.ok(!html.includes('subheading'), 'Should not include subheading');
  assert.ok(!html.includes('hero-cta'), 'Should not include CTA');
});

test('about-section component – renders with image and text', () => {
  const data = {
    title: 'About Us',
    body: 'This is the about text.',
    image: '/images/about.jpg',
  };
  const html = renderComponent('about-section', data);
  assert.ok(html.includes('About Us'), 'Should include title');
  assert.ok(html.includes('This is the about text.'), 'Should include body');
  assert.ok(html.includes('/images/about.jpg'), 'Should include image URL');
  assert.ok(hasSemanticTag(html, 'section'), 'Should be a <section>');
  assert.ok(hasSemanticTag(html, 'img'), 'Should include an <img>');
  assert.ok(hasAriaAttr(html, 'aria-label', 'About Us'), 'Should have aria-label');
});

test('services-grid component – renders service cards', () => {
  const data = {
    title: 'Services',
    services: [
      { title: 'Web Dev', description: 'Build websites', icon: '🌐', price: '$99' },
      { title: 'SEO', description: 'Rank higher', price: '$49' },
    ],
  };
  const html = renderComponent('services-grid', data);
  assert.ok(html.includes('Web Dev'), 'Should include first service title');
  assert.ok(html.includes('SEO'), 'Should include second service title');
  assert.ok(html.includes('$99'), 'Should include price');
  assert.ok(html.includes('service-card'), 'Should include service-card class');
  assert.ok(hasSemanticTag(html, 'article'), 'Each service should be an <article>');
});

test('contact-form component – renders form fields', () => {
  const data = {
    title: 'Contact',
    fields: [
      { type: 'text', label: 'Name', required: true },
      { type: 'email', label: 'Email', required: true },
      { type: 'tel', label: 'Phone', required: false },
      { type: 'textarea', label: 'Message', required: true },
    ],
    submit_text: 'Send',
  };
  const html = renderComponent('contact-form', data);
  assert.ok(html.includes('Name'), 'Should include Name label');
  assert.ok(html.includes('Email'), 'Should include Email label');
  assert.ok(html.includes('Phone'), 'Should include Phone label');
  assert.ok(html.includes('Message'), 'Should include Message label');
  assert.ok(html.includes('<form'), 'Should include a <form> tag');
  assert.ok(html.includes('type="email"'), 'Should have email input type');
  assert.ok(html.includes('<textarea'), 'Should have textarea');
  assert.ok(html.includes('required'), 'Should have required attributes');
  assert.ok(hasAriaAttr(html, 'aria-required', 'true'), 'Required fields should have aria-required');
});

test('business-hours component – renders table with days', () => {
  const data = {
    title: 'Hours',
    hours: [
      { day: 'Monday', open: '9 AM', close: '5 PM', is_closed: false },
      { day: 'Sunday', is_closed: true },
    ],
  };
  const html = renderComponent('business-hours', data);
  assert.ok(html.includes('Monday'), 'Should include Monday');
  assert.ok(html.includes('9 AM'), 'Should include opening time');
  assert.ok(html.includes('5 PM'), 'Should include closing time');
  assert.ok(html.includes('Closed'), 'Should show Closed for Sunday');
  assert.ok(hasSemanticTag(html, 'table'), 'Should use a <table>');
  assert.ok(hasSemanticTag(html, 'thead'), 'Should have <thead>');
  assert.ok(hasSemanticTag(html, 'th'), 'Should have <th> elements');
});

test('event-calendar component – renders events', () => {
  const data = {
    title: 'Events',
    events: [
      {
        date: '2026-07-10',
        title: 'Conference',
        description: 'Annual conference',
        time: '9 AM – 5 PM',
        location: 'Hall A',
        link: '/register',
      },
      {
        date: '2026-08-01',
        title: 'Workshop',
        description: 'Hands-on workshop',
        time: '2 PM',
        location: 'Room 3',
      },
    ],
  };
  const html = renderComponent('event-calendar', data);
  assert.ok(html.includes('Conference'), 'Should include event title');
  assert.ok(html.includes('Annual conference'), 'Should include description');
  assert.ok(html.includes('Hall A'), 'Should include location');
  assert.ok(html.includes('/register'), 'Should include event link');
  assert.ok(hasSemanticTag(html, 'time'), 'Events should use <time> element');
  assert.ok(hasAriaAttr(html, 'datetime', '2026-07-10'), 'Should have datetime attribute');
});

test('notification-banner component – renders with correct role and class', () => {
  const data = { message: 'System update', type: 'warning', dismissible: true };
  const html = renderComponent('notification-banner', data);
  assert.ok(html.includes('System update'), 'Should include message');
  assert.ok(html.includes('banner-warning'), 'Should have warning class');
  assert.ok(html.includes('is-dismissible'), 'Should have dismissible class');
  assert.ok(html.includes('data-dismiss'), 'Should have dismiss button attribute');
  assert.ok(hasAriaAttr(html, 'role', 'status'), 'Warning should have role="status"');
});

test('notification-banner – alert type uses role="alert"', () => {
  const html = renderComponent('notification-banner', { message: 'Alert!', type: 'alert' });
  assert.ok(hasAriaAttr(html, 'role', 'alert'), 'Alert type should have role="alert"');
});

test('documents-list component – renders document items', () => {
  const data = {
    title: 'Documents',
    documents: [
      { title: 'Report', file_url: '/files/report.pdf', file_type: 'PDF', uploaded_at: 'June 2026', description: 'Annual report' },
      { title: 'Form', file_url: '/files/form.pdf', file_type: 'PDF' },
    ],
  };
  const html = renderComponent('documents-list', data);
  assert.ok(html.includes('Report'), 'Should include document title');
  assert.ok(html.includes('/files/report.pdf'), 'Should include file URL');
  assert.ok(html.includes('document-link'), 'Should have document link class');
  assert.ok(html.includes('download'), 'Should have download attribute');
  assert.ok(hasSemanticTag(html, 'ul'), 'Should use <ul> for list');
});

test('footer component – renders columns, social links, copyright', () => {
  const data = {
    columns: [
      {
        title: 'Links',
        links: [{ label: 'Home', url: '/' }],
      },
    ],
    social_links: [{ label: 'Twitter', url: 'https://twitter.com/cafe', icon: 'TW' }],
    copyright: '2026 Café Riverside',
  };
  const html = renderComponent('footer', data);
  assert.ok(html.includes('Links'), 'Should include column title');
  assert.ok(html.includes('Home'), 'Should include link label');
  assert.ok(html.includes('Twitter'), 'Should include social link');
  assert.ok(html.includes('Café Riverside'), 'Should include copyright');
  assert.ok(hasSemanticTag(html, 'footer'), 'Should use <footer>');
  assert.ok(hasAriaAttr(html, 'role', 'contentinfo'), 'Footer should have role="contentinfo"');
});

test('nav-bar component – renders navigation', () => {
  const data = {
    logo_text: 'MySite',
    logo_url: '/',
    menu_items: [
      { label: 'Home', url: '/' },
      { label: 'About', url: '/about' },
    ],
    cta_text: 'Sign Up',
    cta_url: '/signup',
  };
  const html = renderComponent('nav-bar', data);
  assert.ok(html.includes('MySite'), 'Should include logo text');
  assert.ok(html.includes('Home'), 'Should include menu item');
  assert.ok(html.includes('/about'), 'Should include URL');
  assert.ok(html.includes('Sign Up'), 'Should include CTA');
  assert.ok(hasSemanticTag(html, 'nav'), 'Should use <nav>');
  assert.ok(hasAriaAttr(html, 'role', 'navigation'), 'Should have role="navigation"');
  assert.ok(hasAriaAttr(html, 'aria-label', 'Main navigation'), 'Should have aria-label');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Schema Validation
// ═══════════════════════════════════════════════════════════════════════════════

test('schema validation – accepts valid hero data', () => {
  const result = validateComponentData('hero', { heading: 'Hello', subheading: 'World' });
  assert.ok(result.valid, 'Should be valid');
  assert.equal(result.errors.length, 0);
});

test('schema validation – rejects missing required fields for hero', () => {
  const result = validateComponentData('hero', {});
  assert.ok(!result.valid, 'Should be invalid');
  assert.ok(result.errors.some((e) => e.includes('heading')), 'Should mention missing heading');
});

test('schema validation – accepts valid contact-form data', () => {
  const data = {
    fields: [
      { type: 'email', label: 'Email', required: true },
      { type: 'textarea', label: 'Message', required: true },
    ],
  };
  const result = validateComponentData('contact-form', data);
  assert.ok(result.valid, 'Should be valid');
});

test('schema validation – rejects invalid field type enum', () => {
  const data = {
    fields: [
      { type: 'color-picker', label: 'Color', required: false },
    ],
  };
  const result = validateComponentData('contact-form', data);
  assert.ok(!result.valid, 'Should be invalid');
  assert.ok(result.errors.some((e) => e.includes('type')), 'Should mention type error');
});

test('schema validation – rejects invalid notification type enum', () => {
  const data = { message: 'Test', type: 'critical' };
  const result = validateComponentData('notification-banner', data);
  assert.ok(!result.valid, 'Should reject invalid type');
  assert.ok(result.errors.some((e) => e.includes('type')), 'Should mention type error');
});

test('schema validation – accepts valid notification types', () => {
  for (const t of ['info', 'warning', 'alert', 'success']) {
    const result = validateComponentData('notification-banner', { message: 'Hi', type: t });
    assert.ok(result.valid, `Type "${t}" should be valid`);
  }
});

test('schema validation – rejects non-object data', () => {
  const result = validateComponentData('hero', 'not-an-object');
  assert.ok(!result.valid, 'Should reject string data');
});

test('schema validation – rejects null data', () => {
  const result = validateComponentData('hero', null);
  assert.ok(!result.valid, 'Should reject null data');
});

test('schema validation – rejects services missing required fields', () => {
  const data = { services: [{ title: 'Only Title' }] };
  const result = validateComponentData('services-grid', data);
  assert.ok(!result.valid, 'Should be invalid');
  assert.ok(result.errors.some((e) => e.includes('description')), 'Should mention missing description');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. XSS Prevention – HTML Injection Escaping
// ═══════════════════════════════════════════════════════════════════════════════

test('XSS prevention – hero component escapes HTML injection in heading', () => {
  const data = { heading: '<script>alert("xss")</script>' };
  const html = renderComponent('hero', data);
  assert.ok(!html.includes('<script>'), 'Script tag should be escaped');
  assert.ok(html.includes('&lt;script&gt;'), 'Should have escaped script tag');
});

test('XSS prevention – all text fields in all components are escaped', () => {
  const testPayload = '"><script>alert(1)</script>';
  const data = {
    heading: testPayload,
    subheading: testPayload,
    cta_text: testPayload,
    cta_url: testPayload,
  };
  const html = renderComponent('hero', data);
  assert.ok(!html.includes('<script>'), 'Script should not appear in output');
  assert.ok(!html.includes(testPayload), 'Raw injection payload should not appear verbatim');
  assert.ok(html.includes('&gt;&lt;script&gt;'), 'Angle brackets should be escaped');
});

test('XSS prevention – contact form label field escapes HTML', () => {
  const data = {
    fields: [
      { type: 'text', label: '<img onerror="alert(1)" src=x>', required: false },
    ],
  };
  const html = renderComponent('contact-form', data);
  assert.ok(!html.includes('<img'), 'IMG tag should be escaped');
});

test('XSS prevention – footer copyright escapes HTML', () => {
  const data = {
    columns: [{ title: 'C1', links: [{ label: 'L1', url: '/' }] }],
    copyright: '&copy; 2026 <script>evil()</script>',
  };
  const html = renderComponent('footer', data);
  assert.ok(!html.includes('<script>'), 'Script tag in copyright should be escaped');
});

test('XSS prevention – nav-bar menu items escape HTML', () => {
  const data = {
    logo_text: 'Site',
    menu_items: [{ label: '<b>Bold</b>', url: '/xss' }],
  };
  const html = renderComponent('nav-bar', data);
  assert.ok(!html.includes('<b>'), 'HTML in menu label should be escaped');
  assert.ok(html.includes('&lt;b&gt;'), 'Should show escaped HTML');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Layout Renderer
// ═══════════════════════════════════════════════════════════════════════════════

test('layout renderer – produces a complete HTML5 document', () => {
  const layout = [
    { slot_key: 'hero', component_type: 'hero', data: { heading: 'Test Page' } },
  ];
  const result = renderLayout({ layout, pageConfig: { title: 'Test', description: 'A test page' } });
  const html = result.html;

  assert.ok(html.startsWith('<!DOCTYPE html>'), 'Should start with DOCTYPE');
  assert.ok(html.includes('<html lang="en">'), 'Should have html tag with lang');
  assert.ok(html.includes('<head>'), 'Should have head');
  assert.ok(html.includes('<meta charset="UTF-8"'), 'Should have charset meta');
  assert.ok(html.includes('name="viewport"'), 'Should have viewport meta');
  assert.ok(html.includes('<title>Test</title>'), 'Should have title');
  assert.ok(html.includes('A test page'), 'Should have description meta');
  assert.ok(html.includes('<body>'), 'Should have body');
  assert.ok(html.includes('</html>'), 'Should close html tag');
});

test('layout renderer – renders multiple components in order', () => {
  const layout = [
    { slot_key: 'nav', component_type: 'nav-bar', data: { logo_text: 'Site', menu_items: [{ label: 'Home', url: '/' }] } },
    { slot_key: 'hero', component_type: 'hero', data: { heading: 'Hello' } },
    { slot_key: 'footer', component_type: 'footer', data: { columns: [{ title: 'C', links: [{ label: 'L', url: '#' }] }], copyright: '2026' } },
  ];
  const result = renderLayout({ layout });
  const html = result.html;

  // Use slot comments to determine order (avoid CSS class name matches)
  const navIdx = html.indexOf('<!-- slot: nav -->');
  const heroIdx = html.indexOf('<!-- slot: hero -->');
  const footerIdx = html.indexOf('<!-- slot: footer -->');
  assert.ok(navIdx >= 0, 'Nav slot comment should exist');
  assert.ok(heroIdx >= 0, 'Hero slot comment should exist');
  assert.ok(footerIdx >= 0, 'Footer slot comment should exist');
  assert.ok(navIdx < heroIdx, 'Nav should come before hero');
  assert.ok(heroIdx < footerIdx, 'Hero should come before footer');
});

test('layout renderer – renders fallback for invalid component data', () => {
  const layout = [
    { slot_key: 'hero', component_type: 'hero', data: {} },  // Missing required 'heading'
  ];
  const result = renderLayout({ layout });
  const html = result.html;

  assert.ok(html.includes('component-error'), 'Should render error component');
  assert.ok(html.includes('Component Error'), 'Should show error message');
  assert.ok(result.warnings.length > 0, 'Should have warnings');
  assert.ok(result.warnings[0].includes('Missing required'), 'Warning should mention missing field');
});

test('layout renderer – renders fallback for unknown component type', () => {
  const layout = [
    { slot_key: 'bad', component_type: 'non-existent-component', data: {} },
  ];
  const result = renderLayout({ layout });
  const html = result.html;

  assert.ok(html.includes('component-error'), 'Should render error component');
});

test('layout renderer – uses custom lang attribute', () => {
  const layout = [
    { slot_key: 'hero', component_type: 'hero', data: { heading: 'Bonjour' } },
  ];
  const result = renderLayout({ layout, pageConfig: { lang: 'fr' } });
  assert.ok(result.html.includes('<html lang="fr">'), 'Should use custom lang');
});

test('layout renderer – includes skip-to-main-content link', () => {
  const layout = [
    { slot_key: 'hero', component_type: 'hero', data: { heading: 'Hi' } },
  ];
  const result = renderLayout({ layout });
  assert.ok(result.html.includes('Skip to main content'), 'Should include skip link');
  assert.ok(result.html.includes('id="main-content"'), 'Should have main-content id');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Schema Files – Load and validate
// ═══════════════════════════════════════════════════════════════════════════════

test('school schema file – loads and is valid JSON', () => {
  const schemaPath = path.resolve(__dirname, '../ui-engine/schemas/school-schema.json');
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(raw);
  assert.ok(schema, 'Schema should parse');
  assert.equal(schema.title, 'School Template Schema');
  assert.ok(schema.properties.layout, 'Should have layout property');
  assert.ok(schema.required.includes('layout'), 'Should require layout');
});

test('business schema file – loads and is valid JSON', () => {
  const schemaPath = path.resolve(__dirname, '../ui-engine/schemas/business-schema.json');
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(raw);
  assert.ok(schema, 'Schema should parse');
  assert.equal(schema.title, 'Small Business Template Schema');
  assert.ok(schema.properties.layout, 'Should have layout property');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Sample Data – Load and render full pages
// ═══════════════════════════════════════════════════════════════════════════════

test('sample data – school-greenwood.json loads and renders', () => {
  const dataPath = path.resolve(__dirname, '../ui-engine/sample-data/school-greenwood.json');
  const result = renderFromFile(dataPath, { title: 'Greenwood Academy', description: 'School website', lang: 'en' });

  const html = result.html;
  assert.ok(html.includes('Greenwood Academy'), 'Should include school name');
  assert.ok(html.includes('Welcome to Greenwood Academy'), 'Should include hero heading');
  assert.ok(html.includes('Empowering students'), 'Should include subheading');
  assert.ok(html.includes('About Greenwood Academy'), 'Should include about section title');
  assert.ok(html.includes('Upcoming Events'), 'Should include events section');
  assert.ok(html.includes('School Documents'), 'Should include documents section');
  assert.ok(html.includes('Apply Now'), 'Should include CTA');
  assert.ok(html.includes('Summer school registration'), 'Should include notification');
  assert.ok(html.includes('2026 Greenwood Academy'), 'Should include copyright');
  assert.ok(html.startsWith('<!DOCTYPE html>'), 'Should be valid HTML5');
  assert.equal(result.warnings.length, 0, 'Should have no rendering warnings');
});

test('sample data – cafe-riverside.json loads and renders', () => {
  const dataPath = path.resolve(__dirname, '../ui-engine/sample-data/cafe-riverside.json');
  const result = renderFromFile(dataPath, { title: 'Café Riverside', description: 'Coffee shop website', lang: 'en' });

  const html = result.html;
  assert.ok(html.includes('Café Riverside'), 'Should include cafe name');
  assert.ok(html.includes('Fresh, locally-sourced'), 'Should include hero subheading');
  assert.ok(html.includes('Our Story'), 'Should include about section');
  assert.ok(html.includes('Artisan Coffee'), 'Should include service title');
  assert.ok(html.includes('Hours of Operation'), 'Should include hours section');
  assert.ok(html.includes('Monday'), 'Should include day in hours');
  assert.ok(html.includes('Get in Touch'), 'Should include contact section');
  assert.ok(html.includes('Order Online'), 'Should include CTA');
  assert.ok(html.includes('Café Riverside LLC'), 'Should include copyright');
  assert.equal(result.warnings.length, 0, 'Should have no rendering warnings');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

test('layout renderer – handles empty layout gracefully', () => {
  const result = renderLayout({ layout: [] });
  assert.ok(result.html.includes('<!DOCTYPE html>'), 'Should still produce valid HTML');
  assert.deepEqual(result.warnings, [], 'Should have no warnings');
});

test('layout renderer – handles null/undefined data gracefully', () => {
  // When data is omitted, it defaults to empty object.
  // Hero requires 'heading', so it renders a fallback error component.
  const result = renderLayout({ layout: [{ slot_key: 'x', component_type: 'hero' }] });
  assert.ok(result.html.includes('component-error'), 'Should render fallback when required fields missing');
  assert.ok(result.warnings.length > 0, 'Should have warnings about missing data');
});

test('renderComponent – null/undefined values are handled safely', () => {
  // Should not throw when optional fields are null
  const html = renderComponent('hero', { heading: null });
  assert.ok(typeof html === 'string', 'Should return a string even with null heading');
});

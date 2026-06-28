import { initDb, getDb, closeDb } from './db.js';
import { v4 as uuid } from 'uuid';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seed() {
  await initDb();
  const db = getDb();

  // Clear existing
  db.exec('DELETE FROM domain_tasks');
  db.exec('DELETE FROM content_blocks');
  db.exec('DELETE FROM tenants');

  const tenantA_id = uuid();
  const tenantB_id = uuid();
  const tenantC_id = uuid();

  // Insert tenants
  db.run(
    `INSERT INTO tenants (id, name, slug, status, custom_domain, fallback_subdomain, config_payload, activation_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tenantA_id, 'Greenwood International School', 'greenwood-school', 'active',
    'greenwood.ac.ke', 'greenwood-school.waas.app',
    JSON.stringify({ theme: { primary: '#1a73e8', font: 'Inter' }, locale: 'en-KE', timezone: 'Africa/Nairobi' }),
    uuid()
  );

  db.run(
    `INSERT INTO tenants (id, name, slug, status, custom_domain, fallback_subdomain, config_payload, activation_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tenantB_id, 'Riverside Cafe & Bistro', 'riverside-cafe', 'active',
    'riverside.cafe', 'riverside-cafe.waas.app',
    JSON.stringify({ theme: { primary: '#2d6a4f', font: 'Inter' }, locale: 'en-KE', timezone: 'Africa/Nairobi' }),
    uuid()
  );

  db.run(
    `INSERT INTO tenants (id, name, slug, status, fallback_subdomain, config_payload, activation_token)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    tenantC_id, 'Sunrise Daycare Center', 'sunrise-daycare', 'suspended',
    'sunrise-daycare.waas.app',
    JSON.stringify({ theme: { primary: '#f59e0b', font: 'Inter' }, locale: 'en-KE' }),
    uuid()
  );

  // Insert content blocks
  const contentData = [
    // Tenant A — Greenwood School (7 blocks)
    [tenantA_id, 'hero', { heading: 'Greenwood International School', subheading: "Nurturing Tomorrow's Leaders Since 1995", cta: { text: 'Enroll Now', url: '/admissions' }, backgroundImage: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1200' }],
    [tenantA_id, 'nav-bar', { logo: { text: 'Greenwood', url: '/' }, menuItems: [{ label: 'About', url: '/about' }, { label: 'Academics', url: '/academics' }, { label: 'Admissions', url: '/admissions' }, { label: 'Events', url: '/events' }, { label: 'Contact', url: '/contact' }], cta: { text: 'Apply Now', url: '/admissions/apply' } }],
    [tenantA_id, 'notification-banner', { message: '📢 Enrollment for 2026 is open! Early bird: July 15th.', type: 'info', dismissible: true }],
    [tenantA_id, 'about-section', { title: 'About Greenwood', body: 'Greenwood International School is a premier educational institution committed to academic excellence, character development, and holistic growth.', image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800' }],
    [tenantA_id, 'event-calendar', { title: 'Upcoming Events', events: [{ date: '2026-07-15', title: 'Early Bird Deadline', description: 'Last day for discounted fees', time: '23:59', location: 'Online' }, { date: '2026-08-01', title: 'First Day of Term 3', description: 'School reopens', time: '07:30', location: 'Greenwood Campus' }, { date: '2026-08-20', title: 'Sports Day', description: 'Annual competition', time: '08:00', location: 'School Grounds' }] }],
    [tenantA_id, 'documents-list', { title: 'School Documents', documents: [{ title: '2026 Academic Calendar', file_url: '/docs/calendar-2026.pdf', file_type: 'pdf', uploaded_at: '2026-01-10' }, { title: 'Admission Form', file_url: '/docs/admission-form.pdf', file_type: 'pdf', uploaded_at: '2026-01-15' }] }],
    [tenantA_id, 'footer', { columns: [{ heading: 'School', links: [{ label: 'About Us', url: '/about' }] }, { heading: 'Contact', links: [{ label: 'info@greenwood.ac.ke', url: 'mailto:info@greenwood.ac.ke' }] }], socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/greenwoodschool', label: 'Facebook' }], copyright: '© 2026 Greenwood International School' }],
    // Tenant B — Riverside Cafe (7 blocks)
    [tenantB_id, 'hero', { heading: 'Riverside Cafe & Bistro', subheading: 'Fresh, Local, Delicious', cta: { text: 'View Menu', url: '/menu' }, backgroundImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224e24?w=1200' }],
    [tenantB_id, 'nav-bar', { logo: { text: 'Riverside', url: '/' }, menuItems: [{ label: 'Menu', url: '/menu' }, { label: 'About', url: '/about' }, { label: 'Reservations', url: '/reservations' }, { label: 'Contact', url: '/contact' }], cta: { text: 'Book a Table', url: '/reservations' } }],
    [tenantB_id, 'about-section', { title: 'Our Story', body: 'Nestled along the Nairobi River, Riverside Cafe & Bistro brings together the finest locally-sourced ingredients with globally-inspired cuisine.', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800' }],
    [tenantB_id, 'services-grid', { title: 'Our Offerings', items: [{ title: 'Breakfast & Brunch', description: 'Artisanal pastries and fresh coffee', icon: '☕' }, { title: 'Lunch & Dinner', description: 'Seasonal menus', icon: '🍽️' }, { title: 'Private Events', description: 'Riverside dining for up to 40', icon: '🎉' }, { title: 'Catering', description: 'Full-service catering', icon: '🥂' }] }],
    [tenantB_id, 'business-hours', { hours: [{ day: 'Monday', open: '07:00', close: '22:00', is_closed: false }, { day: 'Tuesday', open: '07:00', close: '22:00', is_closed: false }, { day: 'Wednesday', open: '07:00', close: '22:00', is_closed: false }, { day: 'Thursday', open: '07:00', close: '22:00', is_closed: false }, { day: 'Friday', open: '07:00', close: '23:00', is_closed: false }, { day: 'Saturday', open: '08:00', close: '23:00', is_closed: false }, { day: 'Sunday', open: '09:00', close: '21:00', is_closed: false }], note: 'Happy Hour: Mon-Fri 4-6 PM' }],
    [tenantB_id, 'contact-form', { title: 'Get In Touch', fields: [{ type: 'text', label: 'Your Name', name: 'name', required: true, placeholder: 'John Doe' }, { type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'john@example.com' }, { type: 'textarea', label: 'Message', name: 'message', required: true, placeholder: 'Your message...' }], submitText: 'Send Message' }],
    [tenantB_id, 'footer', { columns: [{ heading: 'Location', links: [{ label: 'Riverside Drive, Nairobi', url: '#' }] }, { heading: 'Contact', links: [{ label: 'info@riverside.cafe', url: 'mailto:info@riverside.cafe' }] }], socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/riversidecafe', label: 'Instagram' }], copyright: '© 2026 Riverside Cafe & Bistro' }],
  ];

  for (const [tid, sk, payload] of contentData) {
    db.run(
      'INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published) VALUES (?, ?, ?, ?, ?, ?)',
      uuid(), tid, sk, JSON.stringify(payload), 1, 1
    );
  }

  console.log('✅ Database seeded:');
  console.log(`   - Greenwood International School (active)     — ${tenantA_id}`);
  console.log(`   - Riverside Cafe & Bistro (active)            — ${tenantB_id}`);
  console.log(`   - Sunrise Daycare Center (suspended)          — ${tenantC_id}`);
  console.log(`   - ${contentData.length} content blocks`);

  // Save to disk
  const data = db.export();
  writeFileSync(join(__dirname, 'data', 'waas.db'), Buffer.from(data));
  console.log('✅ Saved to', join(__dirname, 'data', 'waas.db'));
  process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });

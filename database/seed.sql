-- =============================================================================
-- Seed Data: Multi-tenant WaaS CMS
-- Two tenants with realistic content blocks
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tenant A: Greenwood International School
-- ---------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, status, custom_domain, fallback_subdomain, config_payload, activation_token)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Greenwood International School',
    'greenwood-school',
    'active',
    'www.greenwoodschool.edu',
    'greenwood-school.waascms.io',
    '{
        "brand": {
            "primary_color": "#1a5276",
            "secondary_color": "#f39c12",
            "logo_url": "https://assets.waascms.io/greenwood/logo.svg"
        },
        "features": {
            "enable_blog": true,
            "enable_events": true,
            "max_student_profiles": 500
        },
        "locale": "en-US",
        "timezone": "America/New_York"
    }'::jsonb,
    'd290f1ee-6c54-4b01-90e6-d701748f0851'
);

-- Greenwood School — Hero Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b1a0c1d2-0001-4000-a000-000000000001',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'hero',
    '{
        "headline": "Shaping Tomorrow''s Leaders Today",
        "subheadline": "Greenwood International School — where academic excellence meets holistic development.",
        "cta_primary": {
            "text": "Apply Now",
            "url": "/admissions/apply",
            "style": "primary"
        },
        "cta_secondary": {
            "text": "Take a Tour",
            "url": "/visit",
            "style": "outline"
        },
        "background_image": "https://images.waascms.io/greenwood/hero-bg.jpg",
        "overlay_opacity": 0.65
    }'::jsonb,
    3,
    true
);

-- Greenwood School — About Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b1a0c1d2-0001-4000-a000-000000000002',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'about',
    '{
        "heading": "Our Mission",
        "body": "Founded in 1998, Greenwood International School has been committed to providing a world-class education that nurtures intellectual curiosity, creativity, and character. Our diverse community of 450 students represents over 30 nationalities.",
        "highlights": [
            {"label": "Students", "value": "450+"},
            {"label": "Faculty", "value": "65"},
            {"label": "Years", "value": "26"},
            {"label": "Nationalities", "value": "30+"}
        ],
        "image_url": "https://images.waascms.io/greenwood/about-campus.jpg",
        "values": ["Excellence", "Inclusivity", "Innovation", "Integrity"]
    }'::jsonb,
    2,
    true
);

-- Greenwood School — Services Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b1a0c1d2-0001-4000-a000-000000000003',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'services',
    '{
        "heading": "Programs & Offerings",
        "services_list": [
            {
                "title": "Early Years (PK-K)",
                "description": "Play-based learning in a nurturing environment.",
                "icon": "school",
                "features": ["Montessori-inspired", "Low student-teacher ratio", "Bilingual exposure"]
            },
            {
                "title": "Primary (G1-G5)",
                "description": "Strong foundational academics with enrichment programs.",
                "icon": "menu_book",
                "features": ["IB Primary Years Programme", "STEM lab", "Arts integration"]
            },
            {
                "title": "Secondary (G6-G12)",
                "description": "College-preparatory curriculum with advanced placement options.",
                "icon": "auto_stories",
                "features": ["IB Diploma Programme", "SAT/ACT prep", "University counseling"]
            },
            {
                "title": "After-School Activities",
                "description": "Sports, music, debate, coding, and more.",
                "icon": "sports_soccer",
                "features": ["20+ clubs", "Inter-school tournaments", "Community service"]
            }
        ],
        "show_pricing": false
    }'::jsonb,
    1,
    true
);

-- ---------------------------------------------------------------------------
-- Tenant B: Riverside Cafe & Bistro
-- ---------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, status, custom_domain, fallback_subdomain, config_payload, activation_token)
VALUES (
    'b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'Riverside Cafe & Bistro',
    'riverside-cafe',
    'active',
    NULL,
    'riverside-cafe.waascms.io',
    '{
        "brand": {
            "primary_color": "#2d5016",
            "secondary_color": "#d4ac0d",
            "logo_url": "https://assets.waascms.io/riverside/logo.svg"
        },
        "features": {
            "enable_online_ordering": true,
            "enable_reservations": true,
            "enable_gift_cards": false
        },
        "locale": "en-US",
        "timezone": "America/Chicago"
    }'::jsonb,
    'e290f1ee-6c54-4b01-90e6-d701748f0852'
);

-- Riverside Cafe — Hero Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b2a0c1d2-0002-4000-b000-000000000001',
    'b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'hero',
    '{
        "headline": "Good Food, Good Vibes",
        "subheadline": "Fresh, locally-sourced cuisine served with a view of the river.",
        "cta_primary": {
            "text": "View Menu",
            "url": "/menu",
            "style": "primary"
        },
        "cta_secondary": {
            "text": "Make a Reservation",
            "url": "/reservations",
            "style": "outline"
        },
        "background_image": "https://images.waascms.io/riverside/cafe-interior.jpg",
        "overlay_opacity": 0.55
    }'::jsonb,
    4,
    true
);

-- Riverside Cafe — About Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b2a0c1d2-0002-4000-b000-000000000002',
    'b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'about',
    '{
        "heading": "Our Story",
        "body": "Riverside Cafe & Bistro opened its doors in 2015 with a simple mission: serve delicious, honest food made from the freshest local ingredients. Nestled along the riverwalk, we''ve become a beloved gathering place for breakfast, lunch, and weekend brunch.",
        "highlights": [
            {"label": "Years in Business", "value": "9"},
            {"label": "Daily Customers", "value": "200+"},
            {"label": "Local Partners", "value": "15"},
            {"label": "Menu Items", "value": "60+"}
        ],
        "image_url": "https://images.waascms.io/riverside/kitchen-team.jpg",
        "values": ["Fresh", "Local", "Sustainable", "Welcoming"]
    }'::jsonb,
    2,
    true
);

-- Riverside Cafe — Menu / Services Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b2a0c1d2-0002-4000-b000-000000000003',
    'b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'services',
    '{
        "heading": "Our Menu",
        "categories": [
            {
                "name": "Breakfast",
                "items": [
                    {"name": "Riverside Benny", "price": 14.95, "description": "Poached eggs, smoked salmon, avocado on sourdough"},
                    {"name": "Farmhouse Omelette", "price": 12.50, "description": "Three-egg omelette with seasonal vegetables and cheddar"}
                ]
            },
            {
                "name": "Lunch",
                "items": [
                    {"name": "Riverwalk Salad", "price": 13.00, "description": "Mixed greens, grilled chicken, cranberries, pecans, goat cheese"},
                    {"name": "Bistro Burger", "price": 15.50, "description": "Angus beef, aged cheddar, caramelized onions, house chips"}
                ]
            },
            {
                "name": "Beverages",
                "items": [
                    {"name": "Artisan Coffee", "price": 4.50, "description": "Single-origin, pour-over or espresso"},
                    {"name": "Fresh Pressed Juice", "price": 6.00, "description": "Seasonal fruit and vegetable blends"}
                ]
            }
        ],
        "show_pricing": true,
        "note": "All items prepared in a kitchen that handles nuts, dairy, and gluten."
    }'::jsonb,
    3,
    true
);

-- Riverside Cafe — Contact Section
INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published)
VALUES (
    'b2a0c1d2-0002-4000-b000-000000000004',
    'b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'contact',
    '{
        "heading": "Get in Touch",
        "address": {
            "street": "42 Riverwalk Drive",
            "city": "Austin",
            "state": "TX",
            "zip": "78701"
        },
        "phone": "+1 (512) 555-0142",
        "email": "hello@riversidecafe.com",
        "hours": {
            "monday_friday": "7:00 AM - 9:00 PM",
            "saturday": "8:00 AM - 10:00 PM",
            "sunday": "8:00 AM - 3:00 PM"
        },
        "social_links": {
            "instagram": "https://instagram.com/riversidecafeatx",
            "facebook": "https://facebook.com/riversidecafeatx"
        },
        "map_embed_url": "https://maps.google.com/?q=42+Riverwalk+Drive+Austin+TX"
    }'::jsonb,
    1,
    true
);

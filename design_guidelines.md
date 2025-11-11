# Design Guidelines: Veeam Service Provider Console Dashboard

## Design Approach

**Selected System:** Material Design (adapted for enterprise data visualization)

**Rationale:** Enterprise backup monitoring application requiring information density, data clarity, and professional credibility. Material Design provides excellent patterns for dashboards, data tables, and charts while maintaining visual hierarchy in complex interfaces.

**Core Principles:**
- Data-first hierarchy: Information legibility over decoration
- Efficient space utilization for dense data displays
- Professional enterprise aesthetic aligned with Veeam branding
- Consistent patterns for predictable user experience

---

## Typography

**Font Family:**
- Primary: 'Inter' (Google Fonts) - exceptional readability for data-heavy interfaces
- Monospace: 'Roboto Mono' for metrics, timestamps, IDs

**Hierarchy:**
- Page Titles: text-2xl font-semibold
- Section Headers: text-lg font-medium
- Card Titles: text-base font-medium
- Body/Data: text-sm font-normal
- Labels/Meta: text-xs font-medium uppercase tracking-wide
- Metrics (large numbers): text-4xl font-bold

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8**
- Component padding: p-4 to p-6
- Card spacing: gap-4 to gap-6
- Section margins: mb-6 to mb-8
- Page padding: p-6 to p-8

**Grid Structure:**
- Dashboard uses 12-column grid system
- Main content area: Single column with nested grids
- Statistics cards: 3-4 columns on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Data tables: Full-width within container
- Charts: 2-column layout where appropriate (grid-cols-1 lg:grid-cols-2)

**Container:**
- Max-width: max-w-7xl mx-auto
- Responsive padding: px-4 sm:px-6 lg:px-8

---

## Component Library

### Navigation & Layout
- **Top Navigation Bar:** Fixed header with logo, client selector dropdown (right-aligned), user profile
- **Sidebar:** None - single-page dashboard layout with anchor navigation if needed
- **Client Selector:** Dropdown button in top-right, searchable select with company list

### Dashboard Components
- **Stat Cards:** Bordered cards with icon, large metric number, label, and trend indicator
- **Health Status Badge:** Pill-shaped badges with status colors (success/warning/error states)
- **Repository Usage Card:** Progress bars showing capacity with percentage labels
- **Success Rate Chart:** Line chart showing monthly backup success percentages
- **Failures Table:** Striped table with columns: Date, Client, Job Name, Error Message, sortable headers

### Forms & Inputs
- **Email Scheduling Modal:** Card-based form with input fields, radio buttons for frequency, time/day selectors
- **Inputs:** Outlined style with floating labels, clear focus states
- **Buttons:** Primary (filled), Secondary (outlined), Ghost (text-only)
- **Dropdowns:** Material-style select with chevron indicator

### Data Visualization
- Use Chart.js or Recharts library
- Clean grid lines, subtle backgrounds
- Color coding: Success (green), Warning (amber), Error (red), Info (blue)

---

## Visual Specifications

### Cards & Containers
- Background: White cards on subtle gray background (bg-gray-50)
- Border: 1px solid with rounded corners (rounded-lg border border-gray-200)
- Shadow: Subtle elevation (shadow-sm)
- Padding: p-6 for cards

### Tables
- Header: bg-gray-50 with border-b border-gray-200
- Rows: hover:bg-gray-50 for interaction feedback
- Striped: Alternate row backgrounds (odd:bg-white even:bg-gray-50)
- Cell padding: px-4 py-3

### Icons
- Library: Heroicons (outline for most, solid for emphasis)
- Size: w-5 h-5 for inline icons, w-8 h-8 for card headers
- Placement: Left-aligned with labels, centered in stat cards

---

## Page Structure

### Login Page
- Centered card on full-height background
- Logo at top
- Email input with autofocus
- Password input
- Primary "Sign In" button
- Clean, minimal layout (no distractions)

### Dashboard Page
**Header Section:**
- Logo (left), Client Selector dropdown + User menu (right)
- Breadcrumb if needed
- Border-bottom separator

**Content Sections (vertical stack with gap-6):**

1. **Overview Cards Row:** 4 stat cards showing key metrics (Total Backups, Success Rate, Active Jobs, Storage Used)

2. **Health Status Section:** Large card with overall health indicator, sub-metrics in grid

3. **Repository Data:** Card with multiple progress bars showing storage usage per repository

4. **Success Rate Chart:** Full-width card with line/area chart spanning last 6-12 months

5. **Recent Failures Table:** Card with searchable, sortable table of last 7 days' failures

**Floating Action:**
- "Schedule Report" button (fixed bottom-right or in header)
- Opens modal for email scheduling

### Email Scheduling Modal
- Centered overlay with backdrop
- Form layout: Email field, Frequency radio group, Day/Time selectors
- Footer: Cancel (secondary) + Schedule (primary) buttons

---

## Interactions & States

**Minimal Animations:**
- Card hover: subtle shadow increase (transition-shadow duration-200)
- Button hover: slight opacity/background change
- Table row hover: background color transition
- Modal: Fade in backdrop, slide-up content (duration-300)

**Loading States:**
- Skeleton screens for dashboard metrics
- Spinner for table data
- Progress indicator for chart loading

**No Complex Animations:** Avoid scroll-triggered effects, parallax, or decorative motion

---

## Accessibility

- Semantic HTML structure (header, main, section elements)
- ARIA labels for interactive elements
- Keyboard navigation support (Tab order, Enter/Space for actions)
- Focus indicators on all interactive elements (ring-2 ring-blue-500)
- Color contrast meeting WCAG AA standards
- Form labels properly associated with inputs

---

## Images

**No hero images** - This is a data dashboard, not a marketing page. Focus entirely on functional UI and data visualization.

**Icons only:** Use icon library for visual elements (status indicators, navigation, actions)
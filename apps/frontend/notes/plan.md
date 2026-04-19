# SaaS Database Schema Design (Supabase) - Retail Ctrl

## Goal

Design a relational database schema in Supabase (Postgres) that supports the MVP features of a SaaS product for a convenience stores / grocery stores / supermarkets

---

## Requirements

### 1. Core Features (MVP)

- Product price checking
- OCR-based invoice data extraction
- Dashboard for tracking savings across suppliers after placing orders

---

### 2. Authentication & Permissions

- Supabase Auth will handle authentication.
- Schema must support multi-tenant SaaS:
  - Multiple companies (clients)
  - Each company can have a head office with multiple users
  - Each company can have multiple stores
  - Stores can have users with roles such as owner, manager, supervisor, staff
- Start with a simple structure, but make it easy to grow into full role-based access control.

---

### 3. Products & Suppliers

- Periodically upload a file with ~30k products (core product catalog).
  - Fields:
    - Article code (Musgrave that is availabe just on musgrave)
    - EAN code (other suppliers)
    - Description
    - Cost
    - VAT
    - accounts/category
    - (extendable for more fields later)
  - High-performance required → indexing or partitioning advice needed.

- Suppliers:
  - Each supplier provides daily updated product lists with prices.
  - Supplier data includes **EAN code** (not article code).
  - Must link supplier products to master product records via **EAN code**.

- Must support efficient comparisons across suppliers for the same product.

---

### 4. Invoices & OCR

- OCR API extracts invoice data and stores it in the database.

Here, i need you help, because most suppliers will have just one line

- **Invoice header fields:**
  - Supplier name
  - Invoice number
  - Date
  - lines [account/cattegory, Description, unit cost net, unit cost gross, vat]
  - Total Price Net
  - vat
  - Total gross cost
  - Type (sale/credit)

- Must support multiple suppliers and thousands of invoices.

---

### 5. Orders & Savings Tracking

- When placing an order (after price comparison), store order details:
  - Supplier
  - Product
  - Chosen price

- Track **savings per order** by comparing chosen supplier’s price against alternatives.

- Dashboard should report:
  - Total savings
  - Supplier breakdowns
  - Trends over time

- Need advice:
  - Use **derived tables/views** or
  - Use **separate persisted summary tables** for dashboard data

---

## Task

Design a relational database schema in Supabase (Postgres) that supports all the requirements above.

- Specify the tables, their relationships, and key fields.
- Recommend indexing strategies for high-performance queries (especially for 30k+ products and supplier price updates).
- Ensure the schema supports multi-tenancy and role-based access.
- Propose a clean and scalable approach for the dashboard and savings tracking (views vs. summary tables).
- Keep the design extensible for future growth.

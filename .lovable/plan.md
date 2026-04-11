
# Business Management Platform — Phase 1: Foundation & User Management

## Overview
Build the foundation of a modular business management app for your Chevron/Phillips 66 lubricants distribution company. This first phase sets up authentication, roles, teams, and the app shell that all future modules will plug into.

## What we'll build

### 1. App Shell & Navigation
- Sidebar layout with module navigation (CRM, Inventory, Quotes, Delivery, etc.)
- Modules shown/hidden based on user permissions
- Dashboard home page with quick stats and module shortcuts
- Professional branding suited to an industrial/distribution business

### 2. Authentication (Lovable Cloud)
- Login & signup pages with email/password
- Password reset flow
- Session management

### 3. Roles & Teams System (Database)
- **Roles**: Sales, Delivery, Warehouse, Customer Service, Accounting, Manager, Admin
- **Teams**: Flexible team creation (e.g., "North Region Sales", "Main Warehouse")
- Users can belong to multiple roles AND multiple teams
- Database tables: `profiles`, `user_roles`, `teams`, `team_members`
- Row-Level Security policies using security-definer functions

### 4. User Management (Admin UI)
- Admin page to view all users
- Assign/remove roles and teams per user
- Create and manage teams
- User profile page where users can view their own info

### 5. Module Placeholder Pages
- Stub pages for each future module: CRM, Inventory, Quotes, Delivery, Training, Inventory Transfers, Projects & Tasks, Product Inquiry
- Each protected by role-based access
- Ready to be built out in subsequent phases

## Permissions Model
| Role | Accessible Modules |
|------|-------------------|
| Admin | All modules + User Management |
| Manager | All modules (read), Team management |
| Sales | CRM, Quotes, Product Inquiry |
| Delivery | Delivery, Inventory (read) |
| Warehouse | Inventory, Transfers |
| Customer Service | CRM (read), Product Inquiry |
| Accounting | Invoicing, Reports |

## Next phases (not in this plan)
- Phase 2: CRM + Quotes module
- Phase 3: Inventory & Product Catalog
- Phase 4: Delivery management
- Phase 5: Additional modules as needed

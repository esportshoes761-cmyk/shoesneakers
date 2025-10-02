# ZapaShop - E-commerce Shoe Store

## Overview

ZapaShop is a modern e-commerce application for selling shoes, built as a full-stack web application with a React frontend and Express backend. The application features a clean, responsive design with category-based product browsing, flash sales, promotional banners, and a shopping cart system. It includes both customer-facing shopping functionality and a seller dashboard for product management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript running on Vite for fast development and building
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent, modern UI components
- **State Management**: Zustand for client-side cart state with persistence to localStorage
- **Data Fetching**: TanStack Query (React Query) for server state management, caching, and API interactions
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js web framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Storage Strategy**: PostgreSQL database storage for full data persistence - all admin changes are permanently saved
- **API Design**: RESTful API endpoints following conventional HTTP methods
- **Development**: Hot module replacement via Vite integration for seamless development experience

### Database Schema
The application uses a relational database structure with the following entities:
- **Users**: Authentication and seller identification
- **Categories**: Product categorization with emoji icons
- **Products**: Core product information including pricing, discounts, stock, and features (flash sale, featured)
- **Cart Items**: User shopping cart management

### Component Architecture
- **UI Components**: Modular component system using shadcn/ui primitives
- **Page Components**: Route-based page components for home and seller dashboard
- **Feature Components**: Specialized components for product cards, category navigation, cart management, and promotional content
- **Layout Components**: Header navigation and floating cart for consistent user experience

### State Management Strategy
- **Server State**: TanStack Query manages all server-side data with automatic caching and synchronization
- **Client State**: Zustand handles cart state with localStorage persistence for cross-session continuity
- **Form State**: React Hook Form manages individual form states with real-time validation

## External Dependencies

### Database and ORM
- **Neon Database**: PostgreSQL database hosting service accessed via `@neondatabase/serverless`
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect for schema management and queries

### UI and Styling Framework
- **Radix UI**: Accessible, unstyled UI primitives for complex components (dialogs, dropdowns, form controls)
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **shadcn/ui**: Pre-built component library combining Radix UI with Tailwind styling
- **Lucide React**: Icon library for consistent iconography

### Development and Build Tools
- **Vite**: Build tool and development server with TypeScript support
- **Replit Integration**: Vite plugins for Replit-specific development features including error overlay and cartographer

### Form and Validation Libraries
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation for forms and API data
- **@hookform/resolvers**: Integration between React Hook Form and Zod validation

### Additional Utilities
- **date-fns**: Date utility library for time calculations in flash sale countdown
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx**: Utility for conditional CSS class concatenation

## Recent Changes

### 2025-10-02
- **DUPLICATE IMAGE DETECTION**: Implemented comprehensive duplicate detection system for bulk uploads using SHA-256 hash comparison
- **REAL-TIME ALERTS**: System now shows detailed alerts when duplicate images are detected during package uploads, including:
  - Total number of duplicates found
  - Product name and reference for each duplicate
  - Brand name where duplicate exists
  - Number of times each image has been used
- **BACKEND OPTIMIZATION**: Added `checkPackageDuplicates()` to intelligent upload endpoint to verify images before creation
- **BRAND MANAGEMENT FIXES**:
  - Fixed brand admin panel to show ALL brands (with or without products)
  - Fixed brand photo display in edit mode - images now properly load when editing existing brands
  - Added `value` prop to ObjectUploader component for controlled image display
- **USER EXPERIENCE**: Toast notifications now display duplicate information for 10 seconds with clear, actionable details

### 2025-09-18
- **CRITICAL BUGFIX**: Resolved SQL error "no such column: customer_name" that was preventing product magnification (lupa) from working
- **Brand Filtering**: Implemented strict brand separation - clients only see brands with products (productCount > 0), admin sees all brands
- **UI Optimization**: Redesigned brand section to be ultra-compact - horizontal scrolling on mobile, dense grid on desktop to reduce screen space
- **Performance**: Maintained FASTSNEAKERS speed with endpoints responding in 0-8ms, ensuring zero loading delays
- **Database Schema**: Updated SQLite schema to include missing columns and proper brand separation by displayLocation

### 2025-09-17
- Fixed exact product counting per brand using SQL COUNT() optimization instead of in-memory filtering
- Added "CATÁLOGO COMPLETO" brand with placeholder logo to system defaults
- Enhanced MultiImageUploader with detailed image upload verification and progress notifications
- Added new brands: "EUROPEO" (elegant European style) and "GUALLOS" (artisanal leather footwear)
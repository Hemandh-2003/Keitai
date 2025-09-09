E-Commerce Platform

A full-featured E-Commerce Web Application built with Node.js, Express, MongoDB, EJS templates. The application includes a user-friendly shopping experience with robust admin management, dynamic sorting, searching, stock management, order processing, coupon integration, Razorpay payment gateway, and more.

🚀 Project Overview

This e-commerce platform allows users to browse products, filter and search, add to cart, checkout with multiple payment options, apply coupons, and track orders. The admin panel enables product, category, coupon, and user management with real-time stock handling, orders tracking, and analytics.

✅ Features
User-Side

User registration, login, and session management

Browse products by category (laptops, phones, accessories, etc.)

Search products with full-text indexing

Filter and sort products dynamically

Cart functionality with real-time quantity updates

Checkout with multiple payment methods (COD, Wallet, Razorpay, Online)

Apply coupons and discounts

View order history, status, cancellation, and returns

Wishlist functionality

OTP-based verification and password recovery

Address management in checkout

Wallet integration with transaction logs

Product availability based on stock and block status

Responsive and clean UI

Admin-Side

User management with block/unblock and status filters

Category management with add/edit/delete functionalities

Product management including stock control and offers

Order management with status tracking, cancellations, returns, and payment retries

Coupon creation and discount rules

Razorpay payment integration and retries for failed payments

Dashboard with analytics and reports

Secure session handling with express-session and MongoDB storage

Modular MVC architecture for scalability

📂 Technologies Used

Node.js & Express.js – Backend framework

MongoDB & Mongoose – Database and ORM

EJS templates – Server-rendered UI with reusable components

Bootstrap / Custom CSS – Styling and responsiveness

Razorpay – Payment gateway integration

SweetAlert2 – User notifications

Connect-mongo – Session storage

Full-text search indexing – Fast search functionality

AJAX (Fetch API) – For dynamic interactions like search and filtering

Shortid – Generating unique order IDs

📦 Installation

Clone the repository:

git clone https://github.com/yourusername/ecommerce-platform.git


Install dependencies:

cd ecommerce-platform
npm install


Create a .env file with the following variables:

MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password


Start the development server:

npm start


Access the application:

User interface: https://KeitaiShoppe.ddns.net/

Admin panel: https://keitaishoppe.ddns.net/admin/dashboard

📋 API Endpoints
Users

/user/signup – User registration with OTP

/user/login – Login functionality

/user/forgot-password – Password reset with OTP

/user/checkout – Checkout flow

/user/orders – Order tracking

/user/wishlist – Manage wishlist

Admin

/admin/dashboard – Admin overview

/admin/products – Manage products

/admin/categories – Manage categories

/admin/users – Manage users with filters

/admin/orders – View and update orders

/admin/coupons – Manage discount coupons

/admin/payments – Track and retry payments

📂 Folder Structure
/controllers      # Business logic for routes
/models           # Mongoose schemas
/routes           # Route definitions
/views            # EJS templates
/public/css       # Styling
/public/js        # Client-side scripts
/config           # Configuration files like database connection
/middleware       # Middleware for authentication and error handling

🔑 Security & Best Practices

Uses session-based authentication stored in MongoDB

Input validation using regex and form constraints

Avoids business logic in routes by using MVC architecture

Handles payment retries securely through Razorpay integration

Implements stock management using atomic MongoDB operations

Provides structured error handling with informative responses

📈 Future Enhancements

Implement role-based access control (RBAC)

Add advanced analytics dashboards

Integrate social login options (Google, Facebook)

Expand search with AI-based recommendations

Improve scalability with microservices

Add email verification links and two-factor authentication
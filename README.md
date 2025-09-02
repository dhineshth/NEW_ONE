# Role-Based Authentication System

A comprehensive role-based authentication system with company and user management built with FastAPI and modern HTML/CSS/JavaScript.

## 🏗️ System Architecture

### User Roles
1. **Super Admin** - Can create companies and manage all users
2. **Company Admin** - Can manage users within their company
3. **Regular User** - Limited access to personal and company information

### Database Tables
- `super_admins` - Super admin users
- `companies` - Company information
- `company_users` - Company-specific users

## 🚀 Features

### Super Admin Dashboard
- ✅ Create and manage companies
- ✅ Create users for any company
- ✅ View system-wide statistics
- ✅ Manage all companies and users

### Company Admin Dashboard
- ✅ Welcome to company message
- ✅ Create users within their company
- ✅ View company-specific user data
- ✅ Company information management

### User Dashboard
- ✅ Welcome user message
- ✅ View personal profile
- ✅ Access company information
- ✅ View activity and statistics

## 📁 File Structure

```
├── main.py                      # FastAPI backend
├── index.html                   # Login page
├── super-admin-dashboard.html   # Super admin interface
├── company-dashboard.html       # Company admin interface
├── user-dashboard.html          # User interface
├── resume.html                  # Legacy file (can be removed)
└── README.md                    # This file
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
pip install fastapi uvicorn supabase python-dotenv bcrypt
```

### 2. Environment Setup

Create a `.env` file in your project root:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 3. Database Setup

Create the following tables in your Supabase database:

#### super_admins table
```sql
CREATE TABLE super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'super_admin',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### companies table
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### company_users table
```sql
CREATE TABLE company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    role VARCHAR NOT NULL CHECK (role IN ('company_admin', 'user')),
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Create Initial Super Admin

Insert a super admin user (password will be hashed):

```sql
INSERT INTO super_admins (name, email, password, role) 
VALUES ('Super Admin', 'admin@example.com', '$2b$12$hashed_password_here', 'super_admin');
```

To generate a hashed password, you can use this Python script:

```python
import bcrypt
password = "your_password"
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
print(hashed.decode('utf-8'))
```

### 5. Run the Application

```bash
python main.py
```

The application will be available at `http://127.0.0.1:8000`

## 🔐 Authentication Flow

1. **Login** - Users login through `index.html`
2. **Role Detection** - System checks user role and redirects accordingly
3. **Dashboard Access** - Users see role-specific dashboards
4. **Session Management** - JWT tokens stored in localStorage

## 🎨 User Interface Features

### Login Page (`index.html`)
- Modern gradient design
- Email/password authentication
- Role-based redirects
- Error handling and loading states

### Super Admin Dashboard (`super-admin-dashboard.html`)
- Company creation modal
- User creation modal
- Data tables for companies and users
- Statistics overview
- Purple gradient theme

### Company Dashboard (`company-dashboard.html`)
- Company information display
- User management within company
- Green gradient theme
- Company-specific statistics

### User Dashboard (`user-dashboard.html`)
- Personal profile information
- Company information access
- Activity tracking
- Blue gradient theme

## 🔧 API Endpoints

### Authentication
- `POST /login` - User login

### Companies
- `POST /companies` - Create company (Super Admin only)
- `GET /companies` - List all companies

### Users
- `POST /users` - Create user (Super Admin/Company Admin)
- `GET /users` - List users (with optional company filter)

### Dashboard
- `GET /dashboard` - Get dashboard statistics

## 🎯 Role-Based Access Control

### Super Admin Permissions
- Create and manage companies
- Create users for any company
- View all system data
- Access super admin dashboard

### Company Admin Permissions
- Create users within their company
- View company-specific data
- Manage company users
- Access company dashboard

### User Permissions
- View personal profile
- Access company information
- View activity data
- Access user dashboard

## 🚨 Security Features

- Password hashing with bcrypt
- Role-based access control
- Session management with tokens
- Input validation with Pydantic
- CORS configuration for frontend

## 🎨 Design Features

- Responsive design
- Modern gradient themes
- Interactive modals
- Loading states
- Success/error messages
- Hover effects and animations

## 🔄 Workflow Example

1. **Super Admin Login**
   - Login with super admin credentials
   - Redirected to super admin dashboard
   - Create a new company
   - Create company admin user

2. **Company Admin Login**
   - Login with company admin credentials
   - See "Welcome to Company Dashboard"
   - Create regular users for their company
   - View company-specific data

3. **User Login**
   - Login with user credentials
   - See "Welcome User"
   - View personal profile and company info
   - Access limited features

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure the backend is running on `http://127.0.0.1:8000`
   - Check CORS configuration in `main.py`

2. **Database Connection**
   - Verify Supabase credentials in `.env`
   - Check table structure matches the schema

3. **Authentication Issues**
   - Ensure passwords are properly hashed
   - Check user role values match expected values

### Debug Mode

To enable debug mode, add this to your `.env`:

```env
DEBUG=true
```

## 📝 Future Enhancements

- [ ] JWT token implementation
- [ ] Password reset functionality
- [ ] User profile editing
- [ ] Activity logging
- [ ] Email notifications
- [ ] Advanced reporting
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

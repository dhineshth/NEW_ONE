<<<<<<< HEAD
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
=======
# resume_parser



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/talenthive_group/resume_parser.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.com/talenthive_group/resume_parser/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> 3c023d93f30e84b13ec72bc461ac5084dd8ad829

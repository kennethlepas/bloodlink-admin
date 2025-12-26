# BloodLink Admin Panel

Admin dashboard for managing blood bank operations including inventory, donors, and blood requests.

## Features

- 🩸 Blood Inventory Management
- 👥 Donor Verification System
- 📋 Blood Request Tracking
- 📊 Real-time Statistics Dashboard
- 🔐 Secure Admin Authentication

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Authentication

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bloodlink-admin.git
cd bloodlink-admin
```

2. Install dependencies:
```bash
pip install flask flask-cors
```

3. Configure Firebase:
   - Create a Firebase project
   - Enable Authentication and Realtime Database
   - Update Firebase config in `static/app.js`

4. Run the application:
```bash
python app.py
```

5. Open browser to `http://localhost:5000`

## Project Structure
```
bloodlink-admin/
├── app.py              # Flask server
├── templates/
│   └── index.html      # Admin panel UI
├── static/
│   ├── app.js          # JavaScript logic
│   └── styles.css      # Styling
└── README.md
```

## Admin Access

Only users listed in the Firebase Realtime Database under `/admins` can access the admin panel.

## Security

- Admin authentication required
- Firebase security rules enforce access control
- Sensitive credentials excluded from repository

## License

MIT License
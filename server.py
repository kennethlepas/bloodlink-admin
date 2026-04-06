from flask import Flask, render_template, send_from_directory, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

CORS(app)

# ==================== PAGE ROUTES ====================

# Welcome/Login Page
@app.route('/')
@app.route('/claim')
def index():
    return render_template('index.html')

# Dashboard
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

# Blood Banks Management
@app.route('/blood-banks')
def blood_banks():
    return render_template('super_admin_hospitals.html')

@app.route('/.well-known/appspecific/com.chrome.devtools.json')
def chrome_devtools_json():
    return {"status": "ok"}, 200, {'Content-Type': 'application/json'}

# Donors Management
@app.route('/donors')
def donors():
    return render_template('donors.html')

# User Management (Donors & Requesters)
@app.route('/users')
def users():
    return render_template('users.html')

# Blood Requests Management
@app.route('/requests')
def requests():
    return render_template('requests.html')

# Reviews Management
@app.route('/reviews')
def reviews():
    return render_template('reviews.html')

# Reports Management
@app.route('/reports')
def reports():
    return render_template('reports.html')

# Verifications Management
@app.route('/verifications')
def verifications():
    return render_template('verifications.html')

# Notifications
@app.route('/notifications')
def notifications():
    return render_template('notifications.html')

# Bookings (Super Admin)
@app.route('/bookings')
def bookings():
    return render_template('bookings.html')

# Referrals
@app.route('/referrals')
def referrals():
    return render_template('referrals.html')

# Chat
@app.route('/chat')
def chat():
    return render_template('chat.html')

# Support Tickets
@app.route('/tickets')
def tickets():
    return render_template('tickets.html')


# Hospital Dashboard/Landing
@app.route('/hospital/dashboard')
def hospital_dashboard():
    return render_template('hospital/dashboard.html')

@app.route('/hospital/requests')
def hospital_requests():
    return render_template('hospital/requests.html')

@app.route('/hospital/referrals')
def hospital_referrals():
    return render_template('hospital/referrals.html')

@app.route('/hospital/referrals/new')
def hospital_referral_new():
    return render_template('hospital/referral_new.html')

@app.route('/hospital/policies')
def hospital_policies():
    return render_template('hospital/policies.html')

@app.route('/hospital/logs')
def hospital_logs():
    return render_template('hospital/logs.html')

@app.route('/hospital/chat')
def hospital_chat():
    return render_template('hospital/chat.html')

@app.route('/hospital/reports')
def hospital_reports():
    return render_template('hospital/reports.html')

@app.route('/hospital/notifications')
def hospital_notifications():
    return render_template('hospital/notifications.html')

@app.route('/hospital/bookings')
def hospital_bookings():
    return render_template('hospital/bookings.html')

@app.route('/hospital/donors')
def hospital_donors():
    return render_template('hospital/donors.html')

@app.route('/hospital/hospitals')
def hospital_directory():
    return render_template('hospital/hospitals.html')

@app.route('/hospital/settings')
def hospital_settings():
    return render_template('hospital/settings.html')

# Keep old route for backward compatibility but redirect
@app.route('/hospital')
def hospital_redirect():
    return render_template('hospital/dashboard.html')

# Settings (Super Admin)
@app.route('/settings')
def settings():
    return render_template('settings.html')

# System Configuration (Super Admin)
@app.route('/system-config')
def system_config():
    return render_template('system-config.html')

# Admin Policies
@app.route('/policies')
def policies():
    return render_template('policies.html')

# System Logs (Admin + User Activity)
@app.route('/system-logs')
def system_logs():
    return render_template('system-logs.html')

# Audit Logs (Admin Only)
@app.route('/audit-logs')
def audit_logs():
    return render_template('audit_logs.html')

# ==================== STATIC FILES ====================

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# ==================== API ENDPOINTS ====================

# API endpoint to check server health
@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'BloodLink Admin Panel API is running'
    })

# API endpoint for blood bank statistics (if needed for external queries)
@app.route('/api/stats')
def get_stats():
    return jsonify({
        'message': 'Stats are managed via Firebase in real-time'
    })

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return render_template('index.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'message': 'Please try again later'
    }), 500

    # Add these routes to your server.py

# Hospital Bookings API endpoints
@app.route('/api/hospital/bookings/donor')
def get_hospital_donor_bookings():
    """Get donor bookings for a specific hospital"""
    hospital_id = request.args.get('hospitalId')
    hospital_code = request.args.get('hospitalCode')
    
    if not hospital_id and not hospital_code:
        return jsonify({'error': 'Hospital ID or code required'}), 400
    
    # This will be handled by Firebase on frontend
    return jsonify({'message': 'Fetch from Firebase client-side'}), 200

@app.route('/api/hospital/bookings/recipient')
def get_hospital_recipient_bookings():
    """Get recipient bookings for a specific hospital"""
    hospital_id = request.args.get('hospitalId')
    hospital_code = request.args.get('hospitalCode')
    
    if not hospital_id and not hospital_code:
        return jsonify({'error': 'Hospital ID or code required'}), 400
    
    return jsonify({'message': 'Fetch from Firebase client-side'}), 200

@app.route('/api/hospital/broadcast', methods=['POST'])
def create_hospital_broadcast():
    """Create a blood request broadcast from hospital"""
    data = request.json
    # This will be handled by Firebase on frontend
    return jsonify({'message': 'Broadcast created via Firebase'}), 200

# ==================== SERVER STARTUP ====================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    print("=" * 60)
    print("🩸 BloodLink Admin Panel Server")
    print("=" * 60)
    print(f"Server running at: http://localhost:{port}")
    print(f"Admin Panel: http://localhost:{port}")
    print(f"Health Check: http://localhost:{port}/api/health")
    print()
    print("Available Routes:")
    print(f"  • Login:       http://localhost:{port}/")
    print(f"  • Dashboard:   http://localhost:{port}/dashboard")
    print(f"  • Blood Banks: http://localhost:{port}/blood-banks")
    print(f"  • Donors:      http://localhost:{port}/donors")
    print(f"  • Requests:    http://localhost:{port}/requests")
    print(f"  • Reviews:     http://localhost:{port}/reviews")
    print()
    print(f"Press CTRL+C to stop the server")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=port, debug=True)
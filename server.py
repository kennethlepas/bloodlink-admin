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
def index():
    return render_template('index.html')

# Dashboard
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

# Blood Banks Management
@app.route('/blood-banks')
def blood_banks():
    return render_template('blood_banks.html')

# Donors Management
@app.route('/donors')
def donors():
    return render_template('donors.html')

# Blood Requests Management
@app.route('/requests')
def requests():
    return render_template('requests.html')

# Reviews Management
@app.route('/reviews')
def reviews():
    return render_template('reviews.html')

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
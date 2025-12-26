from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    print("=" * 60)
    print("🩸 BloodLink Admin Panel Server")
    print("=" * 60)
    print(f"Server running at: http://localhost:{port}")
    print(f"Press CTRL+C to stop the server")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=port, debug=True)

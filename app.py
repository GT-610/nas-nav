from flask import Flask, jsonify, request, send_from_directory 
from flask_sqlalchemy import SQLAlchemy 
from flask_cors import CORS 
import os

from werkzeug.security  import generate_password_hash, check_password_hash 
import sqlite3 


# 初始化应用 
app = Flask(__name__)
app.config.update({ 
    'SQLALCHEMY_DATABASE_URI': 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'db/nav.db'), 
    'SQLALCHEMY_TRACK_MODIFICATIONS': False 
})

import secrets
app.secret_key = secrets.token_hex(16)  # 生成32字符的随机十六进制字符串

# 初始化扩展 
db = SQLAlchemy(app)
CORS(app)  # 允许跨域请求 
 
# 数据模型 
class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    ip_url = db.Column(db.String(200), nullable=False)
    domain_url = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(200))
 
    def to_dict(self):
        return {
            'id': self.id, 
            'name': self.name, 
            'category': self.category, 
            'ip_url': self.ip_url, 
            'domain_url': self.domain_url, 
            'description': self.description  
        }

# 路由配置
@app.route('/') 
def serve_index():
    return send_from_directory(app.static_folder,  'html/index.html') 

# API
@app.route('/api/services',  methods=['GET'])
def get_services():
    with sqlite3.connect('database/nav.db')  as conn:
        conn.row_factory  = sqlite3.Row 
        c = conn.cursor() 
        services = c.execute(''' 
            SELECT id, name, url, category, icon, sort_order 
            FROM services ORDER BY sort_order 
        ''').fetchall()
        return jsonify([dict(s) for s in services])
 
@app.route('/api/services/add',  methods=['POST'])
def add_service():
    if not session.get('authenticated'): 
        abort(403)
    data = request.get_json() 
    with sqlite3.connect('database/nav.db')  as conn:
        c = conn.cursor() 
        # 获取当前最大排序值 
        max_order = c.execute('SELECT  MAX(sort_order) FROM services').fetchone()[0] or 0 
        c.execute(''' 
            INSERT INTO services (name, url, category, icon, sort_order)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            data['name'],
            data['url'],
            data['category'],
            data.get('icon',  ''),
            max_order + 1 
        ))
        conn.commit() 
        return jsonify({'id': c.lastrowid}) 
 
@app.route('/api/services/delete/<int:service_id>',  methods=['DELETE'])
def delete_service(service_id):
    if not session.get('authenticated'): 
        abort(403)
    with sqlite3.connect('database/nav.db')  as conn:
        c = conn.cursor() 
        # 先获取被删项目的排序值 
        deleted_order = c.execute('SELECT  sort_order FROM services WHERE id = ?', 
                                (service_id,)).fetchone()[0]
        # 删除项目 
        c.execute('DELETE  FROM services WHERE id = ?', (service_id,))
        # 调整剩余项目的排序 
        c.execute('UPDATE  services SET sort_order = sort_order - 1 WHERE sort_order > ?', 
                (deleted_order,))
        conn.commit() 
        return jsonify({'success': True})
 
@app.route('/api/services/reorder',  methods=['POST'])
def reorder_services():
    if not session.get('authenticated'): 
        abort(403)
    new_order = request.get_json() 
    with sqlite3.connect('database/nav.db')  as conn:
        c = conn.cursor() 
        for index, service_id in enumerate(new_order, start=1):
            c.execute('UPDATE  services SET sort_order = ? WHERE id = ?',
                    (index, service_id))
        conn.commit() 
        return jsonify({'success': True})

# 身份验证
from flask_httpauth import HTTPTokenAuth 
 
auth = HTTPTokenAuth(scheme='Bearer')
 
@auth.verify_token  
def verify_token(token):
    return token == os.getenv('ADMIN_TOKEN') 
 
@app.route('/api/services/<int:id>',  methods=['DELETE'], endpoint='delete_service_endpoint')  # 添加endpoint参数
@auth.login_required  
def delete_service(id):
    service = Service.query.get_or_404(id) 
    db.session.delete(service) 
    db.session.commit() 
    return '', 204 

from flask import session, redirect 
 
# 管理后台验证
@app.route('/admin') 
def admin_console():
    if not session.get('authenticated'): 
        return redirect('/admin/login')
    return send_from_directory(app.static_folder, 'html/admin.html') 
 
@app.route('/admin/login',  methods=['GET', 'POST'])
def admin_login():
    if request.method  == 'POST':
        # 密码验证逻辑 
        input_pass = request.form.get('password') 
        with sqlite3.connect('db/nav.db')  as conn:
            c = conn.cursor() 
            stored_hash = c.execute("SELECT  password_hash FROM auth").fetchone()[0]
            if check_password_hash(stored_hash, input_pass):
                session['authenticated'] = True 
                return redirect('/admin')
        return "Invalid password", 401 
    return '''
        <form method="post">
            <input type="password" name="password" required>
            <button type="submit">登录</button>
        </form>
    '''
 
@app.route('/admin/logout') 
def admin_logout():
    session.pop('authenticated',  None)
    return redirect('/')

# 初始化数据库命令行指令 
@app.cli.command('init-db') 
def init_db():
    with sqlite3.connect('database/nav.db')  as conn:
        c = conn.cursor() 
        # 服务项目表 
        c.execute('''CREATE  TABLE IF NOT EXISTS services 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT,
                     name TEXT NOT NULL UNIQUE,
                     url TEXT NOT NULL,
                     category TEXT DEFAULT '其他',
                     icon TEXT,
                     sort_order INTEGER DEFAULT 999)''')
        conn.commit() 
    print("服务初始化完成")

    with sqlite3.connect('db/nav.db')  as conn:
        c = conn.cursor() 
        # 新增密码存储表 
        c.execute('''CREATE  TABLE IF NOT EXISTS auth 
                    (id INTEGER PRIMARY KEY, 
                    password_hash TEXT NOT NULL)''')
            
        # 初始化默认密码（示例密码123456）
        if not c.execute("SELECT  * FROM auth").fetchone():
            default_hash = generate_password_hash("admin")
            c.execute("INSERT  INTO auth (password_hash) VALUES (?)", (default_hash,))
        conn.commit()
        print("密码初始化完成")
    print("数据库初始化完成")

# 迁移数据库
@app.cli.command('migrate-db')
def migrate_db():
    from flask_migrate import Migrate
    migrate = Migrate(app, db)

if __name__ == '__main__':
    app.run(host='0.0.0.0',  port=5000, debug=True)
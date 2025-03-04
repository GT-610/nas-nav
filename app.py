# 标准库导入 
import os 
import secrets 
from datetime import timedelta 
from pathlib import Path 
 
# 第三方库导入 
from flask import (
    Flask, jsonify, request, session, 
    abort, redirect, send_from_directory 
)
from flask_sqlalchemy import SQLAlchemy 
from flask_migrate import Migrate 
from flask_cors import CORS 
from werkzeug.security  import generate_password_hash, check_password_hash 
from sqlalchemy.sql import text
from sqlalchemy.exc  import IntegrityError, SQLAlchemyError 
 
# ---------------------------- 应用初始化 ----------------------------
app = Flask(__name__, static_folder='static')
 
# 配置类 
class Config:
    # 路径配置 
    BASE_DIR = Path(__file__).parent 
    DB_PATH = BASE_DIR / 'db' / 'nav.db' 
    
    # 安全配置 
    SECRET_KEY = secrets.token_hex(32) 
    SESSION_COOKIE_HTTPONLY = True 
    SESSION_COOKIE_EXPIRES = 0  # 浏览器关闭时过期
    PERMANENT_SESSION_LIFETIME = timedelta(seconds=0)  # 设置会话有效期
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=15)  # 缩短会话有效期
    
    # 数据库配置 
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{DB_PATH}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False 
 
app.config.from_object(Config) 
CORS(app, supports_credentials=True)
 
# 扩展初始化 
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# ---------------------------- 分类模型 ----------------------------
class Category(db.Model):
    """分类数据模型"""
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

# ---------------------------- 服务模型 ----------------------------
class Service(db.Model):
    """服务导航数据模型"""
    __tablename__ = 'services'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    category = db.relationship(
        'Category',
        backref=db.backref('services', lazy='dynamic'),
        lazy='joined',  # 自动 JOIN 加载关联数据
    )
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    ip_url = db.Column(db.String(200))  # 新增IP地址字段
    domain_url = db.Column(db.String(200), nullable=False)  # 原url改为域名字段
    description = db.Column(db.String(200))
    icon = db.Column(db.String(200))
    sort_order = db.Column(db.Integer, server_default='999')
    

    def to_dict(self):
        return {c.name:  getattr(self, c.name)  for c in self.__table__.columns}
 
class Auth(db.Model):
    """认证数据模型"""
    __tablename__ = 'auth'
    
    id = db.Column(db.Integer, primary_key=True)
    password_hash = db.Column(db.String(128), nullable=False)
 
# ---------------------------- 工具函数 ----------------------------
def validate_password_complexity(password):
    """密码复杂度验证"""
    if len(password) < 8:
        raise ValueError("后端提示：密码长度至少8位")
    if not any(c.isupper()  for c in password):
        raise ValueError("后端提示：必须包含至少一个大写字母")
    if not any(c.isdigit()  for c in password):
        raise ValueError("后端提示：必须包含至少一个数字")
 
# ---------------------------- 路由处理 ----------------------------
@app.route('/') 
def serve_index():
    """主页面路由"""
    return send_from_directory(app.static_folder,  'html/index.html') 

# ---------------------------- 公共API ----------------------------
# 公开只读端点
@app.route('/api/public/services', methods=['GET'])
def public_get_services():
    """公开获取服务数据（支持分类过滤）"""
    try:
        category_filter = request.args.get('category')
        base_query = Service.query.options(db.joinedload(Service.category))

        # 添加分类过滤条件
        if category_filter and category_filter.lower() != 'all':
            base_query = base_query.join(Category).filter(
                db.func.lower(Category.name) == category_filter.lower()
            )

        services = base_query.order_by(Service.sort_order).all()
        
        return jsonify([{
            'name': s.name,
            'category': s.category.name if s.category else '未分类',
            'ip_url': s.ip_url,
            'domain_url': s.domain_url,
            'description': s.description,
            'icon_url': s.icon
        } for s in services])
        
    except SQLAlchemyError as e:
        app.logger.error(f"数据库查询失败: {str(e)}")
        abort(500)

@app.route('/api/public/categories', methods=['GET'])
def get_categories():
    """获取所有分类"""
    try:
        categories = Category.query.order_by(Category.id).all()
        return jsonify([{'id': c.id, 'name': c.name} for c in categories])
    except SQLAlchemyError as e:
        app.logger.error(f"分类查询失败: {str(e)}")
        abort(500)

# ---------------------------- 分类管理API ----------------------------
@app.route('/api/categories', methods=['POST'])
def add_category():
    """添加新分类"""
    if not session.get('authenticated'):
        abort(403)
    
    try:
        data = request.get_json()
        if not data.get('name'):
            return jsonify(error="分类名称不能为空"), 400

        category = Category(name=data['name'])
        db.session.add(category)
        db.session.commit()
        return jsonify({'id': category.id}), 201
        
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="分类名称已存在"), 409
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"添加分类失败: {str(e)}")
        abort(500)

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """删除分类"""
    if not session.get('authenticated'):
        abort(403)
    
    try:
        category = Category.query.get_or_404(category_id)
        
        # 检查是否有服务关联
        if Service.query.filter_by(category_id=category_id).first():
            return jsonify(error="请先删除该分类下的所有服务"), 409
            
        db.session.delete(category)
        db.session.commit()
        return jsonify(success=True)
        
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"删除分类失败: {str(e)}")
        abort(500)

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    """更新分类信息"""
    if not session.get('authenticated'):
        abort(403)
    
    try:
        category = Category.query.get_or_404(category_id)
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify(error="分类名称不能为空"), 400
            
        category.name = data['name']
        db.session.commit()
        return jsonify(success=True)
        
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="分类名称已存在"), 409
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"更新分类失败: {str(e)}")
        abort(500)
# ---------------------------- 管理API ----------------------------
@app.route('/api/services',  methods=['GET'])
def get_services():
    """获取所有服务"""
    if not session.get('authenticated'):
        abort(403)
    try:
        services = Service.query.order_by(Service.sort_order).all() 
        return jsonify([{
            **s.to_dict(),
            'category': s.category.name  # 添加分类名称字段
        } for s in services])
    except SQLAlchemyError as e:
        app.logger.error(f" 数据库查询失败: {str(e)}")
        abort(500)
 
@app.route('/api/services',  methods=['POST'])
def add_service():
    """添加新服务"""
    if not session.get('authenticated'): 
        abort(403)
    
    try:
        data = request.get_json() 
        max_order = db.session.query(db.func.max(Service.sort_order)).scalar()  or 0 
        
        service = Service(
            name=data['name'],
            ip_url=data['ip_url'],
            domain_url=data['domain_url'],
            category_id=data['category_id'],
            sort_order=max_order + 1 
        )
        
        db.session.add(service) 
        db.session.commit() 
        return jsonify({'id': service.id}),  201 
        
    except IntegrityError:
        db.session.rollback() 
        return jsonify(error="服务名称已存在"), 409 
    except KeyError as e:
        return jsonify(error=f"缺少必要字段: {e}"), 400 
 
@app.route('/api/services/<int:service_id>',  methods=['PUT'])
def update_service(service_id):
    """更新服务信息"""
    if not session.get('authenticated'): 
        abort(403)
    
    try:
        service = Service.query.get_or_404(service_id) 
        data = request.get_json() 
        
        service.name  = data.get('name',  service.name) 
        service.ip_url  = data.get('ip_url',  service.ip_url)
        service.domain_url  = data.get('domain_url',  service.domain_url)   # 替换原字段 
        service.category_id = data.get('category_id', service.category_id)
        
        db.session.commit() 
        return jsonify(success=True)
    except IntegrityError:
        db.session.rollback() 
        return jsonify(error="服务名称冲突"), 409 
 
@app.route('/api/services/<int:service_id>',  methods=['DELETE'])
def delete_service(service_id):
    """删除服务"""
    if not session.get('authenticated'): 
        abort(403)
    
    try:
        service = Service.query.get_or_404(service_id) 
        deleted_order = service.sort_order  
        
        db.session.delete(service) 
        db.session.execute( 
            text('UPDATE services SET sort_order = sort_order - 1 WHERE sort_order > :order'),
            {'order': deleted_order}
        )
        db.session.commit() 
        return jsonify(success=True)
    except IntegrityError as e:
        db.session.rollback() 
        return jsonify(error="删除失败：该服务可能被其他数据关联"), 409  # 外键约束错误
    except SQLAlchemyError as e:
        db.session.rollback() 
        app.logger.error(f"删除失败: {str(e)}")
        return jsonify(error="删除失败：数据库操作异常"), 500
    except Exception as e:
        app.logger.error(f"未知错误: {str(e)}")
        return jsonify(error="删除失败：服务器内部错误"), 500
 
@app.route('/api/services/reorder',  methods=['POST'])
def reorder_services():
    """重新排序服务"""
    if not session.get('authenticated'): 
        abort(403)
    
    try:
        new_order = request.get_json() 
        for index, service_id in enumerate(new_order, start=1):
            Service.query.filter_by(id=service_id).update({'sort_order':  index})
        db.session.commit() 
        return jsonify(success=True)
    except SQLAlchemyError as e:
        db.session.rollback() 
        app.logger.error(f" 排序更新失败: {str(e)}")
        abort(500)
 
# ---------------------------- 认证管理 ----------------------------
@app.route('/admin')
def admin_redirect():
    """后台管理入口"""
    if not session.get('authenticated'):
        return send_from_directory(app.static_folder, 'html/admin.html')
    return send_from_directory(app.static_folder, 'html/admin.html')
@app.route('/admin/login',  methods=['POST'])
def admin_login():
    """管理员登录"""
    try:
        data = request.get_json() 
        auth = Auth.query.first() 
        
        if not auth or not check_password_hash(auth.password_hash,  data['password']):
            return jsonify(error="无效凭证"), 401 
            
        session.clear() 
        session['authenticated'] = True 
        session.permanent  = False
        return jsonify(success=True)
        
    except KeyError:
        return jsonify(error="需要密码字段"), 400 

@app.route('/admin/change-password', methods=['POST'])
def change_password():
    """修改管理员密码"""
    try:
        data = request.get_json()
        old_password = data['oldPassword']
        new_password = data['newPassword']

        # 验证当前会话是否已认证
        if not session.get('authenticated'):
            return jsonify(error="未授权访问"), 403

        # 查询当前认证的用户
        auth = Auth.query.first()
        if not auth or not check_password_hash(auth.password_hash, old_password):
            return jsonify(error="原密码错误"), 401

        # 验证新密码复杂度
        validate_password_complexity(new_password)

        # 更新密码
        auth.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return jsonify(success=True)

    except KeyError:
        return jsonify(error="需要原密码和新密码字段"), 400
    except ValueError as e:
        return jsonify(error=str(e)), 400

@app.route('/admin/logout',  methods=['POST'])
def admin_logout():
    """管理员登出"""
    session.clear()  # 清除所有会话数据
    session.pop('authenticated',  None)
    return jsonify(success=True)
 
# ---------------------------- 错误处理 ----------------------------
@app.errorhandler(403) 
def forbidden_error(e):
    return jsonify(error="未授权访问"), 403 
 
@app.errorhandler(404) 
def not_found_error(e):
    return jsonify(error="资源未找到"), 404 
 
@app.errorhandler(500) 
def internal_error(e):
    db.session.rollback() 
    return jsonify(error="服务器内部错误"), 500 
 
# ---------------------------- CLI命令 ----------------------------
@app.cli.command('init-db') 
def init_db():
    """初始化数据库"""
    try:
        db_path = app.config['BASE_DIR']  / 'db'
        db_path.mkdir(exist_ok=True) 
        
        db.create_all()
        
        # 初始化默认分类
        default_category = Category.query.filter_by(name="默认").first()
        if not default_category:
            default_category = Category(name="默认")
            db.session.add(default_category)
            db.session.commit()
        
        # 初始化默认密码 
        if not Auth.query.first(): 
            default_hash = generate_password_hash("admin")
            auth = Auth(password_hash=default_hash)
            db.session.add(auth)
            
        db.session.commit()
        print("[安全警告] 已创建默认密码admin，请立即修改！")
        print("数据库初始化完成")
    except Exception as e:
        print(f"初始化失败: {str(e)}")
 
if __name__ == '__main__':
    app.run(host='0.0.0.0',  port=5000)
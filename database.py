# database.py
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.sql import text

db = SQLAlchemy()

class Category(db.Model):
    """分类数据模型"""
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

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
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

class Auth(db.Model):
    """认证数据模型"""
    __tablename__ = 'auth'
    
    id = db.Column(db.Integer, primary_key=True)
    password_hash = db.Column(db.String(128), nullable=False)

def validate_password_complexity(password):
    """密码复杂度验证"""
    if len(password) < 8:
        raise ValueError("后端提示：密码长度至少8位")
    if not any(c.isupper() for c in password):
        raise ValueError("后端提示：必须包含至少一个大写字母")
    if not any(c.isdigit() for c in password):
        raise ValueError("后端提示：必须包含至少一个数字")

def init_db(app):
    """初始化数据库"""
    try:
        db_path = app.config['BASE_DIR'] / 'db'
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
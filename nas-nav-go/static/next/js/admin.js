// 缓存常用DOM元素
const domCache = {
    managementContent: document.getElementById('managementContent'),
    loginContainer: document.getElementById('loginContainer'),
    serviceList: document.getElementById('serviceList'),
    categorySelect: document.getElementById('categorySelect'),
    loginForm: document.getElementById('loginForm'),
    editForm: document.getElementById('editForm'),
    addCategoryForm: document.getElementById('addCategoryForm')
};

// 通用请求配置
const API_CONFIG = {
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }
};

// 认证管理模块
const authManager = {
    checkAuth: async () => {
        try {
            const res = await fetch(`${API_CONFIG.baseURL}/services`, {
                method: 'HEAD',
                credentials: 'include'
            });

            const { managementContent, loginContainer } = domCache;
            managementContent.style.display = res.ok ? 'block' : 'none';
            loginContainer.style.display = res.ok ? 'none' : 'block';

            if (res.ok) await serviceManager.loadServices();
        } catch (error) {
            console.error('认证检查失败:', error);
            utils.showSnackbar('系统繁忙，请稍后重试');
        }
    },

    handleLogin: async (password) => {
        try {
            const response = await fetch('/admin/login', {
                method: 'POST',
                headers: API_CONFIG.headers,
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                domCache.loginContainer.remove();
                domCache.managementContent.style.display = 'block';
                await serviceManager.loadServices();
            } else {
                utils.showSnackbar('登录失败，请检查密码', 'error');
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            utils.showSnackbar('网络异常，请检查连接');
        }
    }
};

// 服务管理模块
const serviceManager = {
    loadServices: async function () { // 修改处
        try {
            const res = await fetch(`${API_CONFIG.baseURL}/services`);
            const services = await res.json();
            this.renderServices(services.sort((a, b) => a.sort_order - b.sort_order));
            this.initSortable();
        } catch (error) {
            console.error('加载服务失败:', error);
            utils.showSnackbar('服务加载失败，请刷新重试');
        }
    },

    renderServices: async function(services) {
        try {
            // 获取所有分类（包含空分类）
            const categoriesRes = await fetch(`${API_CONFIG.baseURL}/public/categories`);
            const allCategories = await categoriesRes.json();
    
            const categoryTemplate = document.getElementById('categoryItemTemplate').content;
            const serviceTemplate = document.getElementById('serviceItemTemplate').content;
            const fragment = document.createDocumentFragment();
    
            // 按分类ID建立映射
            const categoryMap = allCategories.reduce((acc, c) => {
                acc[c.id] = {
                    ...c,
                    services: services.filter(s => s.category_id === c.id)
                };
                return acc;
            }, {});
    
            // 按分类名称排序
            const sortedCategories = Object.values(categoryMap).sort((a, b) => 
                a.name.localeCompare(b.name)
            );
    
            // 生成分类结构
            sortedCategories.forEach(category => {
                const categoryClone = document.importNode(categoryTemplate, true);
                const categoryHeader = categoryClone.querySelector('.mdui-collapse-item-header');
                const sublist = categoryClone.querySelector('.service-sublist');
    
                // 设置分类名称和数量
                categoryClone.querySelector('.category-name').textContent = 
                    `${category.name} (${category.services.length})`;
    
                // 生成服务项（即使为空也保留分类）
                category.services.forEach(service => {
                    // ... 原有服务项生成逻辑 ...
                });
    
                // 添加空分类提示
                if (category.services.length === 0) {
                    const emptyItem = document.createElement('li');
                    emptyItem.className = 'mdui-list-item';
                    emptyItem.innerHTML = `
                        <div class="mdui-list-item-content">
                            <div class="mdui-text-color-theme-secondary">暂无服务</div>
                        </div>
                    `;
                    sublist.appendChild(emptyItem);
                }
    
                fragment.appendChild(categoryClone);
            });

            // 更新DOM
            domCache.serviceList.innerHTML = '';
            domCache.serviceList.appendChild(fragment);

        } catch (error) {
            console.error('渲染失败:', error);
            utils.showSnackbar('数据加载异常');
        }

        // 初始化MDUI折叠组件
        new mdui.Collapse(domCache.serviceList, {
            accordion: false
        });
    },

    handleAddSubmit: async () => {
        const formData = {
            name: document.querySelector('#addServiceDialog [name="name"]').value.trim(),
            ip_url: document.querySelector('#addServiceDialog [name="ip_url"]').value.trim(),
            domain_url: document.querySelector('#addServiceDialog [name="domain_url"]').value.trim(),
            category_id: parseInt(document.getElementById('categorySelect').value),
            description: document.querySelector('#addServiceDialog [name="description"]').value.trim()
        };

        // 基础验证
        if (!formData.name || !formData.domain_url || !formData.category_id) {
            return utils.showSnackbar('请填写必填字段', 'warning');
        }

        try {
            const response = await fetch(`${API_CONFIG.baseURL}/services`, {
                method: 'POST',
                headers: API_CONFIG.headers,
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                utils.showSnackbar('服务添加成功');
                await this.loadServices(); // 刷新服务列表
            } else {
                throw new Error(result.error || '添加服务失败');
            }
        } catch (error) {
            console.error('添加服务失败:', error);
            utils.showSnackbar(
                error.message.includes('已存在') ? '服务名称已存在' : error.message,
                'error'
            );
        }
    },

    prepareEditModal: (service) => {
        const fields = ['id', 'name', 'category', 'ipUrl', 'domainUrl'];
        fields.forEach(field => {
            document.getElementById(`edit${field.charAt(0).toUpperCase() + field.slice(1)}`).value = service[field];
        });

        const modal = new mdb.Modal(document.getElementById('editModal'));
        modal.show();
    },

    deleteService: async (id) => {
        if (!confirm('确定要删除这个服务吗？')) return;

        try {
            const response = await fetch(`${API_CONFIG.baseURL}/services/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                document.querySelector(`[data-id="${id}"]`).remove();
                utils.showSnackbar('删除成功');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            utils.showSnackbar(error.message.includes('关联') ?
                '请先删除关联数据' : error.message, 'error');
        }
    },

    initSortable: function () {
        new Sortable(domCache.serviceList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.mdui-list-item', // 仅允许拖拽列表项
            group: 'nested',
            onEnd: async (evt) => {
                const services = [...evt.from.querySelectorAll('[data-id]')]
                    .map(li => parseInt(li.dataset.id));

                await fetch(`${API_CONFIG.baseURL}/services/reorder`, {
                    method: 'POST',
                    headers: API_CONFIG.headers,
                    body: JSON.stringify(services)
                });

                serviceManager.loadServices();
            }
        });
    }
};

// 分类管理模块
const categoryManager = {
    loadCategories: async () => {
        try {
            // 先清空选项（包括动态添加的）
            while (domCache.categorySelect.options.length > 1) {
                domCache.categorySelect.remove(1);
            }
            
            const res = await fetch(`${API_CONFIG.baseURL}/public/categories`);
            const categories = await res.json();

            // 添加新选项
            categories.forEach(c => {
                const option = new Option(c.name, c.id);
                domCache.categorySelect.add(option);
            });

            // 强制刷新MDUI组件
            new mdui.Select('#categorySelect', {
                autoInit: true,
                position: 'bottom'
            });
        } catch (error) {
            console.error('加载分类失败:', error);
            utils.showSnackbar('分类加载失败');
        }
    },

    handleCategorySubmit: async () => {
        const categoryName = document.querySelector('#addCategoryForm [name="categoryName"]').value.trim();
        if (!categoryName) return utils.showSnackbar('分类名称不能为空', 'warning');

        try {
            const response = await fetch(`${API_CONFIG.baseURL}/categories`, {
                method: 'POST',
                headers: API_CONFIG.headers,
                body: JSON.stringify({ name: categoryName })
            });

            const result = await response.json();

            if (response.ok) {
                utils.showSnackbar('分类添加成功');
                await categoryManager.loadCategories();  // 刷新分类列表
                await serviceManager.loadServices();     // 刷新服务列表
            } else {
                throw new Error(result.error || '添加失败');
            }
        } catch (error) {
            console.error('添加分类失败:', error);
            utils.showSnackbar(error.message.includes('已存在') ?
                '分类名称已存在' : error.message, 'error');
        }
    }
};

// 工具函数
const utils = {
    showSnackbar: (message, type = 'success') => {
        const snackbar = new mdui.snackbar({
            message: message,
            position: 'bottom',
            buttonText: '关闭',
            timeout: 3000
        });
        snackbar.open();
    },

    secureFetch: async (url, options = {}) => {
        try {
            const [salt, iv] = [
                crypto.getRandomValues(new Uint8Array(16)),
                crypto.getRandomValues(new Uint8Array(12))
            ];

            const keyMaterial = await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(sessionStorage.tempKey),
                { name: "AES-GCM" },
                false,
                ["encrypt"]
            );

            const encrypted = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                keyMaterial,
                new TextEncoder().encode(JSON.stringify(options.body || {}))
            );

            return fetch(url, {
                ...options,
                headers: {
                    'X-Encrypted': 'AES256-GCM',
                    'X-Salt': btoa(String.fromCharCode(...salt)),
                    'X-IV': btoa(String.fromCharCode(...iv)),
                    ...options.headers
                },
                body: encrypted
            });
        } catch (error) {
            console.error('安全请求失败:', error);
            throw new Error('安全通信失败');
        }
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 事件委托
    domCache.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authManager.handleLogin(document.getElementById('password').value);
    });

    domCache.editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await serviceManager.handleEditSubmit(new FormData(e.target));
    });

    document.getElementById('submitServiceBtn').addEventListener('click', async () => {
        await serviceManager.handleAddSubmit();
    });

    document.getElementById('submitCategoryBtn').addEventListener('click', async () => {
        await categoryManager.handleCategorySubmit();
    });

    // 初始化组件
    new mdui.Fab('#addFab', {
        trigger: 'hover',
        menuDelay: 100,
        hysteresis: 8
    });

    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        new mdui.Dialog('#addCategoryDialog').open();
    });

    document.getElementById('addServiceBtn').addEventListener('click', async () => {
        // 先加载最新分类数据
        await categoryManager.loadCategories(); 
        // 然后打开对话框
        new mdui.Dialog('#addServiceDialog').open();
    });

    // 加载数据
    await authManager.checkAuth();
    await categoryManager.loadCategories();
    await serviceManager.loadServices();
});

// 保持原有全局函数兼容性
window.deleteService = serviceManager.deleteService;
window.validatePasswordComplexity = (password) => {
    const errors = [];
    if (password.length < 8) errors.push("密码长度至少8位");
    if (!/[A-Z]/.test(password)) errors.push("必须包含至少一个大写字母");
    if (!/[0-9]/.test(password)) errors.push("必须包含至少一个数字");
    if (errors.length) throw new Error(errors.join("\n"));
};
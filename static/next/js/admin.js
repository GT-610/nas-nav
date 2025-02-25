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
    loadServices: async () => {
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

    renderServices: (services) => {
        const categoryTemplate = document.getElementById('categoryItemTemplate').content;
        const serviceTemplate = document.getElementById('serviceItemTemplate').content;
        const fragment = document.createDocumentFragment();

        // 按分类分组服务
        const categorized = services.reduce((acc, service) => {
            const key = service.category_id || '未分类';
            if (!acc[key]) {
                acc[key] = {
                    categoryId: service.category_id,
                    categoryName: service.category,
                    services: []
                };
            }
            acc[key].services.push(service);
            return acc;
        }, {});

        // 渲染分类及子服务
        Object.values(categorized).forEach(category => {
            const categoryClone = categoryTemplate.cloneNode(true);
            
            // 设置分类信息
            categoryClone.querySelector('.category-name').textContent = category.categoryName;
            const sublist = categoryClone.querySelector('.service-sublist');

            // 渲染服务项
            category.services.forEach(service => {
                const serviceClone = serviceTemplate.cloneNode(true);
                serviceClone.querySelector('[data-id]').dataset.id = service.id;
                serviceClone.querySelector('.service-name').textContent = service.name;
                serviceClone.querySelector('.service-description').textContent = service.description;
                serviceClone.querySelector('.delete-btn').onclick = () => serviceManager.deleteService(service.id);
                serviceClone.querySelector('.edit-btn').onclick = () => this.prepareEditModal(service);
                sublist.appendChild(serviceClone);
            });

            fragment.appendChild(categoryClone);
        });

        domCache.serviceList.innerHTML = '';
        domCache.serviceList.appendChild(fragment);
        
        // 初始化折叠组件
        new mdui.Collapse(domCache.serviceList, {
            accordion: true // 手风琴模式
        });
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

    initSortable: () => {
        new Sortable(domCache.serviceList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.mdui-list-item', // 仅允许拖拽列表项
            group: 'nested',
            onEnd: async (evt) => {
                // 需要调整排序逻辑以适应嵌套结构
                const services = [...evt.from.querySelectorAll('[data-id]')]
                    .map(li => parseInt(li.dataset.id));
                
                await fetch(`${API_CONFIG.baseURL}/services/reorder`, {
                    method: 'POST',
                    headers: API_CONFIG.headers,
                    body: JSON.stringify(services)
                });
                
                this.loadServices();
            }
        });
    }
};

// 分类管理模块
const categoryManager = {
    loadCategories: async () => {
        try {
            const res = await fetch(`${API_CONFIG.baseURL}/public/categories`);
            const categories = await res.json();

            domCache.categorySelect.innerHTML = `
                <option value="" disabled selected>选择分类</option>
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            `;
        } catch (error) {
            console.error('加载分类失败:', error);
            utils.showSnackbar('分类加载失败');
        }
    },

    handleCategorySubmit: async (formData) => {
        const categoryName = formData.get('categoryName').trim();
        if (!categoryName) return utils.showSnackbar('分类名称不能为空', 'warning');

        try {
            const response = await fetch(`${API_CONFIG.baseURL}/categories`, {
                method: 'POST',
                headers: API_CONFIG.headers,
                body: JSON.stringify({ name: categoryName })
            });

            if (response.ok) {
                utils.showSnackbar('分类添加成功');
                new mdui.Dialog('#addCategoryDialog').close();
                setTimeout(serviceManager.loadServices, 1000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '添加失败');
            }
        } catch (error) {
            console.error('添加分类失败:', error);
            utils.showSnackbar(error.message, 'error');
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

    domCache.addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await categoryManager.handleCategorySubmit(new FormData(e.target));
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

    document.getElementById('addServiceBtn').addEventListener('click', () => {
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
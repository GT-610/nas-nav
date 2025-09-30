// DOM 元素缓存
const domCache = {
    managementContent: document.getElementById('managementContent'),
    loginContainer: document.getElementById('loginContainer'),
    serviceList: document.getElementById('serviceList'),
    loginForm: document.getElementById('loginForm'),
    backToHome: document.getElementById('backToHome'),
    // 添加对话框相关元素
    editServiceDialog: document.getElementById('editServiceDialog'),
    addServiceDialog: document.getElementById('addServiceDialog'),
    addCategoryDialog: document.getElementById('addCategoryDialog'),
    confirmDeleteDialog: document.getElementById('confirmDeleteDialog'),
    // 表单元素
    editServiceForm: document.getElementById('editServiceForm'),
    addCategoryForm: document.getElementById('addCategoryForm'),
    addNewServiceForm: document.getElementById('addNewServiceForm'),
    // 按钮元素
    addServiceBtn: document.getElementById('addServiceBtn'),
    addCategoryBtn: document.getElementById('addCategoryBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    // 选择框
    editCategorySelect: document.getElementById('editCategorySelect'),
    newCategorySelect: document.getElementById('newCategorySelect')
};

// 通用请求配置
const API_CONFIG = {
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }
};

// 当前选中的服务ID（用于删除确认）
let selectedServiceId = null;

// 认证管理模块
const authManager = {
    checkAuth: async () => {
        try {
            const res = await fetch(`${API_CONFIG.baseURL}/services`, {
                method: 'HEAD',
                credentials: 'include'
            });

            domCache.managementContent.style.display = res.ok ? 'block' : 'none';
            domCache.loginContainer.style.display = res.ok ? 'none' : 'block';

            if (res.ok) {
                await Promise.all([
                    serviceManager.loadServices(),
                    categoryManager.loadCategoriesForSelect('edit'),
                    categoryManager.loadCategoriesForSelect('new')
                ]);
            }
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
                domCache.loginContainer.style.display = 'none';
                domCache.managementContent.style.display = 'block';
                await Promise.all([
                    serviceManager.loadServices(),
                    categoryManager.loadCategoriesForSelect('edit'),
                    categoryManager.loadCategoriesForSelect('new')
                ]);
                utils.showSnackbar('登录成功');
            } else {
                utils.showSnackbar('登录失败，请检查密码', 'error');
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            utils.showSnackbar('网络异常，请检查连接');
        }
    },

    handleLogout: async () => {
        try {
            await fetch('/admin/logout', {
                method: 'POST',
                headers: API_CONFIG.headers
            });
            // 重定向到主页
            window.location.href = '/';
        } catch (error) {
            console.error('登出失败:', error);
            // 即使登出请求失败，也重定向到主页
            window.location.href = '/';
        }
    }
};

// 服务管理模块
const serviceManager = {
    loadServices: async function () {
        try {
            const res = await fetch(`${API_CONFIG.baseURL}/services`);
            const services = await res.json();
            this.renderServices(services.sort((a, b) => a.sort_order - b.sort_order));
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
                const sublist = categoryClone.querySelector('.service-sublist');

                // 设置分类名称和数量
                categoryClone.querySelector('.category-name').textContent = 
                    `${category.name} (${category.services.length})`;

                // 生成服务项
                category.services.forEach(service => {
                    const serviceClone = document.importNode(serviceTemplate, true);
                    const serviceItem = serviceClone.querySelector('.mdui-list-item');
                    
                    // 设置服务项数据属性
                    serviceItem.setAttribute('data-id', service.id);
                    serviceItem.setAttribute('data-sort-order', service.sort_order);
                    
                    // 设置服务名称和描述
                    serviceClone.querySelector('.service-name').textContent = service.name;
                    serviceClone.querySelector('.service-description').textContent = service.description || '无描述';
                    
                    // 添加编辑和删除按钮事件
                    serviceClone.querySelector('.edit-btn').addEventListener('click', () => {
                        this.prepareEditModal(service);
                    });
                    
                    serviceClone.querySelector('.delete-btn').addEventListener('click', () => {
                        this.prepareDeleteConfirm(service.id);
                    });
                    
                    sublist.appendChild(serviceClone);
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

    prepareEditModal: async (service) => {
        // 填充表单数据
        document.getElementById('editServiceId').value = service.id;
        document.getElementById('editServiceName').value = service.name;
        document.getElementById('editServiceIp').value = service.ip_url;
        document.getElementById('editServiceDomain').value = service.domain_url;
        document.getElementById('editServiceDescription').value = service.description || '';
        
        // 加载最新分类并设置选中项
        await categoryManager.loadCategoriesForSelect('edit');
        domCache.editCategorySelect.value = service.category_id;
        mdui.updateTextFields();
        
        // 打开对话框
        const dialog = new mdui.Dialog(domCache.editServiceDialog);
        dialog.open();
    },

    handleEditSubmit: async (e) => {
        e.preventDefault();
        
        const formData = {
            id: parseInt(document.getElementById('editServiceId').value),
            name: document.getElementById('editServiceName').value.trim(),
            ip_url: document.getElementById('editServiceIp').value.trim(),
            domain_url: document.getElementById('editServiceDomain').value.trim(),
            category_id: parseInt(domCache.editCategorySelect.value),
            description: document.getElementById('editServiceDescription').value.trim()
        };

        // 基础验证
        if (!formData.name || !formData.domain_url || !formData.category_id) {
            return utils.showSnackbar('请填写必填字段', 'warning');
        }

        try {
            const response = await fetch(`${API_CONFIG.baseURL}/services/${formData.id}`, {
                method: 'PUT',
                headers: API_CONFIG.headers,
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                utils.showSnackbar('服务更新成功');
                // 关闭对话框
                const dialog = new mdui.Dialog(domCache.editServiceDialog);
                dialog.close();
                // 刷新服务列表
                await serviceManager.loadServices();
            } else {
                throw new Error(result.error || '更新服务失败');
            }
        } catch (error) {
            console.error('更新服务失败:', error);
            utils.showSnackbar(
                error.message.includes('已存在') ? '服务名称已存在' : error.message,
                'error'
            );
        }
    },

    handleAddSubmit: async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('newServiceName').value.trim(),
            ip_url: document.getElementById('newServiceIp').value.trim(),
            domain_url: document.getElementById('newServiceDomain').value.trim(),
            category_id: parseInt(domCache.newCategorySelect.value),
            description: document.getElementById('newServiceDescription').value.trim()
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
                // 关闭对话框
                const dialog = new mdui.Dialog(domCache.addServiceDialog);
                dialog.close();
                // 重置表单
                domCache.addNewServiceForm.reset();
                // 刷新服务列表
                await serviceManager.loadServices();
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

    prepareDeleteConfirm: (id) => {
        selectedServiceId = id;
        const dialog = new mdui.Dialog(domCache.confirmDeleteDialog);
        dialog.open();
    },

    deleteService: async () => {
        if (!selectedServiceId) return;

        try {
            const response = await fetch(`${API_CONFIG.baseURL}/services/${selectedServiceId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                utils.showSnackbar('删除成功');
                // 关闭对话框
                const dialog = new mdui.Dialog(domCache.confirmDeleteDialog);
                dialog.close();
                // 刷新服务列表
                await serviceManager.loadServices();
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
};

// 分类管理模块
const categoryManager = {
    loadCategoriesForSelect: async (type) => {
        try {
            const selectElement = type === 'edit' ? 
                domCache.editCategorySelect : 
                domCache.newCategorySelect;
            
            // 先清空选项（保留第一个禁用选项）
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            const res = await fetch(`${API_CONFIG.baseURL}/public/categories`);
            const categories = await res.json();

            // 添加新选项
            categories.forEach(c => {
                const option = new Option(c.name, c.id);
                selectElement.add(option);
            });

            // 强制刷新MDUI组件 - 修复ID不匹配问题
            new mdui.Select(type === 'edit' ? '#editCategorySelect' : '#newCategorySelect', {
                autoInit: true,
                position: 'bottom'
            });
        } catch (error) {
            console.error('加载分类失败:', error);
            utils.showSnackbar('分类加载失败');
        }
    },

    handleCategorySubmit: async (e) => {
        e.preventDefault();
        
        const categoryName = document.getElementById('categoryName').value.trim();
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
                // 关闭对话框
                const dialog = new mdui.Dialog(domCache.addCategoryDialog);
                dialog.close();
                // 重置表单
                domCache.addCategoryForm.reset();
                // 刷新分类列表和服务列表
                await Promise.all([
                    categoryManager.loadCategoriesForSelect('edit'),
                    categoryManager.loadCategoriesForSelect('new'),
                    serviceManager.loadServices()
                ]);
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
    }
};

// 初始化事件监听
function initEventListeners() {
    // 登录表单提交
    domCache.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await authManager.handleLogin(document.getElementById('password').value);
        // 清空密码输入框
        document.getElementById('password').value = '';
    });

    // 返回主页并退出登录
    domCache.backToHome.addEventListener('click', async (e) => {
        e.preventDefault();
        await authManager.handleLogout();
    });

    // 编辑服务表单提交
    domCache.editServiceForm.addEventListener('submit', serviceManager.handleEditSubmit);

    // 新增服务表单提交
    domCache.addNewServiceForm.addEventListener('submit', serviceManager.handleAddSubmit);

    // 添加分类表单提交
    domCache.addCategoryForm.addEventListener('submit', categoryManager.handleCategorySubmit);

    // 添加服务按钮点击
    domCache.addServiceBtn.addEventListener('click', async () => {
        // 先加载最新分类数据
        await categoryManager.loadCategoriesForSelect('new');
        // 然后打开对话框
        const dialog = new mdui.Dialog(domCache.addServiceDialog);
        dialog.open();
    });

    // 添加分类按钮点击
    domCache.addCategoryBtn.addEventListener('click', () => {
        const dialog = new mdui.Dialog(domCache.addCategoryDialog);
        dialog.open();
    });

    // 确认删除按钮点击
    domCache.confirmDeleteBtn.addEventListener('click', async () => {
        await serviceManager.deleteService();
    });

    // 初始化浮动按钮
    new mdui.Fab('#addFab', {
        trigger: 'hover',
        menuDelay: 100,
        hysteresis: 8
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化事件监听
    initEventListeners();
    
    // 检查认证状态并加载数据
    await authManager.checkAuth();
});
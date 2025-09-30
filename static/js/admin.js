// 页面元素缓存
const domCache = {
    loginPage: document.getElementById('loginPage'),
    adminPage: document.getElementById('adminPage'),
    loginForm: document.getElementById('loginForm'),
    passwordInput: document.getElementById('passwordInput'),
    logoutBtn: document.getElementById('logoutBtn'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    addServiceBtn: document.getElementById('addServiceBtn'),
    addCategoryBtn: document.getElementById('addCategoryBtn'),
    servicesTable: document.getElementById('servicesTable'),
    categoriesTable: document.getElementById('categoriesTable'),
    serviceDialog: document.getElementById('serviceDialog'),
    categoryDialog: document.getElementById('categoryDialog'),
    passwordDialog: document.getElementById('passwordDialog'),
    serviceForm: document.getElementById('serviceForm'),
    categoryForm: document.getElementById('categoryForm'),
    passwordForm: document.getElementById('passwordForm'),
    saveServiceBtn: document.getElementById('saveServiceBtn'),
    saveCategoryBtn: document.getElementById('saveCategoryBtn'),
    savePasswordBtn: document.getElementById('savePasswordBtn'),
    serviceCategorySelect: document.getElementById('serviceCategorySelect')
};

// 服务和分类数据
let services = [];
let categories = [];

// MDUI组件
let serviceDialogInstance = null;
let categoryDialogInstance = null;
let passwordDialogInstance = null;

// 初始化应用
function initApp() {
    // 初始化MDUI对话框
    serviceDialogInstance = new mdui.Dialog('#serviceDialog');
    categoryDialogInstance = new mdui.Dialog('#categoryDialog');
    passwordDialogInstance = new mdui.Dialog('#passwordDialog');
    
    // MDUI 1.0.2没有Tabs构造函数，标签页功能会自动工作，无需额外初始化
    
    // 检查登录状态
    checkLoginStatus();
    
    // 绑定事件
    bindEvents();
}

// 检查登录状态
function checkLoginStatus() {
    // 不使用localStorage或sessionStorage存储登录状态
    // 而是通过发送请求到服务器来检查session是否有效
    // 使用/api/services作为检查登录状态的API，因为它需要认证才能访问
    fetch('/api/services')
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            // 如果返回401，说明未登录
            return { authenticated: false };
        })
        .then(data => {
            if (data.authenticated) {
                // 已登录，显示管理页面
                domCache.loginPage.style.display = 'none';
                domCache.adminPage.style.display = 'block';
                // 加载数据
                loadAllData();
            } else {
                // 未登录，显示登录页面
                domCache.loginPage.style.display = 'block';
                domCache.adminPage.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('检查登录状态错误:', error);
            // 出错时默认显示登录页面
            domCache.loginPage.style.display = 'block';
            domCache.adminPage.style.display = 'none';
        });
}

// 绑定所有事件
function bindEvents() {
    // 登录表单提交
    domCache.loginForm.addEventListener('submit', handleLogin);
    
    // 退出登录
    domCache.logoutBtn.addEventListener('click', handleLogout);
    
    // 修改密码
    domCache.changePasswordBtn.addEventListener('click', openPasswordDialog);
    
    // 服务管理相关事件
    domCache.addServiceBtn.addEventListener('click', openAddServiceDialog);
    domCache.saveServiceBtn.addEventListener('click', saveService);
    
    // 分类管理相关事件
    domCache.addCategoryBtn.addEventListener('click', openAddCategoryDialog);
    domCache.saveCategoryBtn.addEventListener('click', saveCategory);
    
    // 修改密码相关事件
    domCache.savePasswordBtn.addEventListener('click', savePassword);
}

// 处理登录
function handleLogin(event) {
    event.preventDefault();
    
    const password = domCache.passwordInput.value;
    
    if (!password) {
        showSnackbar('请输入密码', 'error');
        return;
    }
    
    // 发送登录请求 - 注意：后端API路径是/admin/login而不是/api/admin/login
    fetch('/admin/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('登录失败，请检查密码');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showSnackbar('登录成功');
            // 显示管理页面
            domCache.loginPage.style.display = 'none';
            domCache.adminPage.style.display = 'block';
            // 加载数据
            loadAllData();
        } else {
            showSnackbar('登录失败：' + data.message, 'error');
        }
    })
    .catch(error => {
        showSnackbar('登录失败：' + error.message, 'error');
        console.error('登录错误:', error);
    });
}

// 处理退出登录
function handleLogout() {
    // 发送退出登录请求 - 注意：后端API路径是/admin/logout而不是/api/admin/logout
    fetch('/admin/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(() => {
        // 无论成功与否，都跳转到登录页面
        domCache.loginPage.style.display = 'block';
        domCache.adminPage.style.display = 'none';
        domCache.passwordInput.value = '';
        showSnackbar('已退出登录');
    })
    .catch(error => {
        console.error('退出登录错误:', error);
        // 即使出错也跳转到登录页面
        domCache.loginPage.style.display = 'block';
        domCache.adminPage.style.display = 'none';
        domCache.passwordInput.value = '';
    });
}

// 加载所有数据
function loadAllData() {
    Promise.all([
        loadServices(),
        loadCategories()
    ])
    .then(() => {
        // 更新服务分类下拉列表
        updateServiceCategorySelect();
        // 渲染服务和分类表格
        renderServicesTable();
        renderCategoriesTable();
    })
    .catch(error => {
        showSnackbar('数据加载失败：' + error.message, 'error');
        console.error('加载数据错误:', error);
    });
}

// 加载服务数据
function loadServices() {
    return fetch('/api/services')
        .then(response => {
            if (!response.ok) {
                throw new Error('获取服务数据失败');
            }
            return response.json();
        })
        .then(data => {
            services = data;
        });
}

// 加载分类数据
function loadCategories() {
    // 使用公开API获取分类数据，因为管理API中没有GET /api/categories
    return fetch('/api/public/categories')
        .then(response => {
            if (!response.ok) {
                throw new Error('获取分类数据失败');
            }
            return response.json();
        })
        .then(data => {
            categories = data;
        });
}

// 更新服务分类下拉列表
function updateServiceCategorySelect() {
    domCache.serviceCategorySelect.innerHTML = '';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.ID;
        option.textContent = category.Name;
        domCache.serviceCategorySelect.appendChild(option);
    });
}

// 渲染服务表格
function renderServicesTable() {
    const tbody = domCache.servicesTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (services.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="mdui-text-center mdui-p-4">
                    <div class="empty-state">
                        <i class="mdui-icon material-icons empty-state-icon">apps</i>
                        <p>暂无服务数据</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    services.forEach(service => {
        const tr = document.createElement('tr');
        
        // 获取分类名称
        let categoryName = '未知分类';
        const category = categories.find(c => c.ID === service.CategoryID);
        if (category) {
            categoryName = category.Name;
        }
        
        tr.innerHTML = `
            <td>${service.ID}</td>
            <td>${service.Name}</td>
            <td>
                ${service.Icon ? 
                    `<img src="${service.Icon}" width="24" height="24" alt="${service.Name}">` : 
                    `<div class="service-icon-small"><i class="mdui-icon material-icons">apps</i></div>`
                }
            </td>
            <td>${categoryName}</td>
            <td>${service.IPURL || '-'}</td>
            <td>${service.DomainURL}</td>
            <td>${service.Description || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="mdui-btn mdui-btn-icon mdui-ripple" onclick="editService(${service.ID})">
                        <i class="mdui-icon material-icons">edit</i>
                    </button>
                    <button class="mdui-btn mdui-btn-icon mdui-ripple mdui-btn-danger" onclick="deleteService(${service.ID})">
                        <i class="mdui-icon material-icons">delete</i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// 渲染分类表格
function renderCategoriesTable() {
    const tbody = domCache.categoriesTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="mdui-text-center mdui-p-4">
                    <div class="empty-state">
                        <i class="mdui-icon material-icons empty-state-icon">category</i>
                        <p>暂无分类数据</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    categories.forEach(category => {
        // 计算该分类下的服务数量
        const serviceCount = services.filter(s => s.CategoryID === category.ID).length;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${category.ID}</td>
            <td>${category.Name}</td>
            <td>${serviceCount}</td>
            <td>
                <div class="action-buttons">
                    <button class="mdui-btn mdui-btn-icon mdui-ripple" onclick="editCategory(${category.ID})">
                        <i class="mdui-icon material-icons">edit</i>
                    </button>
                    <button class="mdui-btn mdui-btn-icon mdui-ripple mdui-btn-danger" onclick="deleteCategory(${category.ID})">
                        <i class="mdui-icon material-icons">delete</i>
                    </button>
                </div>
            </td>
        `;
        
        // 如果分类下有服务，禁用删除按钮
        if (serviceCount > 0) {
            const deleteBtn = tr.querySelector('button:last-child');
            deleteBtn.disabled = true;
            deleteBtn.classList.add('mdui-disabled');
            deleteBtn.setAttribute('data-tooltip', '分类下有服务，无法删除');
        }
        
        tbody.appendChild(tr);
    });
}

// 打开添加服务对话框
function openAddServiceDialog() {
    // 重置表单
    document.getElementById('serviceIdInput').value = '';
    document.getElementById('serviceNameInput').value = '';
    document.getElementById('serviceIconInput').value = '';
    document.getElementById('serviceIpInput').value = '';
    document.getElementById('serviceDomainInput').value = '';
    document.getElementById('serviceDescriptionInput').value = '';
    document.getElementById('serviceSortInput').value = '999';
    
    // 更新对话框标题
    domCache.serviceDialog.querySelector('.mdui-dialog-title').textContent = '添加服务';
    
    // 打开对话框
    serviceDialogInstance.open();
}

// 编辑服务
function editService(id) {
    const service = services.find(s => s.ID === id);
    if (!service) {
        showSnackbar('未找到该服务', 'error');
        return;
    }
    
    // 填充表单数据
    document.getElementById('serviceIdInput').value = service.ID;
    document.getElementById('serviceNameInput').value = service.Name || '';
    document.getElementById('serviceIconInput').value = service.Icon || '';
    document.getElementById('serviceCategorySelect').value = service.CategoryID;
    document.getElementById('serviceIpInput').value = service.IPURL || '';
    document.getElementById('serviceDomainInput').value = service.DomainURL || '';
    document.getElementById('serviceDescriptionInput').value = service.Description || '';
    document.getElementById('serviceSortInput').value = service.SortOrder || '999';
    
    // 更新对话框标题
    domCache.serviceDialog.querySelector('.mdui-dialog-title').textContent = '编辑服务';
    
    // 打开对话框
    serviceDialogInstance.open();
}

// 保存服务
function saveService() {
    const id = document.getElementById('serviceIdInput').value;
    const name = document.getElementById('serviceNameInput').value.trim();
    const icon = document.getElementById('serviceIconInput').value.trim();
    const categoryId = document.getElementById('serviceCategorySelect').value;
    const ipUrl = document.getElementById('serviceIpInput').value.trim();
    const domainUrl = document.getElementById('serviceDomainInput').value.trim();
    const description = document.getElementById('serviceDescriptionInput').value.trim();
    const sortOrder = document.getElementById('serviceSortInput').value;
    
    // 表单验证
    if (!name) {
        showSnackbar('请输入服务名称', 'error');
        return;
    }
    
    if (!domainUrl) {
        showSnackbar('请输入域名地址', 'error');
        return;
    }
    
    if (!categoryId) {
        showSnackbar('请选择所属分类', 'error');
        return;
    }
    
    // 构造服务数据
    const serviceData = {
        Name: name,
        Icon: icon,
        CategoryID: parseInt(categoryId),
        IPURL: ipUrl,
        DomainURL: domainUrl,
        Description: description,
        SortOrder: parseInt(sortOrder) || 999
    };
    
    let url = '/api/services';
    let method = 'POST';
    
    // 如果是编辑模式，修改URL和方法
    if (id) {
        url += `/${id}`;
        method = 'PUT';
    }
    
    // 发送请求
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(serviceData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('保存服务失败');
        }
        return response.json();
    })
    .then(() => {
        // 关闭对话框
        serviceDialogInstance.close();
        
        // 重新加载数据
        loadServices().then(() => {
            renderServicesTable();
            showSnackbar(id ? '服务更新成功' : '服务添加成功');
        });
    })
    .catch(error => {
        showSnackbar('保存服务失败：' + error.message, 'error');
        console.error('保存服务错误:', error);
    });
}

// 删除服务
function deleteService(id) {
    mdui.confirm('确定要删除该服务吗？', '确认删除', {
        confirmText: '删除',
        cancelText: '取消',
        confirmOnEnter: true,
        onConfirm: function() {
            // 发送删除请求
            fetch(`/api/services/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('删除服务失败');
                }
                return response.json();
            })
            .then(() => {
                // 重新加载数据
                loadServices().then(() => {
                    renderServicesTable();
                    showSnackbar('服务删除成功');
                });
            })
            .catch(error => {
                showSnackbar('删除服务失败：' + error.message, 'error');
                console.error('删除服务错误:', error);
            });
        }
    });
}

// 打开添加分类对话框
function openAddCategoryDialog() {
    // 重置表单
    document.getElementById('categoryIdInput').value = '';
    document.getElementById('categoryNameInput').value = '';
    
    // 更新对话框标题
    domCache.categoryDialog.querySelector('.mdui-dialog-title').textContent = '添加分类';
    
    // 打开对话框
    categoryDialogInstance.open();
}

// 编辑分类
function editCategory(id) {
    const category = categories.find(c => c.ID === id);
    if (!category) {
        showSnackbar('未找到该分类', 'error');
        return;
    }
    
    // 填充表单数据
    document.getElementById('categoryIdInput').value = category.ID;
    document.getElementById('categoryNameInput').value = category.Name;
    
    // 更新对话框标题
    domCache.categoryDialog.querySelector('.mdui-dialog-title').textContent = '编辑分类';
    
    // 打开对话框
    categoryDialogInstance.open();
}

// 保存分类
function saveCategory() {
    const id = document.getElementById('categoryIdInput').value;
    const name = document.getElementById('categoryNameInput').value.trim();
    
    // 表单验证
    if (!name) {
        showSnackbar('请输入分类名称', 'error');
        return;
    }
    
    // 构造分类数据
    const categoryData = {
        Name: name
    };
    
    let url = '/api/categories';
    let method = 'POST';
    
    // 如果是编辑模式，修改URL和方法
    if (id) {
        url += `/${id}`;
        method = 'PUT';
    }
    
    // 发送请求
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('保存分类失败');
        }
        return response.json();
    })
    .then(() => {
        // 关闭对话框
        categoryDialogInstance.close();
        
        // 重新加载数据
        Promise.all([
            loadCategories(),
            loadServices()
        ]).then(() => {
            updateServiceCategorySelect();
            renderCategoriesTable();
            renderServicesTable();
            showSnackbar(id ? '分类更新成功' : '分类添加成功');
        });
    })
    .catch(error => {
        showSnackbar('保存分类失败：' + error.message, 'error');
        console.error('保存分类错误:', error);
    });
}

// 删除分类
function deleteCategory(id) {
    // 检查分类下是否有服务
    const serviceCount = services.filter(s => s.CategoryID === id).length;
    if (serviceCount > 0) {
        showSnackbar('分类下有服务，无法删除', 'error');
        return;
    }
    
    mdui.confirm('确定要删除该分类吗？', '确认删除', {
        confirmText: '删除',
        cancelText: '取消',
        confirmOnEnter: true,
        onConfirm: function() {
            // 发送删除请求
            fetch(`/api/categories/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('删除分类失败');
                }
                return response.json();
            })
            .then(() => {
                // 重新加载数据
                Promise.all([
                    loadCategories(),
                    loadServices()
                ]).then(() => {
                    updateServiceCategorySelect();
                    renderCategoriesTable();
                    renderServicesTable();
                    showSnackbar('分类删除成功');
                });
            })
            .catch(error => {
                showSnackbar('删除分类失败：' + error.message, 'error');
                console.error('删除分类错误:', error);
            });
        }
    });
}

// 打开修改密码对话框
function openPasswordDialog() {
    // 重置表单
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
    
    // 打开对话框
    passwordDialogInstance.open();
}

// 保存密码
function savePassword() {
    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    
    // 表单验证
    if (!currentPassword) {
        showSnackbar('请输入当前密码', 'error');
        return;
    }
    
    if (!newPassword) {
        showSnackbar('请输入新密码', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showSnackbar('两次输入的新密码不一致', 'error');
        return;
    }
    
    // 发送请求 - 注意：后端API路径是/admin/change-password而不是/api/admin/change-password
    fetch('/admin/change-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            oldPassword: currentPassword,
            newPassword: newPassword
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('修改密码失败');
        }
        return response.json();
    })
    .then(() => {
        // 关闭对话框
        passwordDialogInstance.close();
        
        // 显示成功消息
        showSnackbar('密码修改成功');
        
        // 为了安全，修改密码后自动退出登录
        setTimeout(() => {
            handleLogout();
        }, 2000);
    })
    .catch(error => {
        showSnackbar('修改密码失败：' + error.message, 'error');
        console.error('修改密码错误:', error);
    });
}

// 关闭服务对话框
function closeServiceDialog() {
    serviceDialogInstance.close();
}

// 关闭分类对话框
function closeCategoryDialog() {
    categoryDialogInstance.close();
}

// 关闭密码对话框
function closePasswordDialog() {
    passwordDialogInstance.close();
}

// 显示提示消息
function showSnackbar(message, type = 'success') {
    // 设置不同类型的背景色
    const backgroundColor = type === 'error' ? '#f44336' : '#4caf50';
    
    return new mdui.snackbar({
        message: message,
        position: 'bottom',
        timeout: 3000,
        closeOnOutsideClick: true,
        selector: '#snackbar',
        backgroundColor: backgroundColor
    }).open();
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);

// 添加全局错误处理
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
});

// 添加全局未捕获的Promise错误处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('未捕获的Promise错误:', event.reason);
});
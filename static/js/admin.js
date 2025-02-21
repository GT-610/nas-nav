// 检查当前认证状态
const checkAuth = async () => {
    try {
        // 改用更可靠的服务列表端点检测 
        const res = await fetch('/api/services', {
            method: 'HEAD',
            credentials: 'include'
        });
        document.getElementById('managementContent').style.display = res.ok ? 'block' : 'none';
        document.getElementById('loginContainer').style.display = res.ok ? 'none' : 'block';
        await loadServices();
    } catch (error) {
        console.error(' 认证检查失败:', error);
    }
};

// 登录表单提交
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;

    const response = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });

    if (response.ok) {
        document.getElementById('loginContainer').remove(); // 移除登录表单
        document.getElementById('managementContent').style.display = 'block'; // 显示管理内容
        await loadServices(); // 登录后刷新列表 
    } else {
        alert('登录失败，请检查密码');
    }
});

// 安全通信 
async function secureFetch(url, options = {}) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 使用Web Crypto API加密 
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(sessionStorage.getItem('tempKey')),
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        keyMaterial,
        encoder.encode(JSON.stringify(options.body || {}))
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
}


document.addEventListener('DOMContentLoaded', async () => {
    // 添加页面关闭时的登出请求
    window.addEventListener('beforeunload', async () => {
        try {
            await fetch('/admin/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.log('自动登出成功');
        }
    });

    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/admin/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                window.location.href = '/';
            } catch (error) {
                console.error('登出失败:', error);
                window.location.href = '/';
            }
        });
    });


    await checkAuth();
    // 加载服务列表 
    const loadServices = async () => {
        const res = await fetch('/api/services');
        const services = await res.json();
        const list = document.getElementById('serviceList');

        // 按 sort_order 排序
        services.sort((a, b) => a.sort_order - b.sort_order);

        // 使用模板渲染服务项
        const template = document.getElementById('serviceItemTemplate').content;
        list.innerHTML = ''; // 清空列表
        services.forEach(service => {
            const clone = template.cloneNode(true);
            clone.querySelector('[data-id]').setAttribute('data-id', service.id);
            clone.querySelector('.badge').textContent = `#${service.id}`;
            clone.querySelector('.service-name').textContent = service.name;
            clone.querySelector('.service-category').textContent = service.category;
            clone.querySelector('.delete-btn').setAttribute('onclick', `deleteService(${service.id})`);

            // 绑定编辑按钮点击事件
            const editBtn = clone.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    // 填充当前服务数据到模态框
                    document.getElementById('editId').value = service.id;
                    document.getElementById('editName').value = service.name;
                    document.getElementById('editCategory').value = service.category;
                    document.getElementById('editIpUrl').value = service.ip_url;
                    document.getElementById('editDomainUrl').value = service.domain_url;

                    // 打开模态框
                    var editModal = new mdb.Modal(document.getElementById('editModal'));
                    editModal.show();

                    // 提交数据
                    // document.getElementById('editForm').querySelector('.btn-primary').addEventListener('click', async () => {
                    // });

                    // 关闭模态框
                    document.getElementById('editForm').querySelector('.btn-secondary').addEventListener('click', () => {
                        editModal.hide();
                    });
                });
            }



            list.appendChild(clone);
        });

        // 初始化拖拽排序 
        new Sortable(list, {
            animation: 150,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: async (evt) => {
                const newOrder = [...list.children].map(li => parseInt(li.dataset.id));
                await fetch('/api/services/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newOrder)
                });
                loadServices(); // 刷新排序编号 
            }
        });
    };

    // 添加服务 
    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        const res = await fetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            e.target.reset();
            await loadServices();
        } else {
            alert('添加失败，服务名称可能已存在');
        }
    });

    // 编辑表单提交处理
    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const editData = {
            id: document.getElementById('editId').value,
            name: document.getElementById('editName').value,
            category: document.getElementById('editCategory').value,
            ip_url: document.getElementById('editIpUrl').value,
            domain_url: document.getElementById('editDomainUrl').value
        };

        const response = await fetch(`/api/services/${editData.id}`, { // 匹配 app.py 的路由格式
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editData.name,
                category: editData.category,
                ip_url: editData.ip_url,
                domain_url: editData.domain_url,
            })
        });

        if (response.ok) {
            // 关闭模态框并刷新列表
            mdb.Modal.getInstance(document.getElementById('editModal')).hide();
            // 成功提示逻辑
            const alertEl = document.getElementById('successAlert');
            alertEl.style.display = 'block';
            alertEl.classList.add('show');

            // 3秒后自动隐藏
            setTimeout(() => {
                alertEl.classList.remove('show');
                setTimeout(() => alertEl.style.display = 'none', 150);
            }, 3000);

            await loadServices();
        } else {
            // 失败提示逻辑
            const alertEl = document.getElementById('failAlert');
            alertEl.style.display = 'block';
            alertEl.classList.add('show');

            // 3秒后自动隐藏
            setTimeout(() => {
                alertEl.classList.remove('show');
                setTimeout(() => alertEl.style.display = 'none', 150);
            }, 3000);
        }
    });

    // 初始化加载 
    await loadServices();
});

// 删除服务函数 
window.deleteService = async (id) => {
    if (confirm('确定要删除这个服务吗？')) {
        try {
            const response = await fetch(`/api/services/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '删除失败');
            }

            document.querySelector(`[data-id="${id}"]`).remove();
        } catch (error) {
            console.error('删除失败:', error);
            alert(error.message); // 显示后端返回的具体错误信息
            if (error.message.includes('关联')) {
                alert('温馨提示：请先删除与该服务关联的其他数据');
            }
        }
    }
};

// 前端密码验证
function validatePasswordComplexity(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push("密码长度至少8位");
    }
    if (!/[A-Z]/.test(password)) {
        errors.push("必须包含至少一个大写字母");
    }
    if (!/[0-9]/.test(password)) {
        errors.push("必须包含至少一个数字");
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
}

// 打开修改密码模态框
document.getElementById('changePasswordBtn').addEventListener('click', () => {
    var changePasswordModal = new mdb.Modal(document.getElementById('changePasswordModal'));
    changePasswordModal.show();
});

// 修改密码表单提交处理
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    // 验证新密码复杂度
    try {
        validatePasswordComplexity(newPassword);
    } catch (error) {
        alert(error.message);
        return;
    }

    // 验证新密码和确认新密码是否一致
    if (newPassword !== confirmNewPassword) {
        alert('新密码和确认新密码不一致');
        return;
    }

    // 发送请求到后端进行密码修改
    const response = await fetch('/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
    });

    if (response.ok) {
        alert('密码修改成功');
        mdb.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
    } else {
        const data = await response.json();
        alert(data.error || '密码修改失败');
    }
});

// 确保“取消”按钮关闭模态框
document.getElementById('changePasswordForm').querySelector('.btn-danger').addEventListener('click', () => {
    mdb.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
});
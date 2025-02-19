// 检查当前认证状态
const checkAuth = async () => {
    try {
        const res = await fetch('/api/services/reorder', { 
            method: 'HEAD',
            credentials: 'include' // 确保携带cookie
        });
        if (!res.ok) {
            document.getElementById('managementContent').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
        } else {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('managementContent').style.display = 'block';
        }
    } catch (error) {
        console.error('认证检查失败:', error);
    }
};

// 登录表单提交
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    
    const response = await fetch('/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ password })
    });

    if (response.ok) {
        document.getElementById('loginForm').remove(); // 移除登录表单
        document.getElementById('managementContent').style.display = 'block'; // 显示管理内容
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

    // 表单提交处理 
    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        const res = await fetch('/api/services/add', {
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

        const response = await fetch('/api/services/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editData)
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
        await fetch(`/api/services/delete/${id}`, { method: 'DELETE' });
        document.querySelector(`[data-id="${id}"]`).remove();
    }
};
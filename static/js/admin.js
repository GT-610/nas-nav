// 安全通信 
async function secureFetch(url, options = {}) {
    const salt = crypto.getRandomValues(new  Uint8Array(16));
    const iv = crypto.getRandomValues(new  Uint8Array(12));
    
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
        encoder.encode(JSON.stringify(options.body  || {}))
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


document.addEventListener('DOMContentLoaded',  async () => {
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
            clone.querySelector('.badge').textContent = `#${service.sort_order}`;
            clone.querySelector('.service-name').textContent = service.name;
            clone.querySelector('.service-category').textContent = service.category;
            clone.querySelector('.delete-btn').setAttribute('onclick', `deleteService(${service.id})`);
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
                const newOrder = [...list.children].map(li  => parseInt(li.dataset.id)); 
                await fetch('/api/services/reorder', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(newOrder) 
                });
                loadServices(); // 刷新排序编号 
            }
        });
    };
 
    // 表单提交处理 
    document.getElementById('addForm').addEventListener('submit',  async (e) => {
        e.preventDefault(); 
        const formData = new FormData(e.target); 
        const data = Object.fromEntries(formData.entries()); 
        
        const res = await fetch('/api/services/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data) 
        });
        
        if(res.ok)  {
            e.target.reset(); 
            await loadServices();
        } else {
            alert('添加失败，服务名称可能已存在');
        }
    });
 
    // 初始化加载 
    await loadServices();
    document.querySelector('.admin-container').style.display  = 'block';
});
 
// 删除服务函数 
window.deleteService  = async (id) => {
    if(confirm('确定要删除这个服务吗？')) {
        await fetch(`/api/services/delete/${id}`, {method: 'DELETE'});
        document.querySelector(`[data-id="${id}"]`).remove(); 
    }
};
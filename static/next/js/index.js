// 数据加载
async function loadServices() {
    try {
        const response = await fetch('/api/public/services');
        if (!response.ok) throw new Error(`HTTP错误! 状态码: ${response.status}`);
        const services = await response.json();
        renderCards(services);
        initFilters(services);  // 动态生成分类过滤 
    } catch (error) {
        handleLoadingError(error);
    }
}

// 服务状态检测 
async function checkServiceStatus() {
    document.querySelectorAll('.nav-card').forEach(async  card => {
        const ipUrl = card.querySelector('.btn-ip').href; 
        try {
            await fetch(ipUrl, { mode: 'no-cors' });
            card.classList.remove('offline'); 
        } catch {
            card.classList.add('offline'); 
        }
    });
}

// 卡片渲染函数 
function renderCards(services) {
    const container = document.getElementById('cardContainer');
    const template = document.getElementById('cardTemplate');
    
    container.innerHTML = ''; // 清空容器
    
    services.forEach(service => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.mdui-col-xs-12');
        
        // 设置数据属性
        card.dataset.category = service.category.toLowerCase();
        card.dataset.search = `${service.name.toLowerCase()} ${service.description?.toLowerCase() || ''}`;

        // 填充内容
        const iconContainer = clone.querySelector('.mdui-card-media');
        const iconImg = clone.querySelector('.card-icon');
        if (service.icon_url) {
            iconImg.src = service.icon_url;
            iconImg.alt = service.name;
        } else {
            iconContainer.remove(); // 无图标时移除整个图片区域
        }

        clone.querySelector('.card-title').textContent = service.name;
        clone.querySelector('.card-category').textContent = service.category;

        const descriptionEl = clone.querySelector('.card-description');
        if (service.description) {
            descriptionEl.textContent = service.description;
        } else {
            descriptionEl.parentElement.remove(); // 无描述时移除内容区域
        }

        // 设置按钮链接
        clone.querySelector('.domain-btn').href = service.domain_url;
        clone.querySelector('.ip-btn').href = service.ip_url;

        container.appendChild(clone);
    });

    checkServiceStatus();
}

/* 在loadServices开始时添加加载状态
async function loadServices() {
    const container = document.getElementById('cardContainer');
    container.innerHTML = '<div class="loading-shimmer mdui-col-xs-12">加载中...</div>'.repeat(6);
    
    try {
        // ...原有逻辑...
    } catch (error) {
        // ...错误处理...
    }
}*/

// 动态生成分类过滤 
function initFilters(services) {
    // 初始化标签页
    const tab = new mdui.Tab('#categoryTab');
    
    // 标签页切换事件
    document.getElementById('categoryTab').addEventListener('changed.mdui.tab', function() {
        const activeTab = this.querySelector('.mdui-tab-active');
        const category = activeTab.textContent.trim().toLowerCase();
        
        document.querySelectorAll('#cardContainer > .mdui-col').forEach(card => {
            const show = category === '全部' || card.dataset.category === category;
            card.style.display = show ? 'block' : 'none';
        });
    });
}

// 错误处理 
function handleLoadingError(error) {
    console.error('Error:', error);
    const container = document.getElementById('cardContainer');
    container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h5 class="text-danger">⚠️ 数据加载失败</h5>
                    <p class="text-muted">${error.message}</p> 
                    <button class="btn btn-secondary mt-3" onclick="location.reload()"> 重新加载</button>
                </div>
            `;
}

// 事件绑定 
function bindFilterEvents() {
    // MDUI 搜索输入
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#cardContainer > .mdui-col').forEach(card => {
            const match = card.dataset.search.includes(term);
            card.style.display = match ? 'block' : 'none';
        });
    });
}

// 初始化加载 
document.addEventListener('DOMContentLoaded', loadServices);
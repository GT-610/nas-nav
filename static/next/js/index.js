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
    container.innerHTML = services.map(service => `
        <div class="mdui-col-xs-12 mdui-col-sm-6 mdui-col-md-4 mdui-m-b-2"
             data-category="${service.category.toLowerCase()}" 
             data-search="${service.name.toLowerCase()} ${service.description?.toLowerCase() || ''}">
            <div class="mdui-card mdui-hoverable">
                ${service.icon_url ? `
                <div class="mdui-card-media">
                    <img src="${service.icon_url}" alt="${service.name}"/>
                </div>` : ''}
                <div class="mdui-card-primary">
                    <div class="mdui-card-primary-title">${service.name}</div>
                    <div class="mdui-card-primary-subtitle">${service.category}</div>
                </div>
                <div class="mdui-card-content">
                    ${service.description ? `<p class="mdui-typo">${service.description}</p>` : ''}
                </div>
                <div class="mdui-card-actions">
                    <a href="${service.domain_url}" 
                       class="mdui-btn mdui-ripple mdui-color-theme"
                       target="_blank">
                        <i class="mdui-icon material-icons">public</i>域名访问
                    </a>
                    <a href="${service.ip_url}" 
                       class="mdui-btn mdui-ripple mdui-color-theme-accent btn-ip"
                       target="_blank">
                        <i class="mdui-icon material-icons">lan</i>内网访问
                    </a>
                </div>
            </div>
        </div>
    `).join('');

    checkServiceStatus();
}

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
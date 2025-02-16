// 数据加载
async function loadServices() {
    try {
        const response = await fetch('/api/services');
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
                <div class="col-12 col-md-6 col-lg-4" 
                     data-category="${service.category.toLowerCase()}" 
                     data-search="${service.name.toLowerCase()}  ${service.description?.toLowerCase() || ''}">
                    <div class="nav-card p-3">
                        <span class="category-badge">${service.category}</span> 
                        <h5 class="mb-3">${service.name}</h5> 
                        ${service.description ? `<p class="text-muted small mb-3">${service.description}</p>` : ''}
                        <div class="d-grid gap-2">
                            <a href="${service.domain_url}"  
                               class="btn btn-link" 
                               target="_blank"
                               title="域名访问">域名访问</a>
                            <a href="${service.ip_url}"  
                               class="btn btn-ip" 
                               target="_blank"
                               title="内网地址">内网访问</a>
                        </div>
                    </div>
                </div>
            `).join('');

    checkServiceStatus(); // 检查服务状态
}

// 动态生成分类过滤 
function initFilters(services) {
    const categories = [...new Set(services.map(s => s.category))];
    const filterContainer = document.getElementById('categoryFilter');

    filterContainer.innerHTML = `
                <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-outline-primary active" data-category="all">全部 (${services.length})</button> 
                    ${categories.map(cat => `
                        <button class="btn btn-outline-primary" 
                                data-category="${cat.toLowerCase()}"> 
                            ${cat} (${services.filter(s => s.category === cat).length})
                        </button>
                    `).join('')}
                </div>
            `;

    bindFilterEvents();
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
    // 搜索功能增强 
    document.getElementById('searchInput').addEventListener('input', function (e) {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#cardContainer  > .col').forEach(card => {
            const match = card.dataset.search.includes(term);
            card.style.display = match ? 'block' : 'none';
        });
    });

    // 分类过滤 
    document.querySelectorAll('#categoryFilter  .btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelector('#categoryFilter  .active')?.classList.remove('active');
            this.classList.add('active');
            const category = this.dataset.category;

            document.querySelectorAll('#cardContainer  > .col').forEach(card => {
                const show = category === 'all' || card.dataset.category === category;
                card.style.display = show ? 'block' : 'none';
            });
        });
    });
}

// 初始化加载 
document.addEventListener('DOMContentLoaded', loadServices);
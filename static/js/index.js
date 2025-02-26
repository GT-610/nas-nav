// 缓存常用 DOM 元素
const domCache = {
    container: document.getElementById('cardContainer'),
    template: document.getElementById('cardTemplate').content,
    tabContainer: document.getElementById('categoryTab'),
    searchInput: document.getElementById('searchInput')
};

// 安全地转义 HTML
function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
}

// 加载服务列表
async function loadServices(category = 'all') {
    try {
        domCache.container.innerHTML = `<div class="mdui-spinner"></div>`;
        
        // 移除 initFilters 调用
        const servicesResponse = await fetch(new URL(`/api/public/services?category=${encodeURIComponent(category)}`, window.location.origin));
        
        if (!servicesResponse.ok) throw new Error(`HTTP错误! 状态码: ${servicesResponse.status}`);
        
        const services = await servicesResponse.json();
        renderCards(services);
        
        // 更新URL参数保持状态
        window.history.replaceState({}, '', `?category=${encodeURIComponent(category)}`);
    } catch (error) {
        handleLoadingError(error);
    }
}

// 服务状态检测 
async function checkServiceStatus() {
    const cards = Array.from(document.querySelectorAll('.nav-card'));
    const requests = cards.map(card => {
        const ipUrl = card.querySelector('.btn-ip').href;
        return fetch(ipUrl, { mode: 'cors', cache: 'no-cache' }) // 考虑使用 cors 模式
            .then(() => card.classList.remove('offline'))
            .catch(() => card.classList.add('offline'));
    });

    await Promise.allSettled(requests);
}

// 卡片渲染函数 
function renderCards(services) {
    const fragment = document.createDocumentFragment();
    
    services.forEach(service => {
        const clone = document.importNode(domCache.template, true); // 使用 importNode 提升性能
        const card = clone.querySelector('.mdui-col-xs-12');
        
        // 数据属性设置
        Object.assign(card.dataset, {
            category: (service.category || '未分类').toLowerCase(), // 添加默认值
            name: (service.name || '').toLowerCase(),
            search: `${service.name.toLowerCase()} ${service.description?.toLowerCase() || ''}`
        });

        // 图标处理
        const iconContainer = clone.querySelector('.mdui-card-media');
        const iconImg = clone.querySelector('.card-icon');
        if (service.icon_url) {
            iconImg.src = service.icon_url;
            iconImg.alt = service.name;
        } else {
            iconContainer.remove();
        }

        // 内容填充
        clone.querySelector('.card-title').textContent = service.name;
        clone.querySelector('.card-category').textContent = service.category || '未分类';

        // 描述处理
        const descriptionEl = clone.querySelector('.card-description');
        if (service.description) {
            descriptionEl.textContent = service.description;
        } else {
            descriptionEl.parentElement?.remove();
        }

        // 链接设置
        const links = clone.querySelectorAll('a');
        links[0].href = service.domain_url;
        links[1].href = service.ip_url;

        fragment.appendChild(clone);
    });

    domCache.container.innerHTML = '';
    domCache.container.appendChild(fragment);
    checkServiceStatus();
}

// 动态生成分类过滤 
async function loadCategories() {
    try {
        const response = await fetch('/api/public/categories');
        if (!response.ok) throw new Error(`分类加载失败: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('分类加载失败:', error);
        return [];
    }
}

// 初始化过滤函数
async function initFilters() {
    try {
        const categories = await loadCategories();
        if (!categories.length) {
            console.warn('未获取到分类数据');
            return;
        }

        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            const tab = document.createElement('a');
            tab.className = 'mdui-ripple mdui-ripple-white';
            tab.textContent = category.name;
            tab.dataset.category = category.name.toLowerCase(); // 添加分类标识
            fragment.appendChild(tab);
        });

        domCache.tabContainer.innerHTML = '';
        domCache.tabContainer.appendChild(fragment);
        new mdui.Tab(domCache.tabContainer).handleUpdate();
        
        // 新增标签点击监听
        domCache.tabContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                filterByCategory(e.target.dataset.category);
            }
        });
    } catch (error) {
        console.error('分类初始化失败:', error);
    }
}

function filterByCategory(category) {
    // 清除现有搜索条件
    domCache.searchInput.value = '';
    // 重新加载对应分类的服务
    loadServices(category === 'all' ? '' : category);
}

const searchHandler = debounce((e) => {
    const searchTerm = e.target.value.trim().toLowerCase();
    applyCombinedFilter(searchTerm);
}, 300);

// 修改 bindFilterEvents 实现联合过滤（同时支持分类+搜索）
function bindFilterEvents() {
    domCache.tabContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            const category = e.target.dataset.category || 'all';
            // 高亮当前标签
            document.querySelectorAll('#categoryTab a').forEach(tab => {
                tab.classList.toggle('active', tab === e.target);
            });
            filterByCategory(category);
        }
    });

    domCache.searchInput.addEventListener('input', searchHandler);
}

// 新增防抖函数
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 新增联合过滤逻辑
function applyCombinedFilter(term) {
    const cards = document.querySelectorAll('#cardContainer > .mdui-col');
    let hasVisible = false;

    cards.forEach(card => {
        const searchMatch = card.dataset.name.includes(term) || 
                          card.dataset.search.includes(term);
        
        const shouldShow = searchMatch;
        card.style.display = shouldShow ? 'block' : 'none';
        if (shouldShow) hasVisible = true;
    });

    // 更新空状态提示
    handleEmptyState(hasVisible);
}

// 错误处理 
function handleLoadingError(error) {
    console.error('Error:', error);
    const container = document.getElementById('cardContainer');
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <h5 class="text-danger">⚠️ 数据加载失败</h5>
            <p class="text-muted">${escapeHtml(error.message)}</p> 
            <button class="btn btn-secondary mt-3" onclick="location.reload()">重新加载</button>
        </div>
    `;
}

// 初始化加载 
document.addEventListener('DOMContentLoaded', async () => {
    // 先加载分类
    await initFilters();
    
    // 再加载服务
    const urlParams = new URLSearchParams(window.location.search);
    const initialCategory = urlParams.get('category') || 'all';
    loadServices(initialCategory);
});
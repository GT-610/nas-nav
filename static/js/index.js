// 缓存常用 DOM 元素
let domCache = {};

// 初始化DOM缓存
function initDomCache() {
    domCache = {
        container: document.getElementById('cardContainer'),
        template: document.getElementById('cardTemplate'),
        tabContainer: document.getElementById('categoryTab'),
        searchInput: document.getElementById('searchInput')
    };
    return domCache;
}

// 加载服务列表
async function loadServices() {
    try {
        // 确保DOM缓存已初始化
        initDomCache();
        
        if (!domCache.container) {
            throw new Error('未找到卡片容器元素');
        }
        
        domCache.container.innerHTML = '<div class="loading-shimmer mdui-col-xs-12">加载中...</div>'.repeat(6);
        
        const [servicesResponse] = await Promise.all([
            fetch('/api/public/services'),
            initFilters() // 保持并行加载
        ]);
        
        if (!servicesResponse.ok) throw new Error(`HTTP错误! 状态码: ${servicesResponse.status}`);
        
        const services = await servicesResponse.json();
        renderCards(services);
        bindFilterEvents();
    } catch (error) {
        handleLoadingError(error);
    }
}

// 服务状态检测 
async function checkServiceStatus() {
    const cards = Array.from(document.querySelectorAll('.nav-card'));
    const requests = cards.map(card => {
        const ipUrl = card.querySelector('.btn-ip').href;
        return fetch(ipUrl, { mode: 'no-cors', cache: 'no-cache' })
            .then(() => card.classList.remove('offline'))
            .catch(() => card.classList.add('offline'));
    });

    await Promise.allSettled(requests);
}

// 卡片渲染函数 
function renderCards(services) {
    const fragment = document.createDocumentFragment();
    
    services.forEach(service => {
        const clone = domCache.template.content.cloneNode(true);
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
        // 确保DOM缓存已初始化
        const cache = initDomCache();
        
        // 检查tabContainer是否存在
        if (!cache.tabContainer) {
            console.warn('未找到分类标签容器');
            return;
        }
        
        const categories = await loadCategories();
        if (!categories.length) {
            console.warn('未获取到分类数据');
            return;
        }

        const fragment = document.createDocumentFragment();
        // 保留"全部"标签
        const allTab = document.createElement('a');
        allTab.href = '#tab-all';
        allTab.className = 'mdui-ripple mdui-ripple-white active';
        allTab.textContent = '全部';
        fragment.appendChild(allTab);
        
        // 添加其他分类标签
        categories.forEach(category => {
            const tab = document.createElement('a');
            tab.href = `#tab-${category.id}`;
            tab.className = 'mdui-ripple mdui-ripple-white';
            tab.textContent = category.name;
            tab.dataset.categoryId = category.id;
            fragment.appendChild(tab);
        });

        cache.tabContainer.innerHTML = '';
        cache.tabContainer.appendChild(fragment);
        
        // 初始化MDUI标签组件
        if (window.mdui) {
            new mdui.Tab(cache.tabContainer).handleUpdate();
        }
    } catch (error) {
        console.error('分类初始化失败:', error);
    }
}

// 错误处理 
function handleLoadingError(error) {
    console.error('Error:', error);
    const container = document.getElementById('cardContainer');
    if (container) {
        container.innerHTML = `
                    <div class="mdui-col-xs-12 text-center py-5">
                        <h5 class="mdui-text-color-red-500">⚠️ 数据加载失败</h5>
                        <p class="mdui-text-color-gray-500">${error.message}</p> 
                        <button class="mdui-btn mdui-btn-raised mdui-color-theme" onclick="location.reload()">重新加载</button>
                    </div>
                `;
    }
}

// 事件绑定
function bindFilterEvents() {
    // 确保DOM缓存已初始化
    const cache = initDomCache();
    
    if (!cache.searchInput) {
        console.warn('未找到搜索输入框');
        return;
    }
    
    let timeoutId;
    const handler = function(e) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#cardContainer > .mdui-col').forEach(card => {
                // 匹配服务名称
                const serviceName = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
                card.style.display = serviceName.includes(term) ? 'block' : 'none';
            });
        }, 300);
    };

    // 先移除旧监听（如果存在）
    try {
        cache.searchInput.removeEventListener('input', handler);
    } catch (e) {
        // 忽略移除不存在的监听器的错误
    }
    
    cache.searchInput.addEventListener('input', handler);
}

// 初始化加载 
document.addEventListener('DOMContentLoaded', loadServices);
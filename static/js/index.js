// 缓存常用DOM元素
const domCache = {
    categoryChips: document.getElementById('categoryChips'),
    serviceGrid: document.getElementById('serviceGrid'),
    searchInput: document.getElementById('searchInput'),
    mobileSearchInput: document.getElementById('mobileSearchInput'),
    emptyState: document.getElementById('emptyState')
};

// 存储所有服务和分类数据
let allServices = [];
let allCategories = [];
let currentCategory = 'all';
let currentSearchTerm = '';

// 初始化应用
async function initApp() {
    try {
        // 同时获取服务和分类数据
        const [servicesRes, categoriesRes] = await Promise.all([
            fetch('/api/public/services'),
            fetch('/api/public/categories')
        ]);

        allServices = await servicesRes.json();
        allCategories = await categoriesRes.json();

        // 渲染分类标签
        renderCategories();
        // 渲染服务列表
        renderServices();
        // 绑定搜索事件
        bindSearchEvents();
    } catch (error) {
        console.error('初始化应用失败:', error);
        showSnackbar('数据加载失败，请刷新页面重试');
    }
}

// 渲染分类标签
function renderCategories() {
    // 清空现有分类
    domCache.categoryChips.innerHTML = '';

    // 添加"全部"分类
    const allCategoryChip = document.createElement('div');
    allCategoryChip.className = 'mdui-chip category-chip mdui-chip-active';
    allCategoryChip.innerHTML = `
        <span class="mdui-chip-title">全部</span>
    `;
    allCategoryChip.dataset.category = 'all';
    allCategoryChip.addEventListener('click', handleCategoryClick);
    domCache.categoryChips.appendChild(allCategoryChip);

    // 添加其他分类
    allCategories.forEach(category => {
        const categoryChip = document.createElement('div');
        categoryChip.className = 'mdui-chip category-chip';
        categoryChip.innerHTML = `
            <span class="mdui-chip-title">${category.name}</span>
        `;
        categoryChip.dataset.category = category.name;
        categoryChip.addEventListener('click', handleCategoryClick);
        domCache.categoryChips.appendChild(categoryChip);
    });
}

// 处理分类点击事件
function handleCategoryClick(event) {
    // 更新当前分类
    currentCategory = event.currentTarget.dataset.category;

    // 更新分类标签样式
    document.querySelectorAll('.category-chip').forEach(chip => {
        if (chip.dataset.category === currentCategory) {
            chip.classList.add('mdui-chip-active');
        } else {
            chip.classList.remove('mdui-chip-active');
        }
    });

    // 重新渲染服务列表
    renderServices();
}

// 绑定搜索事件
function bindSearchEvents() {
    // 桌面端搜索
    domCache.searchInput.addEventListener('input', function() {
        currentSearchTerm = this.value.trim().toLowerCase();
        renderServices();
    });

    // 移动端搜索
    domCache.mobileSearchInput.addEventListener('input', function() {
        currentSearchTerm = this.value.trim().toLowerCase();
        renderServices();
    });
}

// 渲染服务列表
function renderServices() {
    // 清空现有服务
    domCache.serviceGrid.innerHTML = '';

    // 过滤服务
    let filteredServices = allServices;

    // 按分类过滤
    if (currentCategory !== 'all') {
        filteredServices = filteredServices.filter(service => 
            service.category === currentCategory
        );
    }

    // 按搜索词过滤
    if (currentSearchTerm) {
        filteredServices = filteredServices.filter(service => 
            service.name.toLowerCase().includes(currentSearchTerm) ||
            (service.description && service.description.toLowerCase().includes(currentSearchTerm)) ||
            service.category.toLowerCase().includes(currentSearchTerm)
        );
    }

    // 显示空状态或服务列表
    if (filteredServices.length === 0) {
        domCache.emptyState.style.display = 'block';
        return;
    }

    domCache.emptyState.style.display = 'none';

    // 渲染服务卡片
    filteredServices.forEach(service => {
        const serviceCard = document.createElement('div');
        serviceCard.className = 'mdui-col-md-3 mdui-col-sm-4 mdui-col-xs-6 mdui-m-b-4';
        serviceCard.innerHTML = `
            <div class="service-card mdui-card mdui-hoverable">
                <div class="mdui-card-content">
                    <div class="service-icon">
                        ${getServiceIcon(service.icon || '', service.name)}
                    </div>
                    <div class="mdui-text-center">
                        <h3 class="service-card-title mdui-typo-title">${service.name}</h3>
                        ${service.description ? `
                            <p class="service-card-description mdui-typo">${service.description}</p>
                        ` : ''}
                        
                    </div>
                </div>
                <div class="mdui-card-actions mdui-card-actions-stacked">
                    ${service.ip_url ? `
                        <a href="${ensureProtocol(service.ip_url)}" target="_blank" class="mdui-btn mdui-btn-block mdui-ripple mdui-color-blue-500">
                            <i class="mdui-icon material-icons">settings_ethernet</i> IP访问
                        </a>
                    ` : ''}
                    <a href="${ensureProtocol(service.domain_url)}" target="_blank" class="mdui-btn mdui-btn-block mdui-ripple mdui-color-teal-500">
                        <i class="mdui-icon material-icons">public</i> 域名访问
                    </a>
                </div>
            </div>
        `;
        domCache.serviceGrid.appendChild(serviceCard);
    });
}

// 获取服务图标
function getServiceIcon(iconUrl, serviceName) {
    if (iconUrl && iconUrl.trim()) {
        // 如果提供了图标URL，使用图片
        return `<img src="${iconUrl}" width="24" height="24" alt="图标">`;
    } else {
        // 否则使用默认图标
        return `<i class="mdui-icon material-icons">apps</i>`;
    }
}

// 为服务名称生成种子值
function iconSeed(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
}

// 确保URL有协议
function ensureProtocol(url) {
    if (!url) return '';
    // 如果URL没有协议，添加http://
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
        return 'http://' + url;
    }
    return url;
}

// 显示提示消息
function showSnackbar(message, type = 'success') {
    return new mdui.snackbar({
        message: message,
        position: 'bottom',
        timeout: 3000
    }).open();
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);
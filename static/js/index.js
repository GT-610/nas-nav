// 缓存常用 DOM 元素
const domCache = {
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

function filterByCategory(category) {
    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', `?category=${encodeURIComponent(category)}`);
    }
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
    // 服务端已渲染时跳过初始加载
    if (document.querySelector('#cardContainer').children.length === 0) {
        await initFilters();
        const urlParams = new URLSearchParams(window.location.search);
        const initialCategory = urlParams.get('category') || 'all';
        loadServices(initialCategory);
    }
    
    // 绑定事件（兼容服务端渲染的HTML）
    bindFilterEvents();
});
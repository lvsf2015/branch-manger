/**
 * 历史记录管理
 * 数据结构：{ title: string, branch: string, createdAt: string (ISO) }
 * 存储在 localStorage，按 createdAt 倒序排列，最多保留 100 条
 */

const HISTORY_KEY = 'gb_history';
const HISTORY_MAX = 500;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function getDefaultTester(branch) {
  branch = branch || '';
  if (branch.startsWith('max')) return '关帅';
  if (branch.startsWith('benchi')) return '赵仰杰';
  if (branch.startsWith('yiyuan')) return '吕帅锋';
  return '李韶娜';
}

function getBranchCopyPrefix(branch) {
  branch = branch || '';
  if (/-Fix-/.test(branch)) return '* 修复';
  if (/-Dev-/.test(branch)) return '* 迭代';
  return '';
}

function formatReadmeCopyText(branch, title, suffix) {
  const prefix = getBranchCopyPrefix(branch);
  const body = `${prefix ? '  ' : ''}* ${title}${suffix || ''}`;
  return prefix ? `${prefix}\n${body}` : body;
}

/** 新增一条记录，若 branch 相同则移除旧记录再置顶 */
function addHistory(title, branch) {
  let list = loadHistory();
  list = list.filter(item => item.branch !== branch);
  list.unshift({ title, branch, createdAt: new Date().toISOString() });
  if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
  saveHistory(list);
  checkQuotaWarning(list.length);
  rerender();
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  rerender();
}

function deleteHistory(branch) {
  let list = loadHistory();
  list = list.filter(item => item.branch !== branch);
  saveHistory(list);
  rerender();
}

// 删除两步确认已改为弹窗，保留占位符避免其他代码引用报错
let pendingDelBtn = null;
let skipNextDocClick = false;
function resetPendingDel() { pendingDelBtn = null; }

/** 读取当前筛选状态后重新渲染 */
function rerender() {
  const kw   = (document.getElementById('searchInput') || {}).value || '';
  const from = (document.getElementById('dateFrom')    || {}).value || '';
  const to   = (document.getElementById('dateTo')      || {}).value || '';
  renderHistory(kw, from, to);
}

/** 格式化时间为 MM-DD HH:mm（供导出使用） */
function formatTime(isoStr) {
  const d = new Date(isoStr);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const HH  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${HH}:${min}`;
}

/** 格式化时间只取 HH:mm（列表项用） */
function formatTimeOnly(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/**
 * 渲染历史列表
 * @param {string} keyword   - 关键词搜索
 * @param {string} dateFrom  - 起始日期 'YYYY-MM-DD'，空字符串表示不限
 * @param {string} dateTo    - 截止日期 'YYYY-MM-DD'，空字符串表示不限
 */
function renderHistory(keyword, dateFrom, dateTo) {
  const kw  = (keyword  || '').trim().toLowerCase();
  const all = loadHistory().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let list = all;

  // 关键词过滤
  if (kw) {
    list = list.filter(item =>
      item.title.toLowerCase().includes(kw) ||
      item.branch.toLowerCase().includes(kw));
  }

  // 日期区间过滤
  if (dateFrom) {
    const from = new Date(dateFrom + 'T00:00:00');
    list = list.filter(item => new Date(item.createdAt) >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo + 'T23:59:59');
    list = list.filter(item => new Date(item.createdAt) <= to);
  }

  const ul      = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');
  const hasFilter = kw || dateFrom || dateTo;

  if (countEl) {
    countEl.textContent = all.length > 0
      ? (hasFilter ? `${list.length} / ${all.length} 条` : `${all.length} 条`)
      : '';
  }
  if (typeof updateQuotaColor === 'function') updateQuotaColor(all.length);
  if (typeof renderCalendar === 'function') renderCalendar();

  if (list.length === 0) {
    ul.innerHTML = `<div class="history-empty">${hasFilter ? '无匹配记录' : '暂无历史记录'}</div>`;
    return;
  }

  // 按日期分组（key: YYYY-MM-DD，倒序）
  const WEEK = ['日','一','二','三','四','五','六'];
  const groups = {};
  list.forEach(item => {
    const d   = new Date(item.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (groups[key] = groups[key] || []).push(item);
  });

  const ICON_COPY   = `<img src="icon/copy.svg" width="16" height="16" style="display:block;opacity:0.5;" />`;
  const ICON_PERSON  = `<img src="icon/user.svg" width="16" height="16" style="display:block;opacity:0.5;" />`;
  const ICON_TRASH   = `<img src="icon/del.svg" width="16" height="16" style="display:block;opacity:0.4;" />`;
  const ICON_CUSTOM  = `<img src="icon/custom.svg" width="16" height="16" style="display:block;opacity:0.5;" />`;
  const ICON_BEIZHU  = `<img src="icon/beizhu.svg" width="16" height="16" style="display:block;opacity:0.5;" />`;

  let html = '';
  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateKey => {
    const d     = new Date(dateKey + 'T00:00:00');
    const label = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 · 周${WEEK[d.getDay()]}  (${groups[dateKey].length})`;
    html += `<div class="date-group-header" data-group="${dateKey}">
      <span>${label}</span>
      <span class="date-group-arrow">▼</span>
    </div>`;
    html += `<div class="date-group-items" data-group-items="${dateKey}">`;
    groups[dateKey].forEach(item => {
      const t    = formatTimeOnly(item.createdAt);
      const hTitle  = kw ? highlight(escapeHtml(item.title),  kw) : escapeHtml(item.title);
      const hBranch = kw ? highlight(escapeHtml(item.branch), kw) : escapeHtml(item.branch);
      html += `
      <div class="history-item">
        <div class="hi-meta-row">
          <span style="display:inline-flex;align-items:center;gap:2px;">
            <span class="hi-time">${t}</span>
            <button class="hi-icon-btn hi-copy-branch-services-btn" data-branch="${escapeHtml(item.branch)}" title="复制分支和涉及服务">${ICON_BEIZHU}</button>
          </span>
          <button class="hi-del-btn" data-branch="${escapeHtml(item.branch)}" title="删除">${ICON_TRASH}</button>
        </div>
        <div class="hi-content-row">
          <span class="hi-title-text">${hTitle}</span>
          <button class="hi-icon-btn hi-copy-plain-title-btn" data-title="${escapeHtml(item.title)}" title="复制标题">${ICON_COPY}</button>
          <button class="hi-icon-btn hi-copy-title-btn" data-title="${escapeHtml(item.title)}" data-branch="${escapeHtml(item.branch)}" title="复制标题（含负责人）">${ICON_PERSON}</button>
          <button class="hi-icon-btn hi-custom-copy-btn" data-title="${escapeHtml(item.title)}" data-branch="${escapeHtml(item.branch)}" title="自定义负责人复制">${ICON_CUSTOM}</button>
        </div>
        <div class="hi-content-row">
          <span class="hi-branch-text">${hBranch}</span>
          <button class="hi-icon-btn hi-copy-branch-btn" data-branch="${escapeHtml(item.branch)}" title="复制分支名">${ICON_COPY}</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  ul.innerHTML = html;

  ul.querySelectorAll('.date-group-header').forEach(header => {
    const key       = header.dataset.group;
    const items     = ul.querySelector(`.date-group-items[data-group-items="${key}"]`);
    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
      items.classList.toggle('collapsed');
      updateToggleAllBtn();
    });
  });

  // 更新一键展开/折叠按钮文案
  updateToggleAllBtn();

  ul.querySelectorAll('.hi-copy-plain-title-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const short = btn.dataset.title.slice(0, 12);
      copyText(btn.dataset.title, btn, `Bug描述「${short}…」已复制`);
    });
  });

  // 复制标题（含负责人）
  ul.querySelectorAll('.hi-copy-title-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const branch = btn.dataset.branch || '';
      const tester = getDefaultTester(branch);
      const suffix = `（前端：吕帅锋、测试：${tester}）`;
      const text = formatReadmeCopyText(branch, btn.dataset.title, suffix);
      copyText(text, btn, `README描述已复制`);
    });
  });

  // 复制分支名
  ul.querySelectorAll('.hi-copy-branch-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const short = btn.dataset.branch.slice(0, 20);
      copyText(btn.dataset.branch, btn, `分支名「${short}…」已复制`);
    });
  });

  // 复制分支和涉及服务
  ul.querySelectorAll('.hi-copy-branch-services-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openBranchServicesPopup(btn, btn.dataset.branch || '');
    });
  });

  // 自定义负责人复制
  ul.querySelectorAll('.hi-custom-copy-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openCustomCopyPopup(btn, btn.dataset.title, btn.dataset.branch);
    });
  });

  // 删除：弹窗确认
  ul.querySelectorAll('.hi-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const item = loadHistory().find(i => i.branch === btn.dataset.branch);
      openDelModal(btn.dataset.branch, item ? item.title : '');
    });
  });
}

/** 更新一键展开/折叠按钮文案 */
function updateToggleAllBtn() {
  const btn = document.getElementById('toggleAllBtn');
  if (!btn) return;
  const ul = document.getElementById('historyList');
  const hasCollapsed = ul.querySelector('.date-group-header.collapsed');
  btn.textContent = hasCollapsed ? '展开全部' : '折叠全部';
}

/** 高亮关键词（作用于已 escapeHtml 过的字符串） */
function highlight(html, kw) {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

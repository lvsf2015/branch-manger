#!/usr/bin/env node

/**
 * 根据 bug 描述自动生成 git 分支名
 * 用法：node gen-branch.js "<bug描述>"
 * 示例：node gen-branch.js "16453【奔驰环境】lightning版本审批步骤中缺少「审批通过」操作，期望可以添加"
 */

// ---------- 工具函数 ----------

/** 将日期格式化为 MMDD */
function formatDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}${d}`;
}

/**
 * 从 bug 描述中提取编号（开头连续数字）
 * 例如 "16453【奔驰环境】..." => "16453"
 */
function extractId(desc) {
  const match = desc.match(/^(\d+)/);
  return match ? match[1] : 'unknown';
}

/**
 * 从 bug 描述中提取主要描述：
 * 优先提取中文字符（过滤中文标点、英文标点及空白），最多取 20 个字符。
 * 若无中文则回退到英文单词（最多 5 个，以 '-' 拼接）。
 */
function extractSummary(desc) {
  // 去掉开头的数字编号
  let text = desc.replace(/^\d+/, '');

  // 去掉【...】或（...）包裹的环境标签
  text = text.replace(/[【\[（(][^】\]）)]*[】\]）)]/g, '');

  // 提取所有汉字（仅 CJK 统一汉字，过滤中文标点和英文标点）
  const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).slice(0, 20).join('');

  if (cnChars.length > 0) {
    return cnChars;
  }

  // 无中文时提取英文单词（至少 2 个字母，取前 5 个）
  const engTokens = (text.match(/[a-zA-Z][a-zA-Z0-9]*/g) || [])
    .map(t => t.toLowerCase())
    .slice(0, 5);

  return engTokens.length > 0 ? engTokens.join('-') : 'fix';
}

/**
 * 判断描述属于哪种环境
 * @returns {'yiyuan' | 'benchi' | 'other'}
 */
function detectEnv(desc) {
  if (/移远/.test(desc)) return 'yiyuan';
  if (/奔驰/.test(desc)) return 'benchi';
  return 'other';
}

/**
 * 生成分支名
 * @param {string} bugDesc - 原始 bug 描述字符串
 * @returns {string} 分支名
 */
function generateBranchName(bugDesc) {
  const id = extractId(bugDesc);
  const summary = extractSummary(bugDesc);
  const date = formatDate(new Date());
  const env = detectEnv(bugDesc);
  const author = 'lvshuaif';
  // 编号恰好 5 位用 Fix，否则用 Dev
  const tag = /^\d{5}$/.test(id) ? 'Fix' : 'Dev';

  switch (env) {
    case 'yiyuan':
      return `yiyuan-master-A-${tag}-${id}-${author}-${date}-${summary}`;
    case 'benchi':
      return `benchi-${tag}-${id}-${author}-${date}-${summary}`;
    default:
      return `one-master-A-${tag}-${id}-${author}-${date}-${summary}`;
  }
}

// ---------- 主逻辑 ----------

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('请提供 bug 描述作为参数');
  console.error('示例：node gen-branch.js "16453【奔驰环境】lightning版本审批步骤中缺少审批通过操作"');
  process.exit(1);
}

const bugDesc = args.join(' ');
const branchName = generateBranchName(bugDesc);

console.log(branchName);

// 自动复制到剪贴板（macOS pbcopy）
const { execSync } = require('child_process');
try {
  execSync('pbcopy', { input: branchName });
  console.error('已复制到剪贴板');
} catch {
  // 非 macOS 环境静默忽略
}

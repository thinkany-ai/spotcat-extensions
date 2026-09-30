/// <reference path="./spotcat.d.ts" />
const { t } = spotcat.i18n;
const $ = (id) => document.getElementById(id);
const input = $('input');

function stats(text) {
  return {
    chars: [...text].length,
    words: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    lines: text ? text.split('\n').length : 0,
  };
}

function render() {
  const s = stats(input.value);
  $('stats').replaceChildren(...Object.entries(s).map(([key, value]) => {
    const el = document.createElement('div');
    el.className = 'stat';
    el.innerHTML = `<b>${value}</b><span>${t(key)}</span>`;
    return el;
  }));
}

// 进入功能时触发（页面加载后立即一次）：内容匹配进入时 payload 是用户输入的文本
spotcat.onEnter(({ type, payload }) => {
  input.value = type === 'match' ? payload : '';
  render();
  input.focus();
});

input.addEventListener('input', render);

$('copy').onclick = async () => {
  const s = stats(input.value);
  await spotcat.copyText(Object.entries(s).map(([k, v]) => `${t(k)}: ${v}`).join('\n'));
  $('status').textContent = t('copied', { count: Object.keys(s).length });
};

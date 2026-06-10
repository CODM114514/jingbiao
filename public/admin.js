const loginForm = document.querySelector('#loginForm');
const settingsForm = document.querySelector('#settingsForm');
const adminContent = document.querySelector('#adminContent');
const settingsMessage = document.querySelector('#settingsMessage');
let adminPassword = '';

const yuan = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
});

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function toLocalDateTime(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword,
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? '请求失败');
  return body;
}

function renderAdmin(state) {
  adminContent.classList.remove('hidden');
  settingsForm.title.value = state.title;
  settingsForm.description.value = state.description;
  settingsForm.rentalPeriod.value = state.rentalPeriod;
  settingsForm.startingPrice.value = state.startingPrice;
  settingsForm.minIncrement.value = state.minIncrement;
  settingsForm.deposit.value = state.deposit;
  settingsForm.startsAt.value = toLocalDateTime(state.startsAt);
  settingsForm.endsAt.value = toLocalDateTime(state.endsAt);

  document.querySelector('#winnerBox').innerHTML = state.winner
    ? `<strong>${state.winner.name}</strong><br>完整手机号：${state.winner.phone}<br>中标价：${yuan.format(state.winner.amount)}<br>出价时间：${formatTime(state.winner.createdAt)}`
    : '暂无出价';

  document.querySelector('#adminBids').innerHTML = state.bids.length
    ? state.bids
        .map(
          (bid) =>
            `<tr><td>${bid.name}</td><td>${bid.phone}</td><td>${yuan.format(bid.amount)}</td><td>${formatTime(bid.createdAt)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="4">暂无出价</td></tr>';

  document.querySelector('#participants').innerHTML = state.participants.length
    ? state.participants
        .map(
          (participant) =>
            `<tr><td>${participant.name}</td><td>${participant.phone}</td><td>${formatTime(participant.registeredAt)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3">暂无参与者</td></tr>';
}

async function loadAdmin() {
  const state = await adminRequest('/api/admin');
  renderAdmin(state);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminPassword = document.querySelector('#adminPassword').value;
  try {
    await loadAdmin();
  } catch (error) {
    settingsMessage.textContent = error.message;
  }
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  settingsMessage.textContent = '';
  const data = Object.fromEntries(new FormData(settingsForm).entries());
  try {
    const state = await adminRequest('/api/admin/auction', {
      method: 'PUT',
      body: JSON.stringify({
        ...data,
        startingPrice: Number(data.startingPrice),
        minIncrement: Number(data.minIncrement),
        deposit: Number(data.deposit),
      }),
    });
    settingsMessage.textContent = '设置已保存。';
    renderAdmin(state);
  } catch (error) {
    settingsMessage.textContent = error.message;
  }
});

setInterval(() => {
  if (adminPassword) loadAdmin().catch(() => {});
}, 5000);

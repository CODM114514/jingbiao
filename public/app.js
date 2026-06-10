const authPanel = document.querySelector('#authPanel');
const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');
const forgotPasswordPanel = document.querySelector('#forgotPasswordPanel');
const userDashboard = document.querySelector('#userDashboard');
const bidForm = document.querySelector('#bidForm');
const authMessage = document.querySelector('#authMessage');
const dashboardMessage = document.querySelector('#dashboardMessage');
const bidMessage = document.querySelector('#bidMessage');
const forgotMessage = document.querySelector('#forgotMessage');
const amountInput = document.querySelector('#amount');
const participantSummary = document.querySelector('#participantSummary');
const logoutButton = document.querySelector('#logoutButton');
const enterAuctionButton = document.querySelector('#enterAuction');
const auctionProgram = document.querySelector('#auctionProgram');
const switchToRegister = document.querySelector('#showRegister');
const switchToLogin = document.querySelector('#showLogin');
const forgotPasswordButton = document.querySelector('#forgotPassword');
const forgotPhoneInput = document.querySelector('#forgotPhone');
const securityQuestionText = document.querySelector('#securityQuestionText');
const loadSecurityQuestionButton = document.querySelector('#loadSecurityQuestion');
const forgotPasswordForm = document.querySelector('#forgotPasswordForm');
const forgotAnswerInput = document.querySelector('#forgotAnswer');
const forgotNewPasswordInput = document.querySelector('#forgotNewPassword');
const backToLoginButton = document.querySelector('#backToLogin');

const identityKey = 'assetAuctionParticipant';
let latestState = null;
let participant = loadParticipant();
let inAuctionProgram = false;
let authMode = 'login';

const yuan = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
});

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function phoneLast4(phone) {
  return String(phone ?? '').replace(/\D/g, '').slice(-4);
}

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '').slice(0, 11);
}

function loadParticipant() {
  try {
    const raw = localStorage.getItem(identityKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value?.phone || !value?.password || !value?.name) {
      localStorage.removeItem(identityKey);
      return null;
    }
    value.phone = normalizePhone(value.phone);
    return value;
  } catch {
    localStorage.removeItem(identityKey);
    return null;
  }
}

function saveParticipant(nextParticipant) {
  participant = nextParticipant;
  localStorage.setItem(identityKey, JSON.stringify(nextParticipant));
}

function clearParticipant() {
  participant = null;
  localStorage.removeItem(identityKey);
}

function renderDuration(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return '0分钟';
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${mins}分钟`;
  return `${Math.max(mins, 1)}分钟`;
}

function renderCountdown(state) {
  if (state.isClosed) return '竞拍已结束';
  return state.isStarted
    ? `距离结束 ${renderDuration(state.endsAt)}`
    : `距离开始 ${renderDuration(state.startsAt)}`;
}

function phaseText(state) {
  if (state.isClosed) return '竞拍已结束';
  if (!state.isStarted) return '报名中，尚未开拍';
  return '竞拍进行中';
}

function dashboardNotice(state) {
  if (state.isClosed) return '竞拍已结束，请在后台查看结果。';
  if (!state.isStarted) return '报名中，请等待开拍后继续竞拍。';
  return '竞拍进行中，点击进入竞拍程序。';
}

function setMode(mode) {
  authMode = mode;
  registerForm.classList.toggle('hidden', mode !== 'register');
  loginForm.classList.toggle('hidden', mode !== 'login');
  forgotPasswordPanel.classList.toggle('hidden', mode !== 'forgot');

  switchToRegister.classList.toggle('active', mode === 'register');
  switchToLogin.classList.toggle('active', mode === 'login');

  authMessage.textContent = '';
  forgotMessage.textContent = '';
  forgotPhoneInput.value = '';
  securityQuestionText.textContent = '';
  forgotAnswerInput.value = '';
  forgotNewPasswordInput.value = '';
}

function renderIdentity(state = latestState) {
  const hasParticipant = Boolean(participant?.phone && participant?.password);
  authPanel.classList.toggle('hidden', hasParticipant);
  userDashboard.classList.toggle('hidden', !hasParticipant);
  auctionProgram.classList.toggle(
    'hidden',
    !hasParticipant || !inAuctionProgram || !state?.canBid
  );

  if (!hasParticipant) {
    setMode(authMode);
    return;
  }

  participantSummary.textContent = `${participant.name}，手机号后4位 ${phoneLast4(participant.phone)}`;
  enterAuctionButton.disabled = !state?.canBid;
  enterAuctionButton.textContent = state?.canBid ? '进入竞拍程序' : '等待开拍';
  dashboardMessage.textContent = state ? dashboardNotice(state) : '';
}

function renderAuctionInfo(state) {
  document.querySelector('#auctionTitle').textContent = state.title;
  document.querySelector('#auctionDescription').textContent = state.description;
  document.querySelector('#currentPrice').textContent = state.currentPrice
    ? yuan.format(state.currentPrice)
    : '暂无';
  document.querySelector('#winnerHint').textContent = state.currentWinnerPhoneLast4
    ? `当前领先：尾号${state.currentWinnerPhoneLast4}`
    : '暂无出价';
  document.querySelector('#startingPrice').textContent = yuan.format(state.startingPrice);
  document.querySelector('#minIncrement').textContent = yuan.format(state.minIncrement);
  document.querySelector('#deposit').textContent = yuan.format(state.deposit);
  document.querySelector('#rentalPeriod').textContent = state.rentalPeriod;
  document.querySelector('#startsAt').textContent = formatTime(state.startsAt);
  document.querySelector('#endsAt').textContent = formatTime(state.endsAt);
  document.querySelector('#phaseStatus').textContent = phaseText(state);
  document.querySelector('#countdown').textContent = renderCountdown(state);
}

function renderDashboard(state) {
  document.querySelector('#dashboardStatus').textContent = phaseText(state);
  document.querySelector('#dashboardCountdown').textContent = state.isStarted
    ? renderDuration(state.endsAt)
    : renderDuration(state.startsAt);
  document.querySelector('#dashboardCurrentPrice').textContent = state.currentPrice
    ? yuan.format(state.currentPrice)
    : '暂无';
  document.querySelector('#dashboardNextBid').textContent = yuan.format(state.minimumNextBid);
}

function renderBidHistory(state) {
  const rows = state.bidHistory.map(
    (bid) => `<tr><td>尾号 ${bid.phoneLast4}</td><td>${yuan.format(bid.amount)}</td><td>${formatTime(
      bid.createdAt
    )}</td></tr>`
  );
  document.querySelector('#bidHistory').innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="3">暂无出价</td></tr>';
}

function render(state) {
  latestState = state;
  renderAuctionInfo(state);
  renderDashboard(state);
  renderBidHistory(state);
  amountInput.min = String(state.minimumNextBid);
  amountInput.placeholder = `最低 ${state.minimumNextBid} 元`;
  bidForm.querySelector('button').disabled = !state.canBid;
  if (!state.canBid) {
    inAuctionProgram = false;
  }
  renderIdentity(state);
}

async function loadState() {
  const response = await fetch('/api/public');
  render(await response.json());
}

async function postJson(path, data) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? '操作失败');
  return body;
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  const data = Object.fromEntries(new FormData(registerForm).entries());
  try {
    await postJson('/api/register', {
      name: data.name,
      phone: data.phone,
      password: data.password,
      securityQuestion: data.securityQuestion,
      securityAnswer: data.securityAnswer,
    });
    saveParticipant({
      name: data.name.trim(),
      phone: normalizePhone(data.phone),
      password: data.password,
    });
    inAuctionProgram = false;
    setMode('login');
    await loadState();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  const data = Object.fromEntries(new FormData(loginForm).entries());
  try {
    const user = await postJson('/api/login', {
      phone: data.phone,
      password: data.password,
    });
    saveParticipant({
      name: user.name,
      phone: normalizePhone(data.phone),
      password: data.password,
    });
    inAuctionProgram = false;
    setMode('login');
    await loadState();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

forgotPasswordButton.addEventListener('click', () => setMode('forgot'));
backToLoginButton.addEventListener('click', () => setMode('login'));

loadSecurityQuestionButton.addEventListener('click', async () => {
  forgotMessage.textContent = '';
  securityQuestionText.textContent = '';
  const phone = normalizePhone(forgotPhoneInput.value);
  if (!/^\d{11}$/.test(phone)) {
    forgotMessage.textContent = '请输入11位手机号';
    return;
  }
  try {
    const response = await fetch(`/api/security-question?phone=${phone}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? '读取安全问题失败');
    securityQuestionText.textContent = body.securityQuestion
      ? `安全问题：${body.securityQuestion}`
      : '未设置安全问题';
  } catch (error) {
    forgotMessage.textContent = error.message;
  }
});

forgotPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  forgotMessage.textContent = '';
  const phone = normalizePhone(forgotPhoneInput.value);
  try {
    await postJson('/api/forgot-password', {
      phone,
      securityAnswer: forgotAnswerInput.value,
      newPassword: forgotNewPasswordInput.value,
    });
    forgotMessage.textContent = '密码已重置，请返回登录';
    setTimeout(() => setMode('login'), 1200);
  } catch (error) {
    forgotMessage.textContent = error.message;
  }
});

enterAuctionButton.addEventListener('click', () => {
  if (!latestState?.canBid) {
    dashboardMessage.textContent = dashboardNotice(latestState);
    return;
  }
  inAuctionProgram = true;
  bidMessage.textContent = '';
  renderIdentity(latestState);
});

bidForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  bidMessage.textContent = '';
  if (!participant?.phone || !participant?.password) {
    bidMessage.textContent = '请先登录';
    renderIdentity(latestState);
    return;
  }
  const data = Object.fromEntries(new FormData(bidForm).entries());
  try {
    const state = await postJson('/api/bids', {
      phone: participant.phone,
      password: participant.password,
      amount: Number(data.amount),
    });
    bidMessage.textContent = '出价成功';
    bidForm.reset();
    render(state);
  } catch (error) {
    bidMessage.textContent = error.message;
    if (latestState) render(latestState);
  }
});

logoutButton.addEventListener('click', () => {
  clearParticipant();
  inAuctionProgram = false;
  bidMessage.textContent = '';
  dashboardMessage.textContent = '';
  authMessage.textContent = '';
  setMode('login');
  renderIdentity(latestState);
});

switchToRegister.addEventListener('click', () => setMode('register'));
switchToLogin.addEventListener('click', () => setMode('login'));

loadState().catch((error) => {
  authMessage.textContent = error.message;
});
renderIdentity();
setInterval(loadState, 5000);
setInterval(() => {
  if (latestState) {
    document.querySelector('#countdown').textContent = renderCountdown(latestState);
    document.querySelector('#dashboardCountdown').textContent = latestState.isStarted
      ? renderDuration(latestState.endsAt)
      : renderDuration(latestState.startsAt);
  }
}, 1000);

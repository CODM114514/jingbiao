import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('participant page separates registration, user dashboard, auction entry, bidding, and public history', async () => {
  const html = await readFile('public/index.html', 'utf8');

  assert.match(html, /注册登录/);
  assert.match(html, /用户后台/);
  assert.match(html, /竞拍状态/);
  assert.match(html, /开拍倒计时/);
  assert.match(html, /进入竞拍程序/);
  assert.match(html, /切换身份/);
  assert.match(html, /竞拍程序/);
  assert.match(html, /出价记录/);
  assert.match(html, /竞标开始时间/);
});

test('admin page contains password, auction settings, start time, and full bid management surfaces', async () => {
  const html = await readFile('public/admin.html', 'utf8');

  assert.match(html, /管理员密码/);
  assert.match(html, /竞标设置/);
  assert.match(html, /竞标开始时间/);
  assert.match(html, /完整手机号/);
  assert.match(html, /中标人/);
});

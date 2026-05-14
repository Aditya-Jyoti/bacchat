/**
 * Web routes — server-side rendered HTML for guests who tapped an invite
 * link but haven't installed the app. After joining via /invite/:code,
 * they get redirected here with an HttpOnly JWT cookie and can use the
 * group's split features (view, add, settle) directly from the browser.
 *
 * Auth: every /g/* route consults `req.cookies.bacchat_jwt`. If missing or
 * invalid, the user is redirected to /invite/:code. No fetch/JS framework
 * — plain HTML forms with Post-Redirect-Get.
 */
import { Router, Request, Response, NextFunction } from 'express';
import type { Router as ExpressRouter } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { verifyToken } from '../utils/jwt';

const router: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Auth middleware — reads the cookie set by the invite POST handler
// ---------------------------------------------------------------------------

interface WebReq extends Request {
  userId?: string;
  userName?: string;
  isGuest?: boolean;
}

async function webAuth(req: WebReq, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.bacchat_jwt as string | undefined;
  if (!token) {
    res.redirect('/');
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie('bacchat_jwt');
    res.redirect('/');
    return;
  }
  const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
  if (revoked) {
    res.clearCookie('bacchat_jwt');
    res.redirect('/');
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) {
    res.clearCookie('bacchat_jwt');
    res.redirect('/');
    return;
  }
  req.userId = user.id;
  req.userName = user.name;
  req.isGuest = user.isGuest;
  next();
}

// ---------------------------------------------------------------------------
// HTML helpers — small string-builder library to avoid a templating engine
// ---------------------------------------------------------------------------

function esc(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(n: number): string {
  const sign = n < 0 ? '−' : '';
  const v = Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return `${sign}₹${v}`;
}

/** Shared <head> / chrome / footer for every page. */
function page({
  title,
  body,
  backHref,
}: {
  title: string;
  body: string;
  backHref?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1E88E5">
<title>${esc(title)} · Bacchat</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  :root{
    --bg:#0E1014;--surface:#1A1D23;--surface-2:#23272F;
    --text:#ECEEF1;--muted:#9AA0AB;--line:#2C313A;
    --primary:#4DA8FF;--primary-2:#1E88E5;
    --success:#34C759;--success-soft:rgba(52,199,89,.15);
    --error:#F86A6A;--error-soft:rgba(248,106,106,.15);
    --warn:#FFB74D;
  }
  @media (prefers-color-scheme: light){
    :root{
      --bg:#F6F7F9;--surface:#FFFFFF;--surface-2:#F0F2F5;
      --text:#0E1014;--muted:#5A6072;--line:#E1E4EA;
    }
  }
  html,body{background:var(--bg);color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    line-height:1.45;min-height:100vh}
  body{max-width:540px;margin:0 auto;padding:0 16px 96px}
  header.top{display:flex;align-items:center;gap:12px;padding:16px 0 12px;position:sticky;top:0;background:var(--bg);z-index:5}
  header.top a.back{color:var(--text);text-decoration:none;font-size:20px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px}
  header.top a.back:hover{background:var(--surface-2)}
  header.top h1{font-size:18px;font-weight:800;flex:1}
  .badge{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:var(--surface-2);color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;margin:0 0 12px}
  .row{display:flex;align-items:center;gap:10px}
  .row.between{justify-content:space-between}
  .stack{display:flex;flex-direction:column;gap:2px}
  .muted{color:var(--muted)}
  .small{font-size:12px}
  .xs{font-size:11px}
  .big{font-size:22px;font-weight:800}
  .h2{font-size:13px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin:18px 4px 8px}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:var(--surface-2);color:var(--text)}
  .pill.green{background:var(--success-soft);color:var(--success)}
  .pill.red{background:var(--error-soft);color:var(--error)}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:12px;border:none;font:inherit;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none;transition:opacity .15s}
  .btn:active{opacity:.7}
  .btn-primary{background:var(--primary-2);color:#fff;width:100%}
  .btn-tonal{background:var(--surface-2);color:var(--text)}
  .btn-danger{background:transparent;color:var(--error);border:1px solid var(--error)}
  .btn-ghost{background:transparent;color:var(--primary);padding:8px 12px}
  .fab{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);max-width:520px;width:calc(100% - 32px);background:var(--primary-2);color:#fff;padding:14px;border-radius:14px;text-align:center;font-weight:800;text-decoration:none;box-shadow:0 6px 22px rgba(30,136,229,.45)}
  input[type=text],input[type=number],select,textarea{
    width:100%;padding:12px 14px;background:var(--surface-2);
    color:var(--text);border:1px solid var(--line);border-radius:12px;
    font:inherit;outline:none;font-size:15px
  }
  input:focus,select:focus{border-color:var(--primary)}
  label{display:block;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:14px 4px 6px}
  fieldset{border:1px solid var(--line);border-radius:12px;padding:10px 14px 14px;margin:0}
  legend{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;padding:0 6px}
  .checkrow{display:flex;align-items:center;justify-content:space-between;padding:8px 4px}
  .checkrow input[type=checkbox]{width:20px;height:20px;accent-color:var(--primary-2)}
  .err{background:var(--error-soft);color:var(--error);padding:10px 12px;border-radius:10px;font-size:13px;margin-bottom:12px}
  .seg{display:flex;background:var(--surface-2);border-radius:10px;padding:3px;gap:3px}
  .seg label{display:flex;flex:1;align-items:center;justify-content:center;cursor:pointer;padding:10px 12px;border-radius:7px;font-size:13px;font-weight:700;color:var(--muted);margin:0;text-transform:none;letter-spacing:0;transition:.15s}
  .seg input{display:none}
  .seg input:checked + span{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.1);border-radius:7px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:10px 12px;font-weight:700}
  .seg label:has(input:checked){background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.1)}
  hr{border:none;border-top:1px solid var(--line);margin:12px 0}
  .empty{text-align:center;padding:40px 16px;color:var(--muted)}
  .emoji-lg{font-size:32px}
</style>
</head>
<body>
<header class="top">
  ${backHref ? `<a class="back" href="${esc(backHref)}" aria-label="Back">←</a>` : ''}
  <h1>${esc(title)}</h1>
</header>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers: load group with members + balance for the current user
// ---------------------------------------------------------------------------

async function loadGroupForUser(groupId: string, userId: string) {
  const group = await prisma.splitGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true, isGuest: true } } } },
    },
  });
  if (!group) return null;
  if (!group.members.some((m) => m.userId === userId)) return null;
  return group;
}

interface GroupShareView {
  id: string;
  amount: number;
  isSettled: boolean;
  userId: string;
  userName: string;
}
interface GroupSplitView {
  id: string;
  title: string;
  description: string | null;
  category: string;
  totalAmount: number;
  paidById: string;
  paidByName: string;
  createdAt: Date;
  shares: GroupShareView[];
}

async function loadSplits(groupId: string): Promise<GroupSplitView[]> {
  const splits = await prisma.split.findMany({
    where: { groupId },
    orderBy: { createdAt: 'desc' },
    include: {
      payer: { select: { name: true } },
      shares: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  return splits.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    totalAmount: Number(s.totalAmount),
    paidById: s.paidBy,
    paidByName: s.payer.name,
    createdAt: s.createdAt,
    shares: s.shares.map((sh) => ({
      id: sh.id,
      amount: Number(sh.amount),
      isSettled: sh.isSettled,
      userId: sh.userId,
      userName: sh.user.name,
    })),
  }));
}

/** Net balance for `userId` in the group: positive = others owe them. */
function computeNetBalance(splits: GroupSplitView[], userId: string): number {
  let net = 0;
  for (const s of splits) {
    for (const sh of s.shares) {
      if (sh.isSettled) continue;
      if (s.paidById === userId && sh.userId !== userId) net += sh.amount;
      else if (sh.userId === userId && s.paidById !== userId) net -= sh.amount;
    }
  }
  return Math.abs(net) < 0.01 ? 0 : net;
}

const CATEGORY_ICON: Record<string, string> = {
  food: '🍔',
  transport: '✈️',
  entertainment: '🎬',
  rent: '🏠',
  utilities: '⚡',
  other: '📦',
};

// ---------------------------------------------------------------------------
// GET /g/:groupId — group dashboard
// ---------------------------------------------------------------------------

router.get('/g/:groupId', webAuth, async (req: WebReq, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { groupId } = req.params;
  const flash = (req.query.flash as string) || '';

  const group = await loadGroupForUser(groupId, userId);
  if (!group) {
    res.status(404).send(page({ title: 'Group not found', body: `<div class="empty"><div class="emoji-lg">🔗</div><p>This group is unavailable or you've been removed.</p><a class="btn btn-tonal" href="/">Back</a></div>` }));
    return;
  }
  const splits = await loadSplits(groupId);
  const net = computeNetBalance(splits, userId);

  const balanceCard = `
    <div class="card">
      <div class="row between">
        <div class="stack">
          <span class="xs muted">Your balance</span>
          ${
            net === 0
              ? '<span class="big">All settled</span>'
              : net > 0
              ? `<span class="big" style="color:var(--success)">${money(net)}</span><span class="xs muted">others owe you</span>`
              : `<span class="big" style="color:var(--error)">${money(net)}</span><span class="xs muted">you owe</span>`
          }
        </div>
        <span class="emoji-lg">${esc(group.emoji)}</span>
      </div>
    </div>`;

  const splitsHtml = splits.length === 0
    ? `<div class="empty"><p>No splits yet — tap below to add the first one.</p></div>`
    : splits.map((s) => {
        const myShare = s.shares.find((sh) => sh.userId === userId);
        const iPaid = s.paidById === userId;
        let myLabel = '';
        if (iPaid) {
          const owedToMe = s.shares
            .filter((sh) => sh.userId !== userId && !sh.isSettled)
            .reduce((a, sh) => a + sh.amount, 0);
          myLabel = owedToMe > 0.01
            ? `<span class="pill green">you get ${money(owedToMe)}</span>`
            : `<span class="pill">paid by you</span>`;
        } else if (myShare) {
          myLabel = myShare.isSettled
            ? `<span class="pill">settled</span>`
            : `<span class="pill red">you owe ${money(myShare.amount)}</span>`;
        } else {
          myLabel = `<span class="pill">not in this split</span>`;
        }
        return `
          <a class="card" href="/g/${esc(groupId)}/s/${esc(s.id)}" style="text-decoration:none;color:inherit;display:block">
            <div class="row between" style="margin-bottom:6px">
              <div class="row" style="gap:8px">
                <span style="font-size:18px">${esc(CATEGORY_ICON[s.category] || '📦')}</span>
                <strong>${esc(s.title)}</strong>
              </div>
              <strong>${money(s.totalAmount)}</strong>
            </div>
            <div class="row between">
              <span class="xs muted">paid by ${esc(iPaid ? 'you' : s.paidByName)}</span>
              ${myLabel}
            </div>
          </a>`;
      }).join('');

  res.send(page({
    title: group.name,
    backHref: undefined,
    body: `
      ${flash ? `<div class="card" style="background:var(--success-soft);border-color:transparent;color:var(--success)">${esc(flash)}</div>` : ''}
      ${balanceCard}
      <div class="row between" style="margin:0 4px 8px">
        <span class="h2" style="margin:0">Splits</span>
        <span class="xs muted">${splits.length} total</span>
      </div>
      ${splitsHtml}
      <a class="fab" href="/g/${esc(groupId)}/new-split">＋ Add split</a>`,
  }));
});

// ---------------------------------------------------------------------------
// GET /g/:groupId/new-split — form
// ---------------------------------------------------------------------------

router.get('/g/:groupId/new-split', webAuth, async (req: WebReq, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { groupId } = req.params;
  const group = await loadGroupForUser(groupId, userId);
  if (!group) {
    res.redirect('/');
    return;
  }
  const err = (req.query.err as string) || '';

  const memberOptions = group.members
    .map((m) => `<option value="${esc(m.userId)}"${m.userId === userId ? ' selected' : ''}>${esc(m.user.name)}${m.userId === userId ? ' (you)' : ''}</option>`)
    .join('');

  const memberCheckboxes = group.members
    .map(
      (m) => `
      <label class="checkrow">
        <span>${esc(m.user.name)}${m.userId === userId ? ' (you)' : ''}</span>
        <input type="checkbox" name="member_${esc(m.userId)}" value="1" checked>
      </label>`,
    )
    .join('');

  res.send(page({
    title: 'New split',
    backHref: `/g/${esc(groupId)}`,
    body: `
      ${err ? `<div class="err">${esc(err)}</div>` : ''}
      <form method="POST" action="/g/${esc(groupId)}/new-split">
        <label for="title">Title</label>
        <input id="title" type="text" name="title" required maxlength="80" placeholder="e.g. Dinner" autocomplete="off">

        <label for="amount">Amount (₹)</label>
        <input id="amount" type="number" name="amount" step="0.01" min="0.01" required inputmode="decimal">

        <label for="category">Category</label>
        <select id="category" name="category">
          <option value="food">🍔 Food</option>
          <option value="transport">✈️ Transport</option>
          <option value="entertainment">🎬 Entertainment</option>
          <option value="rent">🏠 Rent</option>
          <option value="utilities">⚡ Utilities</option>
          <option value="other" selected>📦 Other</option>
        </select>

        <label for="paid_by">Paid by</label>
        <select id="paid_by" name="paid_by">${memberOptions}</select>

        <label>Split type</label>
        <div class="seg">
          <label><input type="radio" name="split_type" value="equal" checked><span>Equal</span></label>
          <label><input type="radio" name="split_type" value="custom"><span>Custom</span></label>
        </div>

        <label style="margin-top:14px">Split with</label>
        <fieldset>
          <legend>Untick anyone who isn't in this split</legend>
          ${memberCheckboxes}
        </fieldset>

        <details style="margin-top:14px">
          <summary style="cursor:pointer;color:var(--muted);font-size:12px;font-weight:700;padding:4px">Custom amounts (only used if "Custom" selected)</summary>
          <div style="margin-top:8px">
            ${group.members
              .map(
                (m) => `
              <label for="amt_${esc(m.userId)}">${esc(m.user.name)}</label>
              <input id="amt_${esc(m.userId)}" type="number" name="amt_${esc(m.userId)}" step="0.01" min="0" placeholder="0">`,
              )
              .join('')}
          </div>
        </details>

        <button class="btn btn-primary" type="submit" style="margin-top:20px">Save split</button>
      </form>`,
  }));
});

// ---------------------------------------------------------------------------
// POST /g/:groupId/new-split — handle form submit
// ---------------------------------------------------------------------------

router.post('/g/:groupId/new-split', webAuth, async (req: WebReq, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { groupId } = req.params;
  const back = `/g/${encodeURIComponent(groupId)}/new-split`;

  const group = await loadGroupForUser(groupId, userId);
  if (!group) {
    res.redirect('/');
    return;
  }

  const title = String(req.body.title || '').trim();
  const amount = Number(req.body.amount);
  const category = String(req.body.category || 'other');
  const paidBy = String(req.body.paid_by || '');
  const splitType = req.body.split_type === 'custom' ? 'custom' : 'equal';

  if (!title) {
    res.redirect(`${back}?err=${encodeURIComponent('Title is required')}`);
    return;
  }
  if (!isFinite(amount) || amount <= 0) {
    res.redirect(`${back}?err=${encodeURIComponent('Enter a positive amount')}`);
    return;
  }
  if (!['food', 'transport', 'entertainment', 'rent', 'utilities', 'other'].includes(category)) {
    res.redirect(`${back}?err=${encodeURIComponent('Pick a category')}`);
    return;
  }
  if (!group.members.some((m) => m.userId === paidBy)) {
    res.redirect(`${back}?err=${encodeURIComponent('Paid-by must be a member')}`);
    return;
  }

  const includedIds = group.members
    .filter((m) => req.body[`member_${m.userId}`] === '1')
    .map((m) => m.userId);
  if (includedIds.length === 0) {
    res.redirect(`${back}?err=${encodeURIComponent('Pick at least one person to split with')}`);
    return;
  }

  // Build shares for the backend's "custom" split-type with explicit per-user
  // amounts — that lets us limit the split to a subset of members.
  let shares: Array<{ userId: string; amount: number }> = [];
  if (splitType === 'equal') {
    const per = Math.round((amount / includedIds.length) * 100) / 100;
    shares = includedIds.map((uid, i) => ({
      userId: uid,
      amount: i === includedIds.length - 1
        ? Math.round((amount - per * (includedIds.length - 1)) * 100) / 100
        : per,
    }));
  } else {
    let total = 0;
    for (const uid of includedIds) {
      const v = Number(req.body[`amt_${uid}`]);
      if (!isFinite(v) || v < 0) {
        res.redirect(`${back}?err=${encodeURIComponent('Custom amounts must be non-negative')}`);
        return;
      }
      shares.push({ userId: uid, amount: v });
      total += v;
    }
    if (Math.abs(total - amount) > 0.01) {
      res.redirect(`${back}?err=${encodeURIComponent(`Custom amounts must sum to ${money(amount)} (got ${money(total)})`)}`);
      return;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.split.create({
        data: {
          id: randomUUID(),
          groupId,
          title,
          description: null,
          category,
          totalAmount: amount,
          paidBy,
          splitType: 'custom',
        },
      });
      await tx.splitShare.createMany({
        data: shares.map((s) => ({ splitId: created.id, userId: s.userId, amount: s.amount })),
      });
    });
    res.redirect(`/g/${encodeURIComponent(groupId)}?flash=${encodeURIComponent('Split added')}`);
  } catch (e) {
    console.error('[web] create split error:', e);
    res.redirect(`${back}?err=${encodeURIComponent('Could not save split. Please try again.')}`);
  }
});

// ---------------------------------------------------------------------------
// GET /g/:groupId/s/:splitId — split detail
// ---------------------------------------------------------------------------

router.get('/g/:groupId/s/:splitId', webAuth, async (req: WebReq, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { groupId, splitId } = req.params;
  const group = await loadGroupForUser(groupId, userId);
  if (!group) {
    res.redirect('/');
    return;
  }
  const split = await prisma.split.findUnique({
    where: { id: splitId },
    include: {
      payer: { select: { name: true } },
      shares: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!split || split.groupId !== groupId) {
    res.status(404).send(page({ title: 'Split not found', body: `<div class="empty">This split is gone.</div>` }));
    return;
  }

  const sharesHtml = split.shares
    .map((sh) => {
      const isMe = sh.userId === userId;
      const isPayer = sh.userId === split.paidBy;
      const canSettle = !sh.isSettled && (isMe || userId === split.paidBy);
      const label = sh.isSettled
        ? `<span class="pill green">settled</span>`
        : isPayer
        ? `<span class="pill">paid the bill</span>`
        : isMe
        ? `<span class="pill red">you owe ${money(Number(sh.amount))}</span>`
        : `<span class="pill">owes ${money(Number(sh.amount))}</span>`;
      return `
        <div class="card">
          <div class="row between">
            <div class="stack">
              <strong>${esc(isMe ? 'You' : sh.user.name)}</strong>
              ${label}
            </div>
            <div class="row" style="gap:10px">
              <strong>${money(Number(sh.amount))}</strong>
              ${canSettle
                ? `<form method="POST" action="/g/${esc(groupId)}/s/${esc(splitId)}/settle/${esc(sh.id)}" style="display:inline">
                     <button class="btn btn-tonal" type="submit" style="padding:8px 14px;font-size:12px">Mark settled</button>
                   </form>`
                : ''}
            </div>
          </div>
        </div>`;
    })
    .join('');

  const canDelete = split.paidBy === userId;

  res.send(page({
    title: split.title,
    backHref: `/g/${esc(groupId)}`,
    body: `
      <div class="card">
        <div class="row between">
          <div class="stack">
            <span class="xs muted">Total</span>
            <span class="big">${money(Number(split.totalAmount))}</span>
            <span class="xs muted">${esc(CATEGORY_ICON[split.category] || '📦')} ${esc(split.category)} · paid by ${esc(split.paidBy === userId ? 'you' : split.payer.name)}</span>
          </div>
        </div>
      </div>
      <span class="h2">Shares</span>
      ${sharesHtml}
      ${
        canDelete
          ? `<form method="POST" action="/g/${esc(groupId)}/s/${esc(splitId)}/delete" style="margin-top:16px">
               <button class="btn btn-danger" type="submit" style="width:100%" onclick="return confirm('Delete this split?')">Delete split</button>
             </form>`
          : ''
      }`,
  }));
});

// ---------------------------------------------------------------------------
// POST /g/:groupId/s/:splitId/settle/:shareId
// ---------------------------------------------------------------------------

router.post(
  '/g/:groupId/s/:splitId/settle/:shareId',
  webAuth,
  async (req: WebReq, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { groupId, splitId, shareId } = req.params;
    try {
      const share = await prisma.splitShare.findUnique({
        where: { id: shareId },
        include: { split: true },
      });
      if (!share || share.splitId !== splitId || share.split.groupId !== groupId) {
        res.redirect(`/g/${encodeURIComponent(groupId)}/s/${encodeURIComponent(splitId)}`);
        return;
      }
      // Same rule as the API: only the debtor or the payer can settle.
      if (share.userId !== userId && share.split.paidBy !== userId) {
        res.redirect(`/g/${encodeURIComponent(groupId)}/s/${encodeURIComponent(splitId)}`);
        return;
      }
      if (!share.isSettled) {
        await prisma.splitShare.update({ where: { id: shareId }, data: { isSettled: true } });
      }
    } catch (e) {
      console.error('[web] settle error:', e);
    }
    res.redirect(`/g/${encodeURIComponent(groupId)}/s/${encodeURIComponent(splitId)}?flash=settled`);
  },
);

// ---------------------------------------------------------------------------
// POST /g/:groupId/s/:splitId/delete
// ---------------------------------------------------------------------------

router.post(
  '/g/:groupId/s/:splitId/delete',
  webAuth,
  async (req: WebReq, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { groupId, splitId } = req.params;
    try {
      const split = await prisma.split.findUnique({ where: { id: splitId } });
      if (split && split.groupId === groupId && split.paidBy === userId) {
        await prisma.split.delete({ where: { id: splitId } });
      }
    } catch (e) {
      console.error('[web] delete split error:', e);
    }
    res.redirect(`/g/${encodeURIComponent(groupId)}`);
  },
);

// ---------------------------------------------------------------------------
// POST /web-logout — clear cookie, redirect home
// ---------------------------------------------------------------------------

router.post('/web-logout', (_req: WebReq, res: Response): void => {
  res.clearCookie('bacchat_jwt');
  res.redirect('/');
});

export default router;

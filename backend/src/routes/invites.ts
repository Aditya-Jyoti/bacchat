import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { generateToken, verifyToken } from '../utils/jwt';
import { validate } from '../middleware/validator';
import { formatGroupDetail } from './groups';

const router: ExpressRouter = Router();

/**
 * @openapi
 * /invite/{inviteCode}:
 *   get:
 *     tags:
 *       - Invites
 *     summary: Look up a group by invite code (no auth required)
 *     parameters:
 *       - in: path
 *         name: inviteCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group preview
 *       404:
 *         description: Invite code not found
 */
router.get('/invite/:inviteCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inviteCode } = req.params;
    // Decide JSON vs HTML *before* the DB call so the error path matches.
    //
    // Why this can't just use req.accepts('html'):
    //   Dio (and many native HTTP clients) send Accept: */*. Express's
    //   req.accepts('html') returns truthy for */*, so the app got the HTML
    //   landing page and crashed parsing it as JSON. The reliable signal is
    //   the mount path — /v1/invite/* is always an API call, only the
    //   un-prefixed /invite/* might be a browser landing.
    const wantsJson =
      req.baseUrl === '/v1' ||
      req.headers.authorization?.startsWith('Bearer ') ||
      req.xhr ||
      req.accepts(['json', 'html']) === 'json';

    console.log(`[invite] lookup code="${inviteCode}" baseUrl="${req.baseUrl}" accepts="${req.headers.accept ?? '?'}" wantsJson=${wantsJson}`);

    const group = await prisma.splitGroup.findUnique({
      where: { inviteCode },
      include: { _count: { select: { members: true } } },
    });

    if (!group) {
      console.log(`[invite] NOT FOUND code="${inviteCode}"`);
      if (wantsJson) {
        res.status(404).json({ error: 'Invite code not found', code: inviteCode });
      } else {
        res.status(404).send(_html404(inviteCode));
      }
      return;
    }
    console.log(`[invite] HIT code="${inviteCode}" → group="${group.name}" (${group.id})`);

    if (wantsJson) {
      res.json({
        group_id: group.id,
        name: group.name,
        emoji: group.emoji,
        member_count: group._count.members,
      });
      return;
    }

    // Browser request → HTML landing page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(_htmlLanding({ inviteCode, name: group.name, emoji: group.emoji, memberCount: group._count.members }));
  } catch (error) {
    console.error('Get invite error:', error);
    res.status(500).json({ error: 'Failed to fetch invite' });
  }
});

function _esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _htmlLanding({ inviteCode, name, emoji, memberCount }: {
  inviteCode: string; name: string; emoji: string; memberCount: number;
}) {
  const enc = encodeURIComponent;
  const fallback = enc(`https://bacchat.omrin.in/invite/${inviteCode}`);
  const intentUrl = `intent://bacchat.omrin.in/invite/${inviteCode}#Intent;scheme=https;package=com.bacchat.app;S.browser_fallback_url=${fallback};end`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Join ${_esc(name)} · Bacchat</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#111;color:#e8e8e8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#1e1e1e;border-radius:24px;padding:40px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.5);border:1.5px solid #2a2a2a}
    .emoji{font-size:72px;margin-bottom:16px;display:block}
    .label{color:#777;font-size:13px;margin-bottom:6px}
    h1{font-size:26px;font-weight:800;color:#fff;margin-bottom:6px}
    .members{color:#666;font-size:13px;margin-bottom:32px}
    .btn{display:block;width:100%;padding:15px;border-radius:14px;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s}
    .btn:active{opacity:.8}
    .btn-green{background:#4caf50;color:#fff;margin-bottom:14px}
    .divider{color:#444;font-size:12px;margin:18px 0;position:relative}
    .divider::before,.divider::after{content:'';position:absolute;top:50%;width:40%;height:1px;background:#2e2e2e}
    .divider::before{left:0}.divider::after{right:0}
    input{width:100%;padding:14px 16px;background:#2a2a2a;border:1.5px solid #333;border-radius:12px;color:#e8e8e8;font-size:15px;outline:none;font-family:inherit;margin-bottom:12px}
    input:focus{border-color:#4caf50}
    .btn-outline{background:transparent;color:#4caf50;border:2px solid #4caf50}
    .msg{font-size:13px;margin-top:10px;min-height:18px}
    .err{color:#f44336}.ok{color:#4caf50;font-weight:600}
  </style>
</head>
<body>
<div class="card">
  <span class="emoji">${emoji}</span>
  <p class="label">You're invited to</p>
  <h1>${_esc(name)}</h1>
  <p class="members">${memberCount} member${memberCount === 1 ? '' : 's'} already inside</p>

  <a href="${intentUrl}" class="btn btn-green">📱 Open in Bacchat</a>

  <p class="divider">or use the web version</p>

  <input id="nm" type="text" placeholder="Your name" autocomplete="off" />
  <button class="btn btn-outline" onclick="join()">Join in browser</button>
  <p id="msg" class="msg"></p>
  <p style="color:#666;font-size:11px;margin-top:14px">No install needed — view splits, add new ones, and settle right here.</p>
</div>
<script>
async function join(){
  const nm=document.getElementById('nm').value.trim();
  const msg=document.getElementById('msg');
  if(!nm){msg.className='msg err';msg.textContent='Please enter your name';return;}
  msg.className='msg';msg.textContent='Joining…';
  try{
    const r=await fetch('/invite/${inviteCode}/join?web=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nm}),credentials:'same-origin'});
    if(r.ok){
      const d=await r.json();
      // Backend has set the bacchat_jwt cookie when ?web=1 was passed.
      // Redirect into the server-rendered group view.
      window.location.href = '/g/' + d.group.id;
    } else {
      const d=await r.json();
      msg.className='msg err';msg.textContent=d.error||'Failed to join';
    }
  }catch(e){msg.className='msg err';msg.textContent='Network error, try again.';}
}
</script>
</body>
</html>`;
}

function _html404(code: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invite not found · Bacchat</title><style>body{font-family:system-ui;background:#111;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:32px}.card{max-width:380px}code{display:inline-block;background:#222;padding:3px 8px;border-radius:6px;font-size:11px;color:#888;margin-top:14px;word-break:break-all;max-width:100%}</style></head><body><div class="card"><p style="font-size:64px">🔗</p><h1 style="margin:16px 0 8px">Invite not found</h1><p style="color:#888">This link may have been generated by an older app build pointing at a different backend, or the group was deleted. Ask the group admin to share a fresh link.</p><code>${_esc(code)}</code></div></body></html>`;
}

/**
 * @openapi
 * /invite/{inviteCode}/join:
 *   post:
 *     tags:
 *       - Invites
 *     summary: Join a group via invite link (auth optional)
 *     parameters:
 *       - in: path
 *         name: inviteCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined group successfully
 *       400:
 *         description: Name required for guest join
 *       404:
 *         description: Invite code not found
 *       409:
 *         description: Already a member
 */
router.post(
  '/invite/:inviteCode/join',
  [body('name').optional().trim()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.params;

      const group = await prisma.splitGroup.findUnique({
        where: { inviteCode },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, isGuest: true } } },
          },
        },
      });

      if (!group) {
        res.status(404).json({ error: 'Invite code not found' });
        return;
      }

      // Resolve caller identity: try to decode auth header if present
      const authHeader = req.headers.authorization;
      let resolvedUserId: string | null = null;
      let isAuthenticated = false;

      if (authHeader?.startsWith('Bearer ')) {
        const decoded = verifyToken(authHeader.substring(7));
        if (decoded) {
          const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
          if (!revoked) {
            const exists = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (exists) {
              resolvedUserId = decoded.userId;
              isAuthenticated = true;
            }
          }
        }
      }

      let responseToken: string | null = null;
      let user: { id: string; name: string; email: string | null; avatarUrl: string | null; isGuest: boolean; createdAt: Date };

      if (isAuthenticated && resolvedUserId) {
        const alreadyMember = group.members.some((m) => m.userId === resolvedUserId);
        if (alreadyMember) {
          res.status(409).json({ error: 'You are already a member of this group' });
          return;
        }

        await prisma.groupMember.create({
          data: { groupId: group.id, userId: resolvedUserId, isAdmin: false },
        });

        const dbUser = await prisma.user.findUnique({ where: { id: resolvedUserId } });
        user = dbUser!;
        responseToken = null;
      } else {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
          res.status(400).json({ error: 'name is required for guest join' });
          return;
        }

        const guestUser = await prisma.user.create({
          data: { name: name.trim(), isGuest: true },
        });

        await prisma.groupMember.create({
          data: { groupId: group.id, userId: guestUser.id, isAdmin: false },
        });

        user = guestUser;
        responseToken = generateToken(guestUser.id, true);
        resolvedUserId = guestUser.id;
      }

      // Reload group with updated members
      const updatedGroup = await prisma.splitGroup.findUnique({
        where: { id: group.id },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, isGuest: true } } },
          },
        },
      });

      // Web-flow: caller appends ?web=1 so we know to drop an HttpOnly cookie.
      // The web routes (/g/*) read this cookie to authenticate without ever
      // exposing the JWT to client JS.
      const wantsCookie = req.query.web === '1' || req.query.web === 'true';
      if (wantsCookie && responseToken) {
        // For guests (responseToken is the freshly issued JWT) the lifetime
        // matches the JWT (7d). HttpOnly so document.cookie can't read it;
        // SameSite=Lax so a cross-site link click still carries it on the
        // subsequent same-origin navigations.
        res.cookie('bacchat_jwt', responseToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/',
        });
      }

      res.json({
        token: responseToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatarUrl,
          is_guest: user.isGuest,
          created_at: user.createdAt,
        },
        group: formatGroupDetail(updatedGroup!),
      });
    } catch (error) {
      console.error('Join group error:', error);
      res.status(500).json({ error: 'Failed to join group' });
    }
  }
);

export default router;

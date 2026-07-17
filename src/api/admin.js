const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_admin_key'; // Should be in .env

// 1. Initial Seed (Creates the first admin if none exists)
async function seedAdmin(prisma) {
  const adminCount = await prisma.superAdmin.count();
  if (adminCount === 0) {
    const hash = await bcrypt.hash('@1Noobjoreth#', 10);
    await prisma.superAdmin.create({
      data: { email: 'noobjoreth@gmail.com', password_hash: hash }
    });
    console.log('🌱 Seeded Initial Super Admin');
  }
}

// Pass prisma to the router via req
router.use((req, res, next) => {
  // Wait for seed on first request if needed, but usually done on boot
  next();
});

// 2. Login Endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = await req.prisma.superAdmin.findUnique({ where: { email } });
  
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, email: admin.email });
});

// Middleware to protect routes
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.adminId = decoded.id;
    next();
  });
};

// 3. Analytics & Global Filter (By Game Server / Kingdom Number)
router.get('/analytics', verifyToken, async (req, res) => {
  const { kingdom_number } = req.query;
  const filter = {};
  if (kingdom_number) {
    filter.kingdom_number = parseInt(kingdom_number);
  }

  const servers = await req.prisma.guildConfig.findMany({
    where: filter,
    include: { subscription: true, _count: { select: { members: true, events: true, nap_alliances: true } } }
  });

  const totalMembers = servers.reduce((acc, s) => acc + s._count.members, 0);
  const totalEvents = servers.reduce((acc, s) => acc + s._count.events, 0);
  const paidServers = servers.filter(s => s.subscription?.is_premium).length;
  const fraudServers = servers.filter(s => s.subscription?.payment_status === 'FRAUD').length;

  res.json({
    total_servers: servers.length,
    total_players: totalMembers,
    total_events: totalEvents,
    paid_servers: paidServers,
    fraud_servers: fraudServers,
    servers: servers
  });
});

// 3.5. Single Server Deep Dive
router.get('/server/:guild_id', verifyToken, async (req, res) => {
  const { guild_id } = req.params;
  const server = await req.prisma.guildConfig.findUnique({
    where: { guild_id },
    include: { 
      subscription: true,
      members: { orderBy: { activity_score: 'desc' }, take: 100 },
      nap_alliances: true,
      events: { orderBy: { scheduled_time: 'desc' }, take: 10 }
    }
  });
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server);
});

// 3.6 Get Feedbacks
router.get('/feedbacks', verifyToken, async (req, res) => {
  const feedbacks = await req.prisma.feedback.findMany({
    orderBy: { created_at: 'desc' },
    include: { guild: { select: { alliance_tag: true, kingdom_number: true } } }
  });
  res.json(feedbacks);
});

// 3.7 Resolve Feedback
router.put('/feedbacks/:id/resolve', verifyToken, async (req, res) => {
  try {
    const feedback = await req.prisma.feedback.update({
      where: { id: req.params.id },
      data: { is_resolved: true }
    });
    res.json(feedback);
  } catch(e) {
    res.status(500).json({ error: 'Failed to resolve' });
  }
});

// ==========================================
// NEW: ADVANCED BILLING & FRAUD SYSTEM
// ==========================================

// 4.1 Get All Plans
router.get('/plans', verifyToken, async (req, res) => {
  const plans = await req.prisma.subscriptionPlan.findMany({ orderBy: { created_at: 'asc' } });
  res.json(plans);
});

// 4.2 Create or Update Plan
router.post('/plans', verifyToken, async (req, res) => {
  const { id, name, price, billing_cycle, trial_days, features } = req.body;
  
  try {
    let plan;
    if (id) {
      plan = await req.prisma.subscriptionPlan.update({
        where: { id },
        data: { name, price: parseFloat(price), billing_cycle, trial_days: parseInt(trial_days), features }
      });
    } else {
      plan = await req.prisma.subscriptionPlan.create({
        data: { name, price: parseFloat(price), billing_cycle, trial_days: parseInt(trial_days), features }
      });
    }
    res.json(plan);
  } catch(e) {
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

// 4.3 Delete Plan
router.delete('/plans/:id', verifyToken, async (req, res) => {
  try {
    await req.prisma.subscriptionPlan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// 4.4 Get Payment History & Fraud
router.get('/payments', verifyToken, async (req, res) => {
  const payments = await req.prisma.paymentRecord.findMany({
    orderBy: { created_at: 'desc' },
    include: { plan: true }
  });
  res.json(payments);
});

// 4.5 Manually Log Payment or Fraud Attempt
router.post('/payments/log', verifyToken, async (req, res) => {
  const { guild_id, user_id, plan_id, amount_paid, payment_method, status, transaction_id, notes } = req.body;

  try {
    const record = await req.prisma.paymentRecord.create({
      data: {
        guild_id, user_id, plan_id, amount_paid: parseFloat(amount_paid), payment_method, status, transaction_id, notes
      }
    });

    // If it's a completed payment, update their Subscription status
    if (status === 'COMPLETED') {
      const plan = await req.prisma.subscriptionPlan.findUnique({ where: { id: plan_id } });
      let expires = new Date();
      if (plan.billing_cycle === 'MONTHLY') expires.setMonth(expires.getMonth() + 1);
      else if (plan.billing_cycle === 'YEARLY') expires.setFullYear(expires.getFullYear() + 1);
      else if (plan.billing_cycle === 'ONE_TIME') expires.setFullYear(expires.getFullYear() + 99); // practically lifetime
      
      await req.prisma.subscription.upsert({
        where: { guild_id },
        update: { is_premium: true, plan_id: plan.id, status: 'ACTIVE', trial_expires: expires },
        create: { guild_id, is_premium: true, plan_id: plan.id, status: 'ACTIVE', trial_expires: expires }
      });
    } else if (status === 'FRAUD_ATTEMPT') {
      // Lock them out immediately
      await req.prisma.subscription.upsert({
        where: { guild_id },
        update: { status: 'FRAUD', is_premium: false },
        create: { guild_id, status: 'FRAUD', is_premium: false }
      });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log payment' });
  }
});

// 4.6 Manual Subscription Override (Old compatibility / quick block)
router.put('/subscription/:guild_id', verifyToken, async (req, res) => {
  const { guild_id } = req.params;
  const { is_premium, status } = req.body;

  try {
    const sub = await req.prisma.subscription.upsert({
      where: { guild_id },
      update: { is_premium, status },
      create: { 
        guild_id, 
        is_premium, 
        status, 
        trial_expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// 5. Change Password
router.put('/password', verifyToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await req.prisma.superAdmin.update({
    where: { id: req.adminId },
    data: { password_hash: hash }
  });
  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { router, seedAdmin };

'use strict';

const express = require('express');
const router = express.Router();
const mainDb = require('../lib/mainDb');
const { adminAuthMiddleware } = require('../lib/adminAuth');

router.use(adminAuthMiddleware);

// ── 1. Aggregate Overview Stats ──────────────────────────────────────────────
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      vendorsRes,
      shopsRes,
      activeShopsRes,
      revenueRes,
      jobsRes,
      transfersRes,
      recentVendorsRes,
      personaRes,
      planRes,
    ] = await Promise.all([
      mainDb.query(`SELECT COUNT(*) AS count FROM vendors`),
      mainDb.query(`SELECT COUNT(*) AS count FROM printshop_settings`),
      mainDb.query(`SELECT COUNT(*) AS count FROM printshop_settings WHERE is_accepting = true`),
      mainDb.query(`SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(DISTINCT vendor_id) AS vendor_count FROM printshop_jobs WHERE payment_status = 'paid'`),
      mainDb.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE job_status = 'printed') AS printed, COUNT(*) FILTER (WHERE job_status = 'queued' OR job_status = 'pending') AS pending FROM printshop_jobs`),
      mainDb.query(`SELECT COUNT(*) AS count, COALESCE(SUM(file_size_bytes), 0) AS total_bytes FROM g2p_analytics_events`),
      mainDb.query(`SELECT id, name, share2me_id, persona, plan_type, created_at FROM vendors ORDER BY created_at DESC LIMIT 5`),
      mainDb.query(`SELECT persona, COUNT(*) AS count FROM vendors GROUP BY persona`),
      mainDb.query(`SELECT plan_type, COUNT(*) AS count FROM vendors GROUP BY plan_type`),
    ]);

    const totalVendors = parseInt(vendorsRes.rows[0].count, 10);
    const totalShops = parseInt(shopsRes.rows[0].count, 10);
    const activeShops = parseInt(activeShopsRes.rows[0].count, 10);
    const totalRevenue = parseFloat(revenueRes.rows[0].total);
    const vendorsWithRevenue = parseInt(revenueRes.rows[0].vendor_count, 10);
    const totalJobs = parseInt(jobsRes.rows[0].total, 10);
    const printedJobs = parseInt(jobsRes.rows[0].printed, 10);
    const pendingJobs = parseInt(jobsRes.rows[0].pending, 10);
    const totalTransfers = parseInt(transfersRes.rows[0].count, 10);
    const totalTransferBytes = parseInt(transfersRes.rows[0].total_bytes, 10);

    res.json({
      kpis: {
        totalVendors,
        totalShops,
        activeShops,
        totalRevenue,
        avgRevenuePerVendor: vendorsWithRevenue > 0 ? totalRevenue / vendorsWithRevenue : 0,
        totalJobs,
        printedJobs,
        pendingJobs,
        totalTransfers,
        totalTransferBytes,
      },
      breakdown: {
        persona: personaRes.rows,
        planType: planRes.rows,
      },
      recentVendors: recentVendorsRes.rows,
    });
  } catch (err) {
    console.error('[VendorsAPI] Failed to fetch overview stats:', err);
    res.status(500).json({ error: 'Failed to fetch vendor overview stats' });
  }
});

// ── 2. Revenue Analytics ─────────────────────────────────────────────────────
router.get('/stats/revenue', async (req, res) => {
  try {
    const [dailyRes, byTypeRes, byMethodRes, topVendorsRes] = await Promise.all([
      mainDb.query(`
        SELECT DATE(created_at) AS day, SUM(total_amount) AS revenue, COUNT(*) AS jobs
        FROM printshop_jobs WHERE payment_status = 'paid'
        GROUP BY DATE(created_at) ORDER BY day
      `),
      mainDb.query(`
        SELECT print_type, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
        FROM printshop_jobs GROUP BY print_type
      `),
      mainDb.query(`
        SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
        FROM printshop_jobs WHERE payment_status = 'paid' GROUP BY payment_method
      `),
      mainDb.query(`
        SELECT v.id, v.name, v.share2me_id, COUNT(pj.id) AS job_count, COALESCE(SUM(pj.total_amount), 0) AS total_revenue
        FROM vendors v
        LEFT JOIN printshop_jobs pj ON pj.vendor_id = v.id AND pj.payment_status = 'paid'
        GROUP BY v.id, v.name, v.share2me_id
        ORDER BY total_revenue DESC
        LIMIT 10
      `),
    ]);

    res.json({
      dailyRevenue: dailyRes.rows,
      byPrintType: byTypeRes.rows,
      byPaymentMethod: byMethodRes.rows,
      topVendors: topVendorsRes.rows,
    });
  } catch (err) {
    console.error('[VendorsAPI] Failed to fetch revenue stats:', err);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

// ── 3. Onboarding Funnel ─────────────────────────────────────────────────────
router.get('/stats/onboarding', async (req, res) => {
  try {
    const [totalRes, personaRes, shopRes, firstJobRes, paidRes, signupTrendRes] = await Promise.all([
      mainDb.query(`SELECT COUNT(*) AS count FROM vendors`),
      mainDb.query(`SELECT COUNT(*) AS count FROM vendors WHERE persona_selected = true`),
      mainDb.query(`SELECT COUNT(DISTINCT vendor_id) AS count FROM printshop_settings`),
      mainDb.query(`SELECT COUNT(DISTINCT vendor_id) AS count FROM printshop_jobs`),
      mainDb.query(`SELECT COUNT(DISTINCT vendor_id) AS count FROM printshop_jobs WHERE payment_status = 'paid'`),
      mainDb.query(`
        SELECT DATE(created_at) AS day, COUNT(*) AS signups
        FROM vendors GROUP BY DATE(created_at) ORDER BY day
      `),
    ]);

    res.json({
      funnel: {
        signedUp: parseInt(totalRes.rows[0].count, 10),
        personaSelected: parseInt(personaRes.rows[0].count, 10),
        shopCreated: parseInt(shopRes.rows[0].count, 10),
        firstJob: parseInt(firstJobRes.rows[0].count, 10),
        receivedPayment: parseInt(paidRes.rows[0].count, 10),
      },
      signupTrend: signupTrendRes.rows,
    });
  } catch (err) {
    console.error('[VendorsAPI] Failed to fetch onboarding stats:', err);
    res.status(500).json({ error: 'Failed to fetch onboarding funnel' });
  }
});

// ── 4. List All Vendors ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const vendorsRes = await mainDb.query(`
      SELECT 
        v.id, v.name, v.share2me_id, v.email, v.persona, v.persona_selected,
        v.plan_type, v.phone, v.company, v.created_at,
        v.stripe_account_id, v.charges_enabled, v.upi_id,
        ps.id AS shop_id, ps.is_accepting, ps.bw_price, ps.color_price, ps.location_name,
        COALESCE(job_stats.job_count, 0) AS job_count,
        COALESCE(job_stats.total_revenue, 0) AS total_revenue,
        COALESCE(job_stats.last_job_at, NULL) AS last_job_at,
        COALESCE(transfer_stats.transfer_count, 0) AS transfer_count
      FROM vendors v
      LEFT JOIN printshop_settings ps ON ps.vendor_id = v.id
      LEFT JOIN (
        SELECT vendor_id, COUNT(*) AS job_count, SUM(total_amount) AS total_revenue, MAX(created_at) AS last_job_at
        FROM printshop_jobs WHERE payment_status = 'paid'
        GROUP BY vendor_id
      ) job_stats ON job_stats.vendor_id = v.id
      LEFT JOIN (
        SELECT vendor_id::uuid, COUNT(*) AS transfer_count
        FROM g2p_analytics_events
        GROUP BY vendor_id
      ) transfer_stats ON transfer_stats.vendor_id = v.id
      ORDER BY v.created_at DESC
    `);

    res.json({ vendors: vendorsRes.rows });
  } catch (err) {
    console.error('[VendorsAPI] Failed to list vendors:', err);
    res.status(500).json({ error: 'Failed to list vendors' });
  }
});

// ── 5. Single Vendor Detail ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [vendorRes, shopRes, jobsRes, analyticsRes] = await Promise.all([
      mainDb.query(`SELECT * FROM vendors WHERE id = $1`, [id]),
      mainDb.query(`SELECT * FROM printshop_settings WHERE vendor_id = $1`, [id]),
      mainDb.query(`
        SELECT id, sender_name, document_name, pages, print_type, price_per_page,
               total_amount, payment_method, payment_status, job_status, created_at, printed_at
        FROM printshop_jobs WHERE vendor_id = $1
        ORDER BY created_at DESC LIMIT 50
      `, [id]),
      mainDb.query(`
        SELECT id, sender_name, event_type, file_size_bytes, file_type, file_name, created_at
        FROM g2p_analytics_events WHERE vendor_id = $1
        ORDER BY created_at DESC LIMIT 50
      `, [id]),
    ]);

    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json({
      vendor: vendorRes.rows[0],
      shop: shopRes.rows[0] || null,
      jobs: jobsRes.rows,
      analytics: analyticsRes.rows,
    });
  } catch (err) {
    console.error('[VendorsAPI] Failed to fetch vendor detail:', err);
    res.status(500).json({ error: 'Failed to fetch vendor details' });
  }
});

module.exports = router;

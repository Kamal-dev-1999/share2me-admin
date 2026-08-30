'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { adminAuthMiddleware } = require('../lib/adminAuth');

router.use(adminAuthMiddleware);

router.get('/stats', async (req, res) => {
  try {
    // Total Vendors
    const vendorsRes = await db.query(`SELECT COUNT(*) AS count FROM vendors`);
    const totalVendors = parseInt(vendorsRes.rows[0].count, 10);

    // Total Requests
    const requestsRes = await db.query(`SELECT COUNT(*) AS count FROM requests`);
    const totalRequests = parseInt(requestsRes.rows[0].count, 10);

    // Active Requests
    const activeRequestsRes = await db.query(`
      SELECT COUNT(*) AS count FROM requests 
      WHERE status IN ('pending', 'processing')
    `);
    const activeRequests = parseInt(activeRequestsRes.rows[0].count, 10);

    // Total Files
    const filesRes = await db.query(`SELECT COUNT(*) AS count FROM files`);
    const totalFiles = parseInt(filesRes.rows[0].count, 10);

    // Print Shop Jobs (Handle if table doesn't exist yet)
    let totalPrintJobs = 0;
    let totalRevenue = 0;
    let recentPrintJobs = [];
    try {
      const printJobsRes = await db.query(`
        SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_revenue 
        FROM printshop_jobs
      `);
      totalPrintJobs = parseInt(printJobsRes.rows[0].count, 10);
      totalRevenue = parseFloat(printJobsRes.rows[0].total_revenue);

      // Recent Print Jobs
      const recentPrintJobsRes = await db.query(`
        SELECT id, sender_name, document_name, total_amount, status, created_at 
        FROM printshop_jobs 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      recentPrintJobs = recentPrintJobsRes.rows;
    } catch (err) {
      console.warn('[AdminAPI] printshop_jobs table not found or error querying it:', err.message);
    }

    // Recent Vendors
    const recentVendorsRes = await db.query(`
      SELECT id, name, share2me_id AS email, created_at 
      FROM vendors 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    res.json({
      metrics: {
        totalVendors,
        totalRequests,
        activeRequests,
        totalFiles,
        totalPrintJobs,
        totalRevenue
      },
      recent: {
        vendors: recentVendorsRes.rows,
        printJobs: recentPrintJobs
      }
    });
  } catch (err) {
    console.error('[AdminAPI] Failed to fetch dashboard stats:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});

module.exports = router;

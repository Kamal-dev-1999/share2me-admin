'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/mainDb') || require('../lib/db');
const { adminAuthMiddleware } = require('../lib/adminAuth');

router.use(adminAuthMiddleware);

router.get('/stats', async (req, res) => {
  try {
    const [
      jobsSummaryRes,
      eventsSummaryRes,
      vendorsSummaryRes,
      recentTransfersRes,
      fileTypesRes,
      monthlyTrendRes,
      recentVendorsRes
    ] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) AS total_transfers,
          COALESCE(SUM(file_size_bytes), 0) AS total_bytes,
          COALESCE(SUM(pages), 0) AS total_pages,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS total_revenue,
          COUNT(*) FILTER (WHERE job_status = 'printed') AS printed_jobs,
          COUNT(*) FILTER (WHERE job_status = 'queued' OR job_status = 'pending') AS pending_jobs
        FROM printshop_jobs
      `).catch(() => ({ rows: [{ total_transfers: 0, total_bytes: 0, total_pages: 0, total_revenue: 0, printed_jobs: 0, pending_jobs: 0 }] })),
      db.query(`
        SELECT 
          COUNT(*) AS total_events,
          COUNT(*) FILTER (WHERE event_type = 'upload_received') AS total_uploads,
          COUNT(*) FILTER (WHERE event_type = 'file_downloaded') AS total_downloads,
          COUNT(*) FILTER (WHERE event_type = 'file_previewed') AS total_previews
        FROM g2p_analytics_events
      `).catch(() => ({ rows: [{ total_events: 0, total_uploads: 0, total_downloads: 0, total_previews: 0 }] })),
      db.query(`
        SELECT 
          COUNT(*) AS total_vendors,
          (SELECT COUNT(*) FROM printshop_settings WHERE is_accepting = true) AS active_shops,
          (SELECT COUNT(*) FROM printshop_settings) AS total_shops
        FROM vendors
      `).catch(() => ({ rows: [{ total_vendors: 0, active_shops: 0, total_shops: 0 }] })),
      db.query(`
        SELECT 
          id, 
          sender_name, 
          document_name, 
          file_size_bytes, 
          file_type, 
          pages, 
          total_amount, 
          payment_status, 
          job_status, 
          created_at
        FROM printshop_jobs 
        ORDER BY created_at DESC 
        LIMIT 10
      `).catch(() => ({ rows: [] })),
      db.query(`
        SELECT 
          file_type, 
          COUNT(*) AS count, 
          COALESCE(SUM(file_size_bytes), 0) AS bytes
        FROM printshop_jobs 
        GROUP BY file_type 
        ORDER BY count DESC 
        LIMIT 8
      `).catch(() => ({ rows: [] })),
      db.query(`
        SELECT 
          to_char(created_at, 'YYYY-MM') AS month,
          COUNT(*) AS count,
          COALESCE(SUM(file_size_bytes), 0) AS bytes,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS revenue
        FROM printshop_jobs
        GROUP BY to_char(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 6
      `).catch(() => ({ rows: [] })),
      db.query(`
        SELECT id, name, share2me_id AS email, created_at 
        FROM vendors 
        ORDER BY created_at DESC 
        LIMIT 5
      `).catch(() => ({ rows: [] }))
    ]);

    const jobs = jobsSummaryRes.rows[0];
    const events = eventsSummaryRes.rows[0];
    const vendors = vendorsSummaryRes.rows[0];

    const totalTransfers = parseInt(jobs.total_transfers, 10);
    const totalBytes = parseInt(jobs.total_bytes, 10);
    const totalRevenue = parseFloat(jobs.total_revenue);

    res.json({
      metrics: {
        totalVendors: parseInt(vendors.total_vendors, 10),
        totalTransfers,
        totalFiles: totalTransfers,
        totalPrintJobs: totalTransfers,
        totalBytes,
        totalPages: parseInt(jobs.total_pages, 10),
        totalRevenue,
        printedJobs: parseInt(jobs.printed_jobs, 10),
        pendingJobs: parseInt(jobs.pending_jobs, 10),
        activeShops: parseInt(vendors.active_shops, 10),
        totalShops: parseInt(vendors.total_shops, 10),
      },
      transfers: {
        totalCount: totalTransfers,
        totalBytes,
        totalPages: parseInt(jobs.total_pages, 10),
        totalRevenue,
        printedJobs: parseInt(jobs.printed_jobs, 10),
        pendingJobs: parseInt(jobs.pending_jobs, 10),
        totalUploadEvents: parseInt(events.total_uploads, 10),
        totalDownloadEvents: parseInt(events.total_downloads, 10),
        totalPreviewEvents: parseInt(events.total_previews, 10),
        totalVendors: parseInt(vendors.total_vendors, 10),
        activeShops: parseInt(vendors.active_shops, 10),
        totalShops: parseInt(vendors.total_shops, 10),
      },
      recentTransfers: recentTransfersRes.rows,
      fileTypes: fileTypesRes.rows,
      monthlyTrend: monthlyTrendRes.rows,
      recent: {
        vendors: recentVendorsRes.rows,
        printJobs: recentTransfersRes.rows.slice(0, 5),
      }
    });
  } catch (err) {
    console.error('[AdminAPI] Failed to fetch dashboard stats:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});

module.exports = router;

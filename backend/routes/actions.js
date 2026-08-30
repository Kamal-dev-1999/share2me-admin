'use strict';

const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../lib/adminAuth');
const db = require('../lib/db');

router.use(adminAuthMiddleware);

router.post('/trigger-github', async (req, res) => {
  try {
    const githubPat = process.env.GITHUB_PAT;
    
    if (!githubPat) {
      return res.status(400).json({ error: 'GITHUB_PAT is not configured in the admin backend.' });
    }

    const owner = process.env.GITHUB_OWNER || 'Kamal-dev-1999';
    const repo = process.env.GITHUB_REPO || 'share2me';
    const workflowId = 'auto-blog-cron.yml';
    
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

    const response = await fetch(githubUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubPat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main', // The branch to run the workflow on
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdminAPI] GitHub API error:', response.status, errorText);
      return res.status(response.status).json({ error: `GitHub API returned ${response.status}: ${errorText}` });
    }

    // Log the activity
    await db.query(
      `INSERT INTO admin_activity_logs (admin_email, action, blog_title, destination, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.adminEmail, 'TRIGGER_AUTO_BLOG', 'Auto Blog Generation', 'GitHub Actions', 'SUCCESS']
    );

    res.json({ message: 'GitHub Action triggered successfully.' });
  } catch (err) {
    console.error('[AdminAPI] Failed to trigger GitHub action:', err);
    res.status(500).json({ error: 'Internal server error while triggering GitHub action.' });
  }
});

module.exports = router;

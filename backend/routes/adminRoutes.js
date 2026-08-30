'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { adminAuthMiddleware, getAuthorizedAdminEmails } = require('../lib/adminAuth');
const { validateBlogSeo } = require('../lib/seoValidator');
const { publishBlog, logAdminActivity, TARGET_DESTINATIONS } = require('../lib/publisher');

const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Helper to convert S3 stream to string
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

// Configure S3 Client for Cloudflare R2 or AWS S3
let s3Client = null;
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}
const BUCKET_NAME = (process.env.S3_BLOGS_BUCKET || 'share2me-auto-blogs-prod').replace(/[^a-z0-9-]/g, '');

// Apply admin authorization middleware to ALL /api/admin routes
router.use(adminAuthMiddleware);

// ── 1. Check Auth & Admin Status ─────────────────────────────────────────────
router.get('/check-auth', (req, res) => {
  res.json({
    authorized: true,
    email: req.adminEmail,
    allowedAdmins: getAuthorizedAdminEmails(),
    destinations: TARGET_DESTINATIONS,
  });
});

// ── 2. List All Blogs (with Search & Status Filter) ───────────────────────────
router.get('/blogs', async (req, res) => {
  try {
    if (!s3Client) {
      return res.status(500).json({ error: 'S3 Client is not configured. Cannot list blogs.' });
    }

    const { status, search } = req.query;
    const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: 'blogs/' });
    const response = await s3Client.send(listCommand);
    
    let blogsList = [];

    if (response.Contents && response.Contents.length > 0) {
      const files = response.Contents.filter((obj) => obj.Key.endsWith('.json'));
      
      const blogsPromises = files.map(async (file) => {
        try {
          const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: file.Key });
          const objResponse = await s3Client.send(getCommand);
          const contentStr = await streamToString(objResponse.Body);
          const blogData = JSON.parse(contentStr);
          
          return {
            id: blogData.slug,
            slug: blogData.slug,
            title: blogData.title,
            category: blogData.category,
            status: blogData.status || 'published',
            updated_at: file.LastModified,
            destinations: blogData.destinations || [],
            records: (blogData.destinations || []).map(dest => ({
              destination: dest,
              status: blogData.status || 'published'
            }))
          };
        } catch (parseErr) {
          console.error(`[AdminS3] Failed to parse ${file.Key}:`, parseErr.message);
          return null;
        }
      });

      blogsList = (await Promise.all(blogsPromises)).filter(Boolean);
    }

    // Apply filtering
    if (status && status !== 'all') {
      blogsList = blogsList.filter(b => b.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      blogsList = blogsList.filter(b => 
        (b.title && b.title.toLowerCase().includes(q)) || 
        (b.slug && b.slug.toLowerCase().includes(q)) || 
        (b.category && b.category.toLowerCase().includes(q))
      );
    }

    // Sort by updated_at descending
    blogsList.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    res.json({ blogs: blogsList });
  } catch (err) {
    console.error('[AdminAPI] Failed to fetch blogs from S3:', err);
    res.status(500).json({ error: 'Failed to retrieve blogs from S3.' });
  }
});

// ── 3. Get Single Blog ────────────────────────────────────────────────────────
router.get('/blogs/:id', async (req, res) => {
  try {
    const slug = req.params.id; // slug is passed as id
    if (!s3Client) return res.status(500).json({ error: 'S3 Client not configured.' });

    try {
      const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: `blogs/${slug}.json` });
      const objResponse = await s3Client.send(getCommand);
      const contentStr = await streamToString(objResponse.Body);
      const blogData = JSON.parse(contentStr);

      // Map S3 JSON to admin format for the frontend editor
      const blog = {
        id: blogData.slug,
        title: blogData.title,
        slug: blogData.slug,
        meta_description: blogData.metaDescription || blogData.intro,
        keywords: blogData.keywords || [],
        author: blogData.author,
        featured_image: blogData.featuredImage,
        canonical_url: blogData.canonicalUrl,
        category: blogData.category,
        tags: blogData.tags || [],
        intro: blogData.intro,
        sections: blogData.sections || [],
        conclusion: blogData.conclusion || '',
        status: blogData.status || 'published',
      };

      res.json({
        blog,
        records: (blogData.destinations || []).map(dest => ({
          destination: dest,
          status: blogData.status || 'published'
        })),
        revisions: [] // Not supported with native S3
      });
    } catch (s3err) {
      if (s3err.name === 'NoSuchKey') {
        return res.status(404).json({ error: 'Blog not found.' });
      }
      throw s3err;
    }
  } catch (err) {
    console.error('[AdminAPI] Failed to fetch blog:', err);
    res.status(500).json({ error: 'Failed to fetch blog details.' });
  }
});

// ── 4. Save Draft ─────────────────────────────────────────────────────────────
router.post('/blogs/draft', async (req, res) => {
  try {
    const {
      id, // This is the old slug from the frontend
      title = 'Untitled Draft',
      slug,
      metaDescription = '',
      keywords = [],
      author = 'Share2Me Team',
      featuredImage = '',
      canonicalUrl = '',
      category = 'General',
      tags = [],
      intro = '',
      sections = [],
      conclusion = '',
      destinations = []
    } = req.body;

    if (!s3Client) return res.status(500).json({ error: 'S3 Client not configured.' });

    const draftSlug = (slug && slug.trim()) ? slug.trim().toLowerCase() : `draft-${Date.now()}`;

    // If the slug changed, delete the old file
    if (id && id !== draftSlug) {
      try {
        const deleteCommand = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: `blogs/${id}.json` });
        await s3Client.send(deleteCommand);
      } catch (e) {
        console.warn(`[AdminAPI] Failed to delete old draft file blogs/${id}.json:`, e.message);
      }
    }

    const blogJson = {
      title,
      slug: draftSlug,
      category,
      readTime: '5 min read',
      date: new Date().toISOString(),
      intro: intro || metaDescription,
      sections,
      conclusion,
      status: 'draft',
      metaDescription,
      keywords,
      author,
      featuredImage,
      canonicalUrl,
      tags,
      destinations
    };

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `blogs/${draftSlug}.json`,
      Body: JSON.stringify(blogJson),
      ContentType: 'application/json',
    });

    await s3Client.send(uploadCommand);

    await logAdminActivity({
      adminEmail: req.adminEmail,
      action: 'SAVE_DRAFT',
      blogTitle: title,
      status: 'SUCCESS',
    });

    res.json({ message: 'Draft saved successfully.', blog: { id: draftSlug, slug: draftSlug } });
  } catch (err) {
    console.error('[AdminAPI] Failed to save draft:', err);
    res.status(500).json({ error: `Failed to save draft: ${err.message}` });
  }
});

// ── 5. Run SEO Validation ──────────────────────────────────────────────────────
router.post('/blogs/validate-seo', (req, res) => {
  try {
    const body = req.body || {};
    const validation = validateBlogSeo(body);
    res.json(validation);
  } catch (err) {
    console.error('[AdminAPI] SEO validation error:', err);
    res.json({
      isValid: false,
      errors: [{ id: 'validation_error', message: 'SEO validation processing error: ' + err.message }],
      warnings: [],
      summary: { errorCount: 1, warningCount: 0 }
    });
  }
});

// ── 6. Publish Blog ───────────────────────────────────────────────────────────
router.post('/blogs/publish', async (req, res) => {
  try {
    const body = req.body || {};
    const { destinations = [], blogData = {} } = body;
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ error: 'Please select at least one publishing destination.' });
    }

    const publishResult = await publishBlog(destinations, blogData, req.adminEmail);
    res.json(publishResult);
  } catch (err) {
    console.error('[AdminAPI] Publishing failed:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── 7. Delete Blog ────────────────────────────────────────────────────────────
router.delete('/blogs/:id', async (req, res) => {
  try {
    const slug = req.params.id;
    if (!s3Client) return res.status(500).json({ error: 'S3 Client not configured.' });

    const deleteCommand = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: `blogs/${slug}.json` });
    await s3Client.send(deleteCommand);

    await logAdminActivity({
      adminEmail: req.adminEmail,
      action: 'DELETE_BLOG',
      blogTitle: slug,
      status: 'SUCCESS',
    });

    res.json({ message: 'Blog deleted successfully.' });
  } catch (err) {
    console.error('[AdminAPI] Failed to delete blog:', err);
    res.status(500).json({ error: 'Failed to delete blog.' });
  }
});

// ── 8. Duplicate Blog ─────────────────────────────────────────────────────────
router.post('/blogs/:id/duplicate', async (req, res) => {
  try {
    const slug = req.params.id;
    if (!s3Client) return res.status(500).json({ error: 'S3 Client not configured.' });

    try {
      const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: `blogs/${slug}.json` });
      const objResponse = await s3Client.send(getCommand);
      const contentStr = await streamToString(objResponse.Body);
      const orig = JSON.parse(contentStr);

      const newTitle = `${orig.title} (Copy)`;
      const newSlug = `${orig.slug}-copy-${Date.now().toString().slice(-4)}`;

      orig.title = newTitle;
      orig.slug = newSlug;
      orig.status = 'draft';

      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `blogs/${newSlug}.json`,
        Body: JSON.stringify(orig),
        ContentType: 'application/json',
      });

      await s3Client.send(uploadCommand);

      await logAdminActivity({
        adminEmail: req.adminEmail,
        action: 'DUPLICATE_BLOG',
        blogTitle: newTitle,
        status: 'SUCCESS',
      });

      res.json({ message: 'Blog duplicated successfully.', blog: { id: newSlug, slug: newSlug } });
    } catch (s3err) {
      if (s3err.name === 'NoSuchKey') {
        return res.status(404).json({ error: 'Blog not found.' });
      }
      throw s3err;
    }
  } catch (err) {
    console.error('[AdminAPI] Failed to duplicate blog:', err);
    res.status(500).json({ error: 'Failed to duplicate blog.' });
  }
});

// ── 9. Revisions History & Rollback ──────────────────────────────────────────
router.get('/blogs/:id/revisions', async (req, res) => {
  // Revisions are disabled in Native S3 mode
  res.json({ revisions: [] });
});

router.post('/blogs/:id/revisions/:version/restore', async (req, res) => {
  res.status(400).json({ error: 'Revisions are not supported when bypassing Postgres database.' });
});

// ── 10. Audit Activity Logs ───────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const logsRes = await db.query(
      `SELECT * FROM admin_activity_logs ORDER BY timestamp DESC LIMIT 100`
    );
    res.json({ logs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;

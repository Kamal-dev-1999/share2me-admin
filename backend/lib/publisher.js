'use strict';

const db = require('./db');
const { validateBlogSeo } = require('./seoValidator');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

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

const TARGET_DESTINATIONS = {
  share2me: {
    label: 'Share2Me (share2.me)',
    domain: 'https://share2.me',
    tokenEnv: 'SHARE2ME_DEPLOY_TOKEN',
  },
  share2me_in: {
    label: 'Share2Me India (share2me.in)',
    domain: 'https://share2me.in',
    tokenEnv: 'SHARE2ME_IN_DEPLOY_TOKEN',
  },
};

async function logAdminActivity({ adminEmail, action, blogTitle, destination, status, errorDetails }) {
  try {
    await db.query(
      `INSERT INTO admin_activity_logs (admin_email, action, blog_title, destination, status, error_details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminEmail, action, blogTitle || 'Untitled', destination || 'N/A', status, errorDetails || null]
    );
  } catch (err) {
    console.error('[AdminLog] Failed to record activity log:', err.message);
  }
}

async function publishSingleDestination(destinationKey, blogData, adminEmail) {
  const targetConfig = TARGET_DESTINATIONS[destinationKey];
  if (!targetConfig) {
    throw new Error(`Unknown publishing destination: "${destinationKey}"`);
  }

  const deployToken = process.env[targetConfig.tokenEnv] || 'default_server_deploy_token';
  const publishedUrl = `${targetConfig.domain}/blog/${blogData.slug}`;

  // 1. Direct Upload to S3/R2
  if (s3Client) {
    try {
      const blogJson = {
        title: blogData.title,
        category: blogData.category || 'General',
        readTime: '5 min read',
        date: new Date().toISOString(),
        intro: blogData.intro || blogData.metaDescription || 'A brief introduction to the article.',
        sections: blogData.sections || [],
        conclusion: blogData.conclusion || '',
        status: 'published',
        metaDescription: blogData.metaDescription,
        keywords: blogData.keywords,
        author: blogData.author,
        featuredImage: blogData.featuredImage,
        canonicalUrl: blogData.canonicalUrl,
        slug: blogData.slug,
        destinations: blogData.destinations || [] // track where it was published
      };

      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `blogs/${blogData.slug}.json`,
        Body: JSON.stringify(blogJson),
        ContentType: 'application/json',
      });

      await s3Client.send(uploadCommand);
      console.log(`[Publish:${destinationKey}] Successfully uploaded ${blogData.slug}.json to S3/R2`);
    } catch (err) {
      console.error(`[Publish:${destinationKey}] Direct S3/R2 upload failed:`, err.message);
      throw new Error(`S3 Upload failed: ${err.message}`);
    }
  } else {
    throw new Error(`[Publish:${destinationKey}] S3 Client is not configured. Cannot publish.`);
  }

  // 2. Perform backend deployment API ping / webhook trigger if webhook URL is configured
  const webhookUrlEnv = `DEPLOY_WEBHOOK_${destinationKey.toUpperCase()}`;
  const webhookUrl = process.env[webhookUrlEnv];

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deployToken}`,
        },
        body: JSON.stringify({
          action: 'PUBLISH_BLOG',
          slug: blogData.slug,
          title: blogData.title,
          url: publishedUrl,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Deployment server returned status ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      console.error(`[Publish:${destinationKey}] Deployment webhook failed:`, err.message);
    }
  }

  await logAdminActivity({
    adminEmail,
    action: 'PUBLISH_BLOG',
    blogTitle: blogData.title,
    destination: targetConfig.label,
    status: 'SUCCESS',
  });

  return {
    destination: destinationKey,
    label: targetConfig.label,
    status: 'published',
    url: publishedUrl,
  };
}

async function publishBlog(destinations, blogData, adminEmail) {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('At least one publishing destination must be selected (e.g. "share2me" or "share2me_in").');
  }

  // 1. Run SEO validation
  const validation = validateBlogSeo(blogData);
  if (!validation.isValid) {
    const errorMsgs = validation.errors.map((e) => e.message).join(' ');
    throw new Error(`SEO Validation Failed: ${errorMsgs}`);
  }

  // Set destinations property on blogData so it gets saved to S3
  blogData.destinations = destinations;
  // Ensure slug exists
  const oldSlug = blogData.id;
  if (!blogData.slug || !blogData.slug.trim()) {
    blogData.slug = `blog-${Date.now()}`;
  } else {
    blogData.slug = blogData.slug.trim().toLowerCase();
  }

  if (oldSlug && oldSlug !== blogData.slug && s3Client) {
    try {
      const deleteCommand = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: `blogs/${oldSlug}.json` });
      await s3Client.send(deleteCommand);
    } catch (e) {
      console.warn(`[Publishing] Failed to delete old blog file blogs/${oldSlug}.json:`, e.message);
    }
  }

  // 2. Publish to each selected target destination
  const results = [];
  const failures = [];

  for (const dest of destinations) {
    try {
      const res = await publishSingleDestination(dest, blogData, adminEmail);
      results.push(res);
    } catch (err) {
      console.error(`[Publishing] Failed to publish to ${dest}:`, err.message);
      failures.push({
        destination: dest,
        label: TARGET_DESTINATIONS[dest]?.label || dest,
        status: 'failed',
        error: err.message,
      });

      await logAdminActivity({
        adminEmail,
        action: 'PUBLISH_BLOG',
        blogTitle: blogData.title,
        destination: dest,
        status: 'FAILED',
        errorDetails: err.message,
      });
    }
  }

  return {
    blog: blogData,
    results,
    failures,
    hasFailures: failures.length > 0,
  };
}

module.exports = {
  publishBlog,
  logAdminActivity,
  TARGET_DESTINATIONS,
};

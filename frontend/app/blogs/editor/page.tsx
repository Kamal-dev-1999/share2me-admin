"use strict";
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Save, Send, Sparkles, Check, AlertCircle,
  Globe, X, ChevronDown, ChevronUp, PlusCircle, Trash2, List, Code
} from "lucide-react";

import { SeoCheckPanel, SeoValidationResult } from "@/components/admin/SeoCheckPanel";

function BlogEditorContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const blogId = searchParams?.get("id") || "";

  // Blog Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [author, setAuthor] = useState("Share2Me Team");
  const [featuredImage, setFeaturedImage] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [category, setCategory] = useState("Technology");
  const [tags, setTags] = useState("WebRTC, P2P, Security");
  
  // Structured Content State
  const [intro, setIntro] = useState("");
  const [sections, setSections] = useState([{ heading: "", content: "", bullets: [""] }]);
  const [conclusion, setConclusion] = useState("");

  // Target Destination Checklist
  const [targets, setTargets] = useState<{ share2me: boolean; share2me_in: boolean }>({
    share2me: true,
    share2me_in: true,
  });

  // UI state
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [seoResult, setSeoResult] = useState<SeoValidationResult | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishingProgress, setPublishingProgress] = useState<any[]>([]);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load existing blog if editing
  useEffect(() => {
    if (blogId && session?.user?.email) {
      setLoading(true);
      fetch(`/api/admin/blogs/${blogId}`, {
        headers: { "X-Admin-Email": session.user.email },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.blog) {
            const b = data.blog;
            setTitle(b.title || "");
            setSlug(b.slug || "");
            setMetaDescription(b.meta_description || "");
            setKeywords(Array.isArray(b.keywords) ? b.keywords.join(", ") : b.keywords || "");
            setAuthor(b.author || "Share2Me Team");
            setFeaturedImage(b.featured_image || "");
            setCanonicalUrl(b.canonical_url || "");
            setCategory(b.category || "Technology");
            setTags(Array.isArray(b.tags) ? b.tags.join(", ") : b.tags || "");
            setIntro(b.intro || "");
            setSections(b.sections?.length > 0 ? b.sections : [{ heading: "", content: "", bullets: [] }]);
            setConclusion(b.conclusion || "");
          }
        })
        .catch((err) => console.error("Error fetching blog:", err))
        .finally(() => setLoading(false));
    }
  }, [blogId, session]);

  // Auto-generate slug from title if empty
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!blogId && (!slug || slug.startsWith("draft-"))) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
      setSlug(generated);
    }
  };

  // Instant Local Client-Side SEO Validation
  const runLocalSeoValidation = (
    currentTitle: string,
    currentSlug: string,
    currentMetaDesc: string,
    currentCanonical: string,
    currentImage: string
  ) => {
    const errors: { id: string; message: string }[] = [];
    const warnings: { id: string; message: string }[] = [];

    const t = (currentTitle || "").trim();
    const s = (currentSlug || "").trim();
    const md = (currentMetaDesc || "").trim();
    const c = (currentCanonical || "").trim();
    const img = (currentImage || "").trim();

    if (!t) errors.push({ id: "title_missing", message: "Blog Title is required." });
    else if (t.length < 30) warnings.push({ id: "title_short", message: "Title is too short. Aim for 50-60 chars for SEO." });
    
    if (!s) errors.push({ id: "slug_missing", message: "Blog Slug is required." });
    else if (s.length < 5) warnings.push({ id: "slug_short", message: "Slug is very short." });

    if (!md) errors.push({ id: "meta_desc_missing", message: "Meta description is missing." });
    else if (md.length < 100) warnings.push({ id: "meta_desc_short", message: "Meta description is too short (aim for 120-160 chars)." });

    if (!c) warnings.push({ id: "canonical_missing", message: "Canonical URL missing." });
    if (!img) warnings.push({ id: "featured_image_missing", message: "Featured Image URL is missing." });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    };
  };

  useEffect(() => {
    const localVal = runLocalSeoValidation(title, slug, metaDescription, canonicalUrl, featuredImage);
    setSeoResult(localVal);
  }, [title, slug, metaDescription, canonicalUrl, featuredImage]);

  // Section Management
  const addSection = () => {
    setSections([...sections, { heading: "", content: "", bullets: [""] }]);
  };

  const removeSection = (index: number) => {
    if (sections.length > 1) {
      setSections(sections.filter((_, i) => i !== index));
    }
  };

  const updateSection = (index: number, field: string, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const updateBullet = (sectionIndex: number, bulletIndex: number, value: string) => {
    const updated = [...sections];
    const newBullets = [...(updated[sectionIndex].bullets || [])];
    newBullets[bulletIndex] = value;
    updated[sectionIndex].bullets = newBullets;
    setSections(updated);
  };

  const addBullet = (sectionIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].bullets = [...(updated[sectionIndex].bullets || []), ""];
    setSections(updated);
  };

  const removeBullet = (sectionIndex: number, bulletIndex: number) => {
    const updated = [...sections];
    const newBullets = updated[sectionIndex].bullets.filter((_, i) => i !== bulletIndex);
    updated[sectionIndex].bullets = newBullets;
    setSections(updated);
  };

  // --- SAVE DRAFT ---
  const handleSaveDraft = async () => {
    if (!title.trim() && !intro.trim()) {
      setErrorMessage("Please enter at least a title or intro to save a draft.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/admin/blogs/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": session?.user?.email || "",
        },
        body: JSON.stringify({
          id: blogId, 
          title,
          slug,
          metaDescription,
          keywords: keywords.split(",").map((k) => k.trim()),
          author,
          featuredImage,
          canonicalUrl,
          category,
          intro,
          sections,
          conclusion,
          tags: tags.split(",").map(t => t.trim()),
          destinations: Object.keys(targets).filter((key) => targets[key as keyof typeof targets]),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setErrorMessage("Draft saved successfully!");
        if (data.blog?.id && !blogId) {
          router.replace(`/blogs/editor?id=${data.blog.id}`);
        }
        setTimeout(() => setErrorMessage(""), 3000);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to save draft");
      }
    } catch (err) {
      setErrorMessage("Network error while saving draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  // --- PUBLISH ---
  const handlePublishClick = () => {
    setPublishModalOpen(true);
    setPublishingProgress([]);
    setPublishSuccess(false);
  };

  const confirmPublish = async () => {
    if (!session?.user?.email) return;

    if (!title.trim() || !slug.trim()) {
      setPublishingProgress([{ destination: "System", label: "Validation", status: "failed", error: "Title and slug are required." }]);
      return;
    }

    const pubDestinations = Object.keys(targets).filter((key) => targets[key as keyof typeof targets]);
    if (pubDestinations.length === 0) {
      setPublishingProgress([{ destination: "System", label: "Validation", status: "failed", error: "Select at least one destination." }]);
      return;
    }

    setPublishingProgress(pubDestinations.map((d) => ({ destination: d, label: d, status: "pending" })));

    try {
      const res = await fetch(`/api/admin/blogs/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Email": session?.user?.email },
        body: JSON.stringify({
          destinations: pubDestinations,
          blogData: {
            id: blogId,
            title,
            slug,
            metaDescription,
            keywords: keywords.split(",").map((k) => k.trim()),
            author,
            featuredImage,
            canonicalUrl,
            category,
            intro,
            sections,
            conclusion,
            tags: tags.split(",").map(t => t.trim()),
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const progress = data.results.map((r: any) => ({
          destination: r.destination,
          label: r.label,
          status: r.status,
          url: r.url,
        }));
        if (data.failures && data.failures.length > 0) {
          data.failures.forEach((f: any) => {
            progress.push({
              destination: f.destination,
              label: f.label,
              status: f.status,
              error: f.error,
            });
          });
        }
        setPublishingProgress(progress);
        if (!data.hasFailures) setPublishSuccess(true);
      } else {
        setPublishingProgress([{ destination: "System", label: "API Error", status: "failed", error: data.error || "Unknown Error" }]);
      }
    } catch (err) {
      setPublishingProgress([{ destination: "System", label: "Network", status: "failed", error: "Network error occurred." }]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto font-sans flex flex-col gap-6 bg-[#f4f1f8] min-h-screen">
      {/* ── 1. Top Navigation Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between sticky top-0 z-40 bg-[#f4f1f8]/95 backdrop-blur-xl py-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-purple-100">
        <div className="flex items-center gap-4">
          <Link href="/blogs" className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 shadow-sm transition-all text-[#0f1015]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-[#0f1015] flex items-center gap-3">
            {blogId ? "Edit Blog" : "Create New Blog"}
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Draft</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveDraft} disabled={savingDraft} className="bg-white border-2 border-slate-200 text-[#0f1015] font-bold px-6 py-2.5 rounded-full hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
            {savingDraft ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Save Draft</span>
          </button>
          <button onClick={handlePublishClick} className="bg-[#0f1015] text-white font-black px-6 py-2.5 rounded-full hover:bg-[#1f232c] hover:scale-105 transition-all shadow-[0_4px_20px_rgba(15,16,21,0.2)] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#fcd535]" />
            <span className="hidden sm:inline">Publish Blog</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-medium">
          {errorMessage}
        </div>
      )}

      {/* ── 2. Primary Inputs (Title & Slug) ───────────────────────────────── */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blog Title <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. How to Transfer Files Peer-to-Peer in the Browser" className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full px-6 py-4 outline-none font-bold text-[#0f1015] text-lg transition-all shadow-sm placeholder:text-slate-400 placeholder:font-medium" />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blog Slug <span className="text-red-500">*</span></label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="/blog/how-to-transfer-files-p2p" className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-full px-6 py-4 outline-none font-mono text-sm text-[#0f1015] transition-all shadow-inner" />
        </div>
      </div>

      {/* ── 3. SEO Metadata Accordion ──────────────────────────────────────── */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <button onClick={() => setMetaExpanded(!metaExpanded)} className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="font-black text-[#0f1015] text-lg tracking-tight">SEO & Metadata Options</span>
          </div>
          {metaExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {metaExpanded && (
          <div className="p-6 md:p-8 pt-0 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-600">Meta Description</label>
              <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 outline-none focus:border-purple-500 transition-all resize-none text-sm shadow-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">Keywords (Comma Separated)</label>
              <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="w-full bg-white border border-slate-200 rounded-full px-5 py-3 outline-none focus:border-purple-500 transition-all text-sm shadow-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600">Category</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-white border border-slate-200 rounded-full px-5 py-3 outline-none focus:border-purple-500 transition-all text-sm shadow-sm" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-600">Featured Image URL</label>
              <input type="text" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} className="w-full bg-white border border-slate-200 rounded-full px-5 py-3 outline-none focus:border-purple-500 transition-all font-mono text-xs shadow-sm" />
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Main Editor Workspace (Structured Content) ──────────────────── */}
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Left Column: Editor */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-purple-200">
            <h2 className="text-sm font-black text-purple-900 tracking-widest uppercase flex items-center gap-2">
              <Code className="w-4 h-4" />
              Structured Blog Content
            </h2>
          </div>

          {/* Intro Section */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-2">Introduction</label>
            <textarea 
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Write a compelling introduction. Include markdown images if needed: ![Alt Text](https://...)"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:border-purple-500 transition-all min-h-[120px] text-[15px] leading-relaxed"
            />
          </div>

          {/* Dynamic Sections */}
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative group">
              <button 
                onClick={() => removeSection(index)}
                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove Section"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Section {index + 1} Heading</label>
                  <input 
                    type="text"
                    value={section.heading}
                    onChange={(e) => updateSection(index, 'heading', e.target.value)}
                    placeholder="e.g. Understanding WebRTC"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-purple-500 font-bold text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Body Content</label>
                  <textarea 
                    value={section.content}
                    onChange={(e) => updateSection(index, 'content', e.target.value)}
                    placeholder="Deep dive content for this section..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-purple-500 min-h-[150px]"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    <List className="w-4 h-4" /> Bullet Points
                  </label>
                  <div className="space-y-2">
                    {section.bullets.map((bullet, bidx) => (
                      <div key={bidx} className="flex gap-2 items-start">
                        <span className="text-slate-300 mt-2">•</span>
                        <input 
                          type="text"
                          value={bullet}
                          onChange={(e) => updateBullet(index, bidx, e.target.value)}
                          placeholder="Bullet point text..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                        />
                        <button 
                          onClick={() => removeBullet(index, bidx)}
                          className="text-slate-400 hover:text-red-500 mt-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => addBullet(index)}
                    className="mt-3 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 flex items-center gap-1 transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" /> Add Bullet
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button 
            onClick={addSection}
            className="w-full py-4 border-2 border-dashed border-purple-200 rounded-3xl text-purple-600 font-bold hover:bg-purple-50 hover:border-purple-300 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Add New Section
          </button>

          {/* Conclusion Section */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-2">Conclusion</label>
            <textarea 
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="Wrap up the article with a strong conclusion..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:border-purple-500 transition-all min-h-[100px] text-[15px]"
            />
          </div>

        </div>

        {/* Right Column: SEO Check & Meta */}
        <div className="xl:w-[420px] shrink-0 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-purple-200">
            <h2 className="text-sm font-black text-purple-900 tracking-widest uppercase flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              SEO Score
            </h2>
          </div>
          
          <SeoCheckPanel validationResult={seoResult} />
        </div>
      </div>

      {/* ── Publish Modal Overlay ───────────────────────────────────────────── */}
      {mounted && publishModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-[#fcd535] to-purple-600"></div>
            
            {!publishSuccess && publishingProgress.length === 0 && (
              <>
                <button onClick={() => setPublishModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black bg-slate-100 p-2 rounded-full">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-black text-[#0f1015] mb-2 flex items-center gap-2">
                  <Globe className="w-6 h-6 text-purple-600" /> Choose Destinations
                </h3>
                <p className="text-slate-500 mb-8 text-sm font-medium">Select which domains this article should be pushed to.</p>

                <div className="space-y-4 mb-8">
                  {Object.keys(targets).map((key) => (
                    <label key={key} className="flex items-center justify-between p-5 border-2 border-slate-100 rounded-2xl cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${targets[key as keyof typeof targets] ? 'bg-purple-600' : 'bg-slate-200'}`}>
                          {targets[key as keyof typeof targets] && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <span className="font-bold text-[#0f1015]">{key === "share2me" ? "Share2Me Global" : "Share2Me India"}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-400 font-mono">{key === "share2me" ? "share2.me" : "share2me.in"}</span>
                      <input type="checkbox" className="hidden" checked={targets[key as keyof typeof targets]} onChange={(e) => setTargets({...targets, [key]: e.target.checked})} />
                    </label>
                  ))}
                </div>

                <button onClick={confirmPublish} className="w-full bg-[#0f1015] text-white font-black py-4 rounded-full text-lg shadow-[0_8px_30px_rgba(15,16,21,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                  Launch Article <Send className="w-5 h-5 text-[#fcd535]" />
                </button>
              </>
            )}

            {publishingProgress.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-black text-[#0f1015] text-center mb-6">
                  {publishSuccess ? "Launch Successful! 🚀" : "Deploying..."}
                </h3>
                
                <div className="space-y-3">
                  {publishingProgress.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="font-bold text-slate-700">{p.label}</span>
                      {p.status === "pending" && <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>}
                      {p.status === "published" && <Check className="w-5 h-5 text-emerald-500" />}
                      {p.status === "failed" && <AlertCircle className="w-5 h-5 text-red-500" />}
                    </div>
                  ))}
                </div>

                {publishSuccess && (
                  <button onClick={() => { setPublishModalOpen(false); router.push("/blogs"); }} className="w-full mt-6 bg-slate-100 text-slate-700 font-bold py-4 rounded-full hover:bg-slate-200 transition-all">
                    Return to Dashboard
                  </button>
                )}
                {!publishSuccess && publishingProgress.some(p => p.status === "failed") && (
                  <button onClick={() => { setPublishingProgress([]); }} className="w-full mt-6 bg-red-100 text-red-700 font-bold py-4 rounded-full hover:bg-red-200 transition-all">
                    Acknowledge Error & Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default function AdminBlogEditorPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-slate-400">Loading editor workspace...</div>}>
      <BlogEditorContent />
    </Suspense>
  );
}

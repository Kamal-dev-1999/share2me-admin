"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Store, Users, IndianRupee, Printer, FileUp, TrendingUp,
  Search, ArrowUpRight, ShieldCheck, ShieldAlert, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

const PURPLE = "#9333ea";
const GOLD = "#fcd535";
const DARK = "#0f1015";
const CHART_COLORS = ["#9333ea", "#fcd535", "#22c55e", "#3b82f6", "#ef4444", "#f97316"];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function VendorsPage() {
  const { data: session } = useSession();
  const [overview, setOverview] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");

  useEffect(() => {
    if (!session?.user?.email) return;
    const headers = { "X-Admin-Email": session.user.email };

    Promise.all([
      fetch("/api/admin/vendors/stats/overview", { headers }).then(r => r.json()),
      fetch("/api/admin/vendors/stats/revenue", { headers }).then(r => r.json()),
      fetch("/api/admin/vendors/stats/onboarding", { headers }).then(r => r.json()),
      fetch("/api/admin/vendors", { headers }).then(r => r.json()),
    ])
      .then(([ov, rev, onb, vnd]) => {
        setOverview(ov);
        setRevenue(rev);
        setOnboarding(onb);
        setVendors(vnd.vendors || []);
      })
      .catch(err => console.error("Error fetching vendor data:", err))
      .finally(() => setLoading(false));
  }, [session]);

  const filteredVendors = vendors
    .filter(v => {
      const q = search.toLowerCase();
      return !q || v.name?.toLowerCase().includes(q) || v.share2me_id?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "revenue") return (b.total_revenue || 0) - (a.total_revenue || 0);
      if (sortBy === "jobs") return (b.job_count || 0) - (a.job_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = overview?.kpis || {};
  const funnel = onboarding?.funnel || {};

  const funnelSteps = [
    { label: "Signed Up", value: funnel.signedUp || 0, color: "#9333ea" },
    { label: "Persona Selected", value: funnel.personaSelected || 0, color: "#7c3aed" },
    { label: "Shop Created", value: funnel.shopCreated || 0, color: "#6d28d9" },
    { label: "First Job", value: funnel.firstJob || 0, color: "#5b21b6" },
    { label: "Received Payment", value: funnel.receivedPayment || 0, color: "#4c1d95" },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-[1600px] mx-auto font-sans">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#0f1015] tracking-tight flex items-center gap-3">
            <Store className="w-8 h-8 text-purple-600" />
            <span>Vendor Monitoring</span>
          </h1>
          <p className="text-sm font-medium text-[#64748b] mt-1">
            End-to-end vendor lifecycle, revenue analytics &amp; onboarding insights
          </p>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Total Vendors", value: kpis.totalVendors, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Active Shops", value: `${kpis.activeShops}/${kpis.totalShops}`, icon: Store, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Revenue", value: formatCurrency(kpis.totalRevenue || 0), icon: IndianRupee, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Print Jobs", value: kpis.totalJobs, icon: Printer, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "File Transfers", value: kpis.totalTransfers, icon: FileUp, color: "text-pink-600", bg: "bg-pink-50" },
          { label: "Avg Rev/Vendor", value: formatCurrency(kpis.avgRevenuePerVendor || 0), icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center mb-3`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-[#0f1015]">{kpi.value}</div>
            <div className="text-xs font-bold text-[#64748b] mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider mb-4 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-purple-600" /> Daily Revenue
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue?.dailyRevenue || []}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PURPLE} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(value: any) => [`₹${String(value)}`, "Revenue"]} labelFormatter={(v: any) => new Date(String(v)).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
                <Area type="monotone" dataKey="revenue" stroke={PURPLE} fill="url(#revenueGradient)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Print Type & Payment Method Pie Charts */}
        <div className="grid grid-rows-2 gap-6">
          <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-600" /> Jobs by Print Type
            </h3>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenue?.byPrintType || []} dataKey="count" nameKey="print_type" cx="50%" cy="50%" outerRadius={40} label={({ print_type, count }: any) => `${print_type}: ${count}`}>
                    {(revenue?.byPrintType || []).map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider mb-2 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" /> Payment Methods
            </h3>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenue?.byPaymentMethod || []} dataKey="count" nameKey="payment_method" cx="50%" cy="50%" outerRadius={40} label={({ payment_method, count }: any) => `${payment_method}: ${count}`}>
                    {(revenue?.byPaymentMethod || []).map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onboarding Funnel ────────────────────────────────────────────── */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600" /> Vendor Onboarding Funnel
        </h3>
        <div className="flex items-end gap-2 justify-between">
          {funnelSteps.map((step, i) => {
            const maxVal = funnelSteps[0].value || 1;
            const pct = Math.round((step.value / maxVal) * 100);
            const barHeight = Math.max(40, (step.value / maxVal) * 200);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-2xl font-black text-[#0f1015]">{step.value}</span>
                <div className="w-full rounded-xl transition-all" style={{ height: barHeight, backgroundColor: step.color, opacity: 0.85 }} />
                <span className="text-[10px] font-bold text-[#64748b] text-center leading-tight">{step.label}</span>
                {i > 0 && <span className="text-[10px] font-bold text-purple-600">{pct}%</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Vendors Table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" /> All Vendors ({filteredVendors.length})
          </h3>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-[#64748b] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, ID, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm outline-none focus:border-purple-400"
              />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 pr-8 text-xs font-bold outline-none focus:border-purple-400"
              >
                <option value="created_at">Newest First</option>
                <option value="revenue">Top Revenue</option>
                <option value="jobs">Most Jobs</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Persona</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shop</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jobs</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transfers</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((v) => (
                <tr key={v.id} className="border-t border-slate-50 hover:bg-purple-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#0f1015]">{v.name}</div>
                    {v.email && <div className="text-xs text-slate-400">{v.email}</div>}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg font-bold">{v.share2me_id}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${v.persona === 'BUSINESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {v.persona || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {v.shop_id ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${v.is_accepting ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {v.is_accepting ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {v.is_accepting ? "Online" : "Offline"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 font-bold">No Shop</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-[#0f1015]">{v.job_count || 0}</td>
                  <td className="px-4 py-4 text-right font-bold text-emerald-600">{formatCurrency(v.total_revenue || 0)}</td>
                  <td className="px-4 py-4 text-right font-bold text-[#0f1015]">{v.transfer_count || 0}</td>
                  <td className="px-4 py-4 text-xs text-slate-400 font-medium">
                    {new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/vendors/${v.id}`} className="w-8 h-8 bg-slate-100 hover:bg-purple-100 rounded-full flex items-center justify-center transition-colors">
                      <ArrowUpRight className="w-4 h-4 text-slate-500" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVendors.length === 0 && (
          <div className="p-12 text-center text-slate-400 font-bold text-sm">
            No vendors found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}

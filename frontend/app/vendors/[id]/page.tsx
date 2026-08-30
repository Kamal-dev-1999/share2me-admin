"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, User, Store, Printer, FileUp, IndianRupee,
  MapPin, Phone, Mail, Globe, CreditCard, ShieldCheck, ShieldAlert,
  Clock, Check, AlertCircle, XCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: any }> = {
    printed: { bg: "bg-emerald-100", text: "text-emerald-700", icon: Check },
    paid: { bg: "bg-emerald-100", text: "text-emerald-700", icon: Check },
    queued: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
    pending: { bg: "bg-slate-100", text: "text-slate-600", icon: Clock },
    failed: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  };
  const style = map[status] || map.pending;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
}

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email || !id) return;
    fetch(`/api/admin/vendors/${id}`, {
      headers: { "X-Admin-Email": session.user.email },
    })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(err => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [id, session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.vendor) {
    return (
      <div className="p-10 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#0f1015]">Vendor Not Found</h2>
        <Link href="/vendors" className="text-purple-600 font-bold text-sm mt-4 inline-block hover:underline">← Back to Vendors</Link>
      </div>
    );
  }

  const { vendor, shop, jobs, analytics } = data;

  // Revenue chart data from jobs
  const revenueByDay: Record<string, number> = {};
  (jobs || []).forEach((j: any) => {
    if (j.payment_status === "paid" || j.job_status === "printed") {
      const day = new Date(j.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(j.total_amount || 0);
    }
  });
  const revenueChartData = Object.entries(revenueByDay).map(([day, revenue]) => ({ day, revenue }));

  const totalRevenue = (jobs || []).filter((j: any) => j.payment_status === "paid").reduce((sum: number, j: any) => sum + parseFloat(j.total_amount || 0), 0);
  const totalJobs = (jobs || []).length;
  const printedJobs = (jobs || []).filter((j: any) => j.job_status === "printed").length;

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-[1400px] mx-auto font-sans">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/vendors" className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:scale-105 shadow-sm transition-all">
          <ArrowLeft className="w-5 h-5 text-[#0f1015]" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0f1015] tracking-tight">{vendor.name}</h1>
          <p className="text-sm text-[#64748b] font-medium">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-lg text-xs font-bold mr-2">{vendor.share2me_id}</span>
            Joined {new Date(vendor.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Print Jobs", value: totalJobs, icon: Printer, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Printed", value: printedJobs, icon: Check, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "File Transfers", value: (analytics || []).length, icon: FileUp, color: "text-pink-600", bg: "bg-pink-50" },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm">
            <div className={`w-9 h-9 ${kpi.bg} ${kpi.color} rounded-xl flex items-center justify-center mb-2`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-black text-[#0f1015]">{kpi.value}</div>
            <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-purple-600" /> Profile
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${vendor.persona === "BUSINESS" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{vendor.persona || "PERSONAL"}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${vendor.plan_type === "FREE" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{vendor.plan_type || "FREE"}</span>
            </div>
            {vendor.email && <div className="flex items-center gap-2 text-slate-600"><Mail className="w-4 h-4 text-slate-400" /> {vendor.email}</div>}
            {vendor.phone && <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4 text-slate-400" /> {vendor.phone}</div>}
            {vendor.company && <div className="flex items-center gap-2 text-slate-600"><Store className="w-4 h-4 text-slate-400" /> {vendor.company}</div>}
            {vendor.website && <div className="flex items-center gap-2 text-slate-600"><Globe className="w-4 h-4 text-slate-400" /> {vendor.website}</div>}
            {vendor.upi_id && <div className="flex items-center gap-2 text-slate-600"><CreditCard className="w-4 h-4 text-slate-400" /> UPI: {vendor.upi_id}</div>}
            {vendor.bio && <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">{vendor.bio}</p>}
          </div>
        </div>

        {/* Shop Settings Card */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" /> Shop Settings
          </h3>
          {shop ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                {shop.is_accepting ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full"><ShieldCheck className="w-3 h-3" /> Accepting Jobs</span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full"><ShieldAlert className="w-3 h-3" /> Not Accepting</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-[#0f1015]">₹{shop.bw_price}</div>
                  <div className="text-[10px] font-bold text-slate-400">B&W / Page</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-[#0f1015]">₹{shop.color_price}</div>
                  <div className="text-[10px] font-bold text-slate-400">Color / Page</div>
                </div>
              </div>
              {shop.location_name && <div className="flex items-center gap-2 text-slate-600 text-xs"><MapPin className="w-4 h-4 text-slate-400" /> {shop.location_name}</div>}
              {shop.upi_id && <div className="flex items-center gap-2 text-slate-600 text-xs"><CreditCard className="w-4 h-4 text-slate-400" /> UPI: {shop.upi_id}</div>}
              <div className="text-xs text-slate-400">Retention: {shop.retention_hours}h | Bank: {shop.bank_verification_status}</div>
            </div>
          ) : (
            <div className="text-center text-slate-300 py-8 font-bold text-sm">No shop configured</div>
          )}
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-amber-600" /> Revenue Timeline
          </h3>
          {revenueChartData.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip formatter={(value: any) => [`₹${value}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#9333ea" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-slate-300 py-8 font-bold text-sm">No revenue data yet</div>
          )}
        </div>
      </div>

      {/* Print Jobs Table */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" /> Print Job History ({(jobs || []).length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pages</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody>
              {(jobs || []).map((j: any) => (
                <tr key={j.id} className="border-t border-slate-50 hover:bg-purple-50/20 transition-colors">
                  <td className="px-6 py-3 font-medium text-[#0f1015] max-w-[200px] truncate">{j.document_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${j.print_type === "color" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{j.print_type}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{j.pages}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(parseFloat(j.total_amount))}</td>
                  <td className="px-4 py-3"><StatusBadge status={j.payment_status || j.payment_method} /></td>
                  <td className="px-4 py-3"><StatusBadge status={j.job_status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(j.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!jobs || jobs.length === 0) && (
            <div className="p-12 text-center text-slate-300 font-bold text-sm">No print jobs recorded</div>
          )}
        </div>
      </div>

      {/* G2P Transfer History */}
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-black text-[#0f1015] uppercase tracking-wider flex items-center gap-2">
            <FileUp className="w-4 h-4 text-pink-600" /> File Transfer History ({(analytics || []).length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sender</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">File</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody>
              {(analytics || []).map((a: any) => (
                <tr key={a.id} className="border-t border-slate-50 hover:bg-pink-50/20 transition-colors">
                  <td className="px-6 py-3 font-medium text-[#0f1015]">{a.sender_name || "Anonymous"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{a.file_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{a.file_type || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-600">{formatBytes(parseInt(a.file_size_bytes || 0))}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!analytics || analytics.length === 0) && (
            <div className="p-12 text-center text-slate-300 font-bold text-sm">No file transfers recorded</div>
          )}
        </div>
      </div>
    </div>
  );
}

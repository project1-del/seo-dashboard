"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getDateRange, formatNumber, positionColor, cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Tab = "overview" | "keywords" | "tracked" | "pages" | "quickwins";

const DATE_RANGES = [
  { label: "7d", days: 7 },
  { label: "28d", days: 28 },
  { label: "90d", days: 90 },
];

const COUNTRIES = [
  { code: "", label: "All Countries" },
  { code: "aus", label: "Australia" },
  { code: "can", label: "Canada" },
  { code: "gbr", label: "United Kingdom" },
  { code: "usa", label: "United States" },
  { code: "phl", label: "Philippines" },
  { code: "sgp", label: "Singapore" },
  { code: "mys", label: "Malaysia" },
  { code: "nzl", label: "New Zealand" },
  { code: "ind", label: "India" },
  { code: "deu", label: "Germany" },
  { code: "fra", label: "France" },
  { code: "esp", label: "Spain" },
  { code: "ita", label: "Italy" },
  { code: "nld", label: "Netherlands" },
  { code: "bra", label: "Brazil" },
  { code: "mex", label: "Mexico" },
  { code: "jpn", label: "Japan" },
  { code: "kor", label: "South Korea" },
  { code: "are", label: "UAE" },
  { code: "sau", label: "Saudi Arabia" },
  { code: "zaf", label: "South Africa" },
  { code: "nga", label: "Nigeria" },
  { code: "idn", label: "Indonesia" },
  { code: "tha", label: "Thailand" },
  { code: "vnm", label: "Vietnam" },
  { code: "pak", label: "Pakistan" },
];

interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SummaryData {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  dailyData: { date: string; clicks: number; impressions: number }[];
}

type SortKey = "clicks" | "impressions" | "ctr" | "position";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [properties, setProperties] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [dateRangeIdx, setDateRangeIdx] = useState(1);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [quickWins, setQuickWins] = useState<QueryRow[]>([]);
  const [trackedKeywords, setTrackedKeywords] = useState<QueryRow[]>([]);
  const [trackedList, setTrackedList] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  const [loading, setLoading] = useState(false);
  const [querySearch, setQuerySearch] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Track whether properties have been loaded once — avoid resetting on session re-render
  const propertiesLoaded = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Load properties only once
  useEffect(() => {
    if (session && !propertiesLoaded.current) {
      propertiesLoaded.current = true;
      fetch("/api/gsc/properties")
        .then((r) => r.json())
        .then((d) => {
          if (d.properties?.length) {
            setProperties(d.properties);
            setSelectedProperty(d.properties[0]);
          }
        });
    }
  }, [session]);

  // Load tracked keywords from localStorage once
  useEffect(() => {
    const saved = localStorage.getItem("trackedKeywords");
    if (saved) setTrackedList(JSON.parse(saved));
  }, []);

  // Central fetch — call explicitly, not via useEffect on every state change
  const fetchData = async (
    property: string,
    rangeIdx: number,
    isCustom: boolean,
    cStart: string,
    cEnd: string,
    country: string,
    tracked: string[]
  ) => {
    if (!property) return;
    if (isCustom && (!cStart || !cEnd)) return;
    setLoading(true);

    const { startDate, endDate } = isCustom
      ? { startDate: cStart, endDate: cEnd }
      : getDateRange(DATE_RANGES[rangeIdx].days);

    const countryParam = country ? `&country=${country}` : "";
    const params = `?siteUrl=${encodeURIComponent(property)}&startDate=${startDate}&endDate=${endDate}${countryParam}`;

    try {
      const [sumRes, qRes, pRes, qwRes] = await Promise.all([
        fetch(`/api/gsc/summary${params}`).then((r) => r.json()),
        fetch(`/api/gsc/queries${params}`).then((r) => r.json()),
        fetch(`/api/gsc/pages${params}`).then((r) => r.json()),
        fetch(`/api/gsc/quickwins${params}`).then((r) => r.json()),
      ]);
      setSummary(sumRes);
      setQueries(qRes.rows || []);
      setPages(pRes.rows || []);
      setQuickWins(qwRes.rows || []);

      if (tracked.length > 0) {
        const tRes = await fetch(`/api/gsc/tracked${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: tracked }),
        }).then((r) => r.json());
        setTrackedKeywords(tRes.rows || []);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch only when property first loads or user explicitly changes property/date/country
  const prevProperty = useRef("");
  useEffect(() => {
    if (selectedProperty && selectedProperty !== prevProperty.current) {
      prevProperty.current = selectedProperty;
      fetchData(selectedProperty, dateRangeIdx, showCustom, customStart, customEnd, selectedCountry, trackedList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty]);

  const applyFilters = () => {
    fetchData(selectedProperty, dateRangeIdx, showCustom, customStart, customEnd, selectedCountry, trackedList);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortRows = <T extends QueryRow | PageRow>(rows: T[]) =>
    [...rows].sort((a, b) => {
      const av = a[sortKey as keyof T] as number;
      const bv = b[sortKey as keyof T] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const addTracked = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw || trackedList.includes(kw)) return;
    const updated = [...trackedList, kw];
    setTrackedList(updated);
    localStorage.setItem("trackedKeywords", JSON.stringify(updated));
    setNewKeyword("");
  };

  const removeTracked = (kw: string) => {
    const updated = trackedList.filter((k) => k !== kw);
    setTrackedList(updated);
    localStorage.setItem("trackedKeywords", JSON.stringify(updated));
    setTrackedKeywords((prev) => prev.filter((r) => r.query !== kw));
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 text-gray-400">
      {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );

  const QueryTable = ({ rows }: { rows: QueryRow[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-gray-500">
            <th className="text-left py-3 pr-4 font-medium">Keyword</th>
            {(["clicks", "impressions", "ctr", "position"] as SortKey[]).map((k) => (
              <th
                key={k}
                className="text-right py-3 px-2 font-medium cursor-pointer hover:text-gray-800 capitalize"
                onClick={() => handleSort(k)}
              >
                {k === "ctr" ? "CTR" : k.charAt(0).toUpperCase() + k.slice(1)}
                <SortIcon k={k} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2.5 pr-4 text-gray-800 max-w-xs truncate">{r.query}</td>
              <td className="py-2.5 px-2 text-right text-gray-700">{formatNumber(r.clicks)}</td>
              <td className="py-2.5 px-2 text-right text-gray-500">{formatNumber(r.impressions)}</td>
              <td className="py-2.5 px-2 text-right text-gray-500">{r.ctr}%</td>
              <td className={cn("py-2.5 px-2 text-right font-medium", positionColor(r.position))}>
                {r.position > 0 ? r.position : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="font-semibold text-gray-900">SEO Dashboard</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Property selector */}
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {properties.map((p) => (
                <option key={p} value={p}>{p.replace(/^https?:\/\//, "").replace(/\/$/, "")}</option>
              ))}
            </select>

            {/* Country filter */}
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>

            {/* Date range tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {DATE_RANGES.map((dr, i) => (
                <button
                  key={i}
                  onClick={() => { setDateRangeIdx(i); setShowCustom(false); }}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                    !showCustom && dateRangeIdx === i
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {dr.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(true)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                  showCustom ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                Custom
              </button>
            </div>

            {/* Custom date inputs */}
            {showCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Apply button */}
            <button
              onClick={applyFilters}
              disabled={loading || (showCustom && (!customStart || !customEnd))}
              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors font-medium"
            >
              {loading ? "Loading..." : "Apply"}
            </button>

            {/* User */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              {session.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
              )}
              <button onClick={() => signOut()} className="text-xs text-gray-500 hover:text-gray-800">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-6">
          {([
            { id: "overview", label: "Overview" },
            { id: "keywords", label: "Top Keywords" },
            { id: "tracked", label: "Tracked Keywords" },
            { id: "pages", label: "Top Pages" },
            { id: "quickwins", label: "Quick Wins" },
          ] as { id: Tab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab.label}
              {tab.id === "quickwins" && quickWins.length > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                  {quickWins.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="p-6 max-w-7xl mx-auto">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            Loading data...
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === "overview" && summary && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Clicks", value: formatNumber(summary.totalClicks), color: "text-blue-600" },
                { label: "Total Impressions", value: formatNumber(summary.totalImpressions), color: "text-indigo-600" },
                { label: "Avg. CTR", value: `${summary.avgCtr}%`, color: "text-green-600" },
                { label: "Avg. Position", value: summary.avgPosition.toString(), color: positionColor(summary.avgPosition) },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className={cn("text-3xl font-bold mt-1", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Clicks & Impressions Over Time</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={summary.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [formatNumber(Number(value)), name]}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} dot={false} name="Clicks" />
                  <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#818cf8" strokeWidth={2} dot={false} name="Impressions" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Top 10 Keywords</h3>
                <button onClick={() => setActiveTab("keywords")} className="text-xs text-blue-600 hover:underline">
                  View all →
                </button>
              </div>
              <QueryTable rows={sortRows(queries).slice(0, 10)} />
            </div>
          </div>
        )}

        {/* TOP KEYWORDS */}
        {activeTab === "keywords" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Top Keywords ({queries.length})</h3>
              <input
                type="text"
                placeholder="Filter keywords..."
                value={querySearch}
                onChange={(e) => setQuerySearch(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <QueryTable
              rows={sortRows(queries.filter((r) => r.query.toLowerCase().includes(querySearch.toLowerCase())))}
            />
          </div>
        )}

        {/* TRACKED KEYWORDS */}
        {activeTab === "tracked" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Keywords to Track</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTracked()}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addTracked}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {trackedList.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {trackedList.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                      {kw}
                      <button onClick={() => removeTracked(kw)} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {trackedKeywords.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Tracked Keyword Performance</h3>
                <QueryTable rows={sortRows(trackedKeywords)} />
              </div>
            )}
            {trackedList.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                Add keywords above to track their performance over time.
              </div>
            )}
          </div>
        )}

        {/* TOP PAGES */}
        {activeTab === "pages" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Top Pages ({pages.length})</h3>
              <input
                type="text"
                placeholder="Filter pages..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left py-3 pr-4 font-medium">Page</th>
                    {(["clicks", "impressions", "ctr", "position"] as SortKey[]).map((k) => (
                      <th
                        key={k}
                        className="text-right py-3 px-2 font-medium cursor-pointer hover:text-gray-800 capitalize"
                        onClick={() => handleSort(k)}
                      >
                        {k === "ctr" ? "CTR" : k.charAt(0).toUpperCase() + k.slice(1)}
                        <SortIcon k={k} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortRows(pages)
                    .filter((r) => r.page.toLowerCase().includes(pageSearch.toLowerCase()))
                    .map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 max-w-sm">
                          <a
                            href={r.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate block"
                          >
                            {r.page.replace(/^https?:\/\/[^/]+/, "") || "/"}
                          </a>
                        </td>
                        <td className="py-2.5 px-2 text-right text-gray-700">{formatNumber(r.clicks)}</td>
                        <td className="py-2.5 px-2 text-right text-gray-500">{formatNumber(r.impressions)}</td>
                        <td className="py-2.5 px-2 text-right text-gray-500">{r.ctr}%</td>
                        <td className={cn("py-2.5 px-2 text-right font-medium", positionColor(r.position))}>
                          {r.position > 0 ? r.position : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* QUICK WINS */}
        {activeTab === "quickwins" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Quick Wins</strong> — Keywords ranking position 4–20 with 100+ impressions. These have high potential to reach page 1 with targeted optimization.
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Opportunities ({quickWins.length})</h3>
              {quickWins.length > 0 ? (
                <QueryTable rows={sortRows(quickWins)} />
              ) : (
                <p className="text-center py-8 text-gray-400 text-sm">No quick wins found for this period.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

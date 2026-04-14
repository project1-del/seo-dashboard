import { google } from "googleapis";

export function getSearchConsoleClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.searchconsole({ version: "v1", auth });
}

export async function listProperties(accessToken: string): Promise<string[]> {
  const sc = getSearchConsoleClient(accessToken);
  const res = await sc.sites.list();
  return ((res.data.siteEntry as Array<{ siteUrl?: string }>) || [])
    .map((s) => s.siteUrl!)
    .filter(Boolean)
    .sort();
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRow(keys: string[], r: any) {
  return {
    key: r.keys?.[0] ?? keys[0],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: Math.round((r.ctr ?? 0) * 10000) / 100,
    position: Math.round((r.position ?? 0) * 10) / 10,
  };
}

function countryFilter(country: string) {
  if (!country) return undefined;
  return [{ filters: [{ dimension: "country", operator: "equals", expression: country }] }];
}

export async function getTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  country = "",
  rowLimit = 100
): Promise<QueryRow[]> {
  const sc = getSearchConsoleClient(accessToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (sc.searchanalytics.query as any)({
    siteUrl,
    requestBody: { startDate, endDate, dimensions: ["query"], rowLimit, dimensionFilterGroups: countryFilter(country) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.rows ?? []).map((r: any) => {
    const p = parseRow(["query"], r);
    return { query: p.key, clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position };
  });
}

export async function getTopPages(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  country = "",
  rowLimit = 100
): Promise<PageRow[]> {
  const sc = getSearchConsoleClient(accessToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (sc.searchanalytics.query as any)({
    siteUrl,
    requestBody: { startDate, endDate, dimensions: ["page"], rowLimit, dimensionFilterGroups: countryFilter(country) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.rows ?? []).map((r: any) => {
    const p = parseRow(["page"], r);
    return { page: p.key, clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position };
  });
}

export async function getQuickWins(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  country = ""
): Promise<QueryRow[]> {
  const sc = getSearchConsoleClient(accessToken);
  const filters = [
    { dimension: "position", operator: "greaterThan", expression: "3" },
    { dimension: "position", operator: "lessThan", expression: "21" },
    ...(country ? [{ dimension: "country", operator: "equals", expression: country }] : []),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (sc.searchanalytics.query as any)({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 500,
      dimensionFilterGroups: [{ filters }],
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.rows ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => (r.impressions ?? 0) >= 100)
    .slice(0, 50)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => {
      const p = parseRow(["query"], r);
      return { query: p.key, clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position };
    });
}

export async function getTrackedKeywords(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  keywords: string[],
  country = ""
): Promise<QueryRow[]> {
  if (keywords.length === 0) return [];
  const sc = getSearchConsoleClient(accessToken);
  const results: QueryRow[] = [];

  for (const kw of keywords) {
    try {
      const filters = [
        { dimension: "query", operator: "equals", expression: kw },
        ...(country ? [{ dimension: "country", operator: "equals", expression: country }] : []),
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (sc.searchanalytics.query as any)({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["query"],
          dimensionFilterGroups: [{ filters }],
          rowLimit: 1,
        },
      });
      const row = (res.data.rows ?? [])[0];
      results.push({
        query: kw,
        clicks: row?.clicks ?? 0,
        impressions: row?.impressions ?? 0,
        ctr: Math.round(((row?.ctr ?? 0) * 10000)) / 100,
        position: Math.round(((row?.position ?? 0) * 10)) / 10,
      });
    } catch {
      results.push({ query: kw, clicks: 0, impressions: 0, ctr: 0, position: 0 });
    }
  }
  return results;
}

export async function getSummaryStats(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  country = ""
) {
  const sc = getSearchConsoleClient(accessToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (sc.searchanalytics.query as any)({
    siteUrl,
    requestBody: { startDate, endDate, dimensions: ["date"], rowLimit: 500, dimensionFilterGroups: countryFilter(country) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = res.data.rows ?? [];
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPosition = rows.length > 0 ? rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length : 0;

  return {
    totalClicks,
    totalImpressions,
    avgCtr: Math.round(avgCtr * 100) / 100,
    avgPosition: Math.round(avgPosition * 10) / 10,
    dailyData: rows.map((r) => ({
      date: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    })),
  };
}

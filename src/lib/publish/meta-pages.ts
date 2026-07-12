const META_API = "https://graph.facebook.com/v22.0";

export interface MetaPageInfo {
  id: string;
  name: string;
  pageToken: string;
}

export async function getMetaPages(userAccessToken: string): Promise<MetaPageInfo[]> {
  const res = await fetch(
    `${META_API}/me/accounts?fields=id,name,access_token&limit=100&access_token=${userAccessToken}`,
  );
  const json = await res.json() as {
    data?: Array<{ id: string; name: string; access_token: string }>;
    error?: { message: string };
  };
  if (json.error) throw new Error(`Meta pages fetch failed: ${json.error.message}`);
  return (json.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    pageToken: p.access_token,
  }));
}

import { POST as POST_CLIENT } from "@/app/api/clients/route";
import {
  createAuthedUser,
  cleanupTestData,
  jsonRequest,
  SESSION_COOKIE,
} from "./request";

export { createAuthedUser, cleanupTestData };

const BASE = "http://localhost/api/clients";

// Create a client via the API for the given session cookie. Returns the row.
export async function createClientFor(cookie: string, name: string) {
  const res = await POST_CLIENT(
    jsonRequest(BASE, { name }, { [SESSION_COOKIE]: cookie }),
  );
  if (res.status !== 201) {
    throw new Error(`createClientFor failed: ${res.status}`);
  }
  return (await res.json()) as { id: string; name: string; userId: string };
}

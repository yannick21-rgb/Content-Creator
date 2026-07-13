import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  json,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Better Auth tables (Drizzle adapter, provider: "pg")
// Field names follow the official @better-auth/drizzle-adapter conventions.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Application tables (client isolation + encrypted token vault)
// ---------------------------------------------------------------------------

export const client = pgTable("client", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const socialAccount = pgTable(
  "social_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformAccountId: text("platform_account_id").notNull(),
    name: text("name"),
    // AES-256-GCM ciphertext + auth tag + IV. Plaintext is never stored.
    // Access and refresh tokens are encrypted independently (separate IV/tag
    // each) — reusing one IV across two GCM messages breaks authentication.
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    refreshTokenIv: text("refresh_token_iv"),
    refreshTokenTag: text("refresh_token_tag"),
    expiresAt: timestamp("expires_at"),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
check(
  "social_account_platform_check",
  sql`${table.platform} IN ('meta', 'linkedin', 'instagram')`,
),
  ],
);

export const oauthState = pgTable("oauth_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  state: text("state").notNull().unique(),
  codeVerifier: text("code_verifier").notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 2 — Posts & Media
// ---------------------------------------------------------------------------

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  title: text("title"),
  text: text("text").notNull(),
  multiImage: boolean("multi_image").default(false),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  timezone: text("timezone"),
  status: text("status").default("draft").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  publicUrl: text("public_url").notNull(),
  contentType: text("content_type").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  metadata: json("metadata"),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
});

// ---------------------------------------------------------------------------
// Phase 3 — Scheduler & Worker (publish targets)
// ---------------------------------------------------------------------------

export const publishTargets = pgTable(
  "publish_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("scheduled"),
    errorMessage: text("error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "publish_target_status_check",
      sql`${table.status} IN ('scheduled', 'running', 'published', 'failed')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  clients: many(client),
  sessions: many(session),
  accounts: many(account),
}));

export const clientRelations = relations(client, ({ one, many }) => ({
  user: one(user, {
    fields: [client.userId],
    references: [user.id],
  }),
  socialAccounts: many(socialAccount),
  oauthStates: many(oauthState),
  posts: many(posts),
  media: many(media),
}));

export const socialAccountRelations = relations(socialAccount, ({ one }) => ({
  client: one(client, {
    fields: [socialAccount.clientId],
    references: [client.id],
  }),
}));

export const oauthStateRelations = relations(oauthState, ({ one }) => ({
  client: one(client, {
    fields: [oauthState.clientId],
    references: [client.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  client: one(client, {
    fields: [posts.clientId],
    references: [client.id],
  }),
  media: many(media),
  publishTargets: many(publishTargets),
}));

export const publishTargetsRelations = relations(publishTargets, ({ one }) => ({
  post: one(posts, {
    fields: [publishTargets.postId],
    references: [posts.id],
  }),
  socialAccount: one(socialAccount, {
    fields: [publishTargets.socialAccountId],
    references: [socialAccount.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  client: one(client, {
    fields: [media.clientId],
    references: [client.id],
  }),
  post: one(posts, {
    fields: [media.postId],
    references: [posts.id],
  }),
}));

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Client = typeof client.$inferSelect;
export type NewClient = typeof client.$inferInsert;
export type SocialAccount = typeof socialAccount.$inferSelect;
export type NewSocialAccount = typeof socialAccount.$inferInsert;
export type OauthState = typeof oauthState.$inferSelect;
export type NewOauthState = typeof oauthState.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type PublishTarget = typeof publishTargets.$inferSelect;
export type NewPublishTarget = typeof publishTargets.$inferInsert;

// ---------------------------------------------------------------------------
// Phase 07 — AI (Gemini) & Hardening
// ---------------------------------------------------------------------------

export const brandVoice = pgTable("brand_voice", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  tone: text("tone").notNull(),
  styleGuidelines: text("style_guidelines"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const brandVoiceRelations = relations(brandVoice, ({ one }) => ({
  client: one(client, {
    fields: [brandVoice.clientId],
    references: [client.id],
  }),
}));

export type BrandVoice = typeof brandVoice.$inferSelect;
export type NewBrandVoice = typeof brandVoice.$inferInsert;

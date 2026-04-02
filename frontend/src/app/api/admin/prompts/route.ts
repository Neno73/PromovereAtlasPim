import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Prompts file location and types
// ---------------------------------------------------------------------------

const PROMPTS_FILE = path.join(process.cwd(), "src", "data", "prompts.json");
const SESSION_COOKIE = "admin_session";

export interface Prompts {
  regularPrompt: string;
  companyKnowledge: string;
  industryKnowledge: string;
  preSearchQuestions: string;
  productSearchFlow: string;
  brandVoice: string;
}

const DEFAULT_PROMPTS: Prompts = {
  regularPrompt:
    "You are Atlas Bot, a professional and knowledgeable assistant specializing in corporate merchandise and promotional products. You help businesses find the perfect branded items for their events, campaigns, and corporate gifting needs. You are friendly, efficient, and always focused on understanding the customer's requirements before making recommendations.",
  companyKnowledge:
    "We are a European promotional products distributor with access to over 50 suppliers and thousands of products. Our catalog includes items ranging from pens and drinkware to textiles, bags, tech accessories, and eco-friendly products. We serve B2B clients across Europe with competitive pricing and reliable delivery. All prices are in EUR and we offer tiered pricing based on order quantity.",
  industryKnowledge:
    "The promotional products industry is B2B focused on branded merchandise for corporate events, trade shows, employee gifts, and marketing campaigns. Key terms: MOQ (Minimum Order Quantity), imprint area (where logos are printed), PMS colors (Pantone Matching System for brand-accurate colors), lead time (production + delivery time). Common decoration methods include screen printing, embroidery, laser engraving, and full-color digital printing. Eco-friendly and sustainable products are increasingly in demand.",
  preSearchQuestions:
    "Before searching for products, try to understand:\n1. What is the occasion or purpose? (trade show, corporate gift, event giveaway, employee onboarding)\n2. What is the approximate budget per item?\n3. How many units are needed?\n4. Are there any brand guidelines or color requirements?\n5. Is there a preference for eco-friendly or sustainable products?\n6. When do they need the products by?\n\nDo NOT ask all questions at once. Ask 1-2 at a time based on what is most relevant.",
  productSearchFlow:
    "CORE PRINCIPLE: Always show products first when the request is clear enough. Never make the customer wait unnecessarily.\n\nSTAGE 1: PRODUCT DISCOVERY\n- If the user's request is specific enough, search immediately\n- Use the searchProducts tool with relevant filters\n- Present results concisely: 2-3 sentences plus the product cards\n\nSTAGE 2: REFINEMENT\n- If results are too broad, ask one clarifying question\n- If no results found, suggest broadening the search or alternative categories\n- Offer to filter by color, price range, or material\n\nSTAGE 3: DETAILS\n- When a user asks about a specific product, provide full details\n- Mention available colors, sizes, price tiers, and customization options\n- Offer to search for similar alternatives if needed\n\nDo NOT list products as text when the tool already returns them as visual cards.",
  brandVoice:
    "Communicate with a professional yet approachable tone. Be helpful and knowledgeable without being pushy. Use clear, concise language. Avoid jargon unless the customer uses it first. Keep responses short: 2-3 sentences max plus product cards. Show enthusiasm for helping find the right product. When unsure, be honest and offer alternatives rather than guessing.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie) return false;

  // Validate session by calling the auth check internally
  // We reuse the same global sessions map from the auth route
  const globalSessions = globalThis as unknown as {
    __adminSessions?: Map<string, { email: string; createdAt: number }>;
  };
  const sessions = globalSessions.__adminSessions;
  if (!sessions) return false;

  const session = sessions.get(sessionCookie.value);
  if (!session) return false;

  const elapsed = (Date.now() - session.createdAt) / 1000;
  if (elapsed > 60 * 60 * 24) {
    sessions.delete(sessionCookie.value);
    return false;
  }

  return true;
}

export async function readPrompts(): Promise<Prompts> {
  try {
    const data = await fs.readFile(PROMPTS_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<Prompts>;
    // Merge with defaults to ensure all fields exist
    return { ...DEFAULT_PROMPTS, ...parsed };
  } catch {
    return { ...DEFAULT_PROMPTS };
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/prompts -- read prompts (requires auth)
// ---------------------------------------------------------------------------

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompts = await readPrompts();
  return Response.json(prompts);
}

// ---------------------------------------------------------------------------
// POST /api/admin/prompts -- save prompts (requires auth)
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate that all expected fields are present
  const prompts: Prompts = {
    regularPrompt: String(body.regularPrompt ?? DEFAULT_PROMPTS.regularPrompt),
    companyKnowledge: String(
      body.companyKnowledge ?? DEFAULT_PROMPTS.companyKnowledge,
    ),
    industryKnowledge: String(
      body.industryKnowledge ?? DEFAULT_PROMPTS.industryKnowledge,
    ),
    preSearchQuestions: String(
      body.preSearchQuestions ?? DEFAULT_PROMPTS.preSearchQuestions,
    ),
    productSearchFlow: String(
      body.productSearchFlow ?? DEFAULT_PROMPTS.productSearchFlow,
    ),
    brandVoice: String(body.brandVoice ?? DEFAULT_PROMPTS.brandVoice),
  };

  try {
    // Ensure the directory exists
    const dir = path.dirname(PROMPTS_FILE);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2), "utf-8");
    return Response.json({ success: true, prompts });
  } catch (err) {
    console.error("Failed to write prompts file:", err);
    return Response.json(
      { error: "Failed to save prompts" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY!;

const GROUP_MAP: Record<string, string> = {
  "Βάζω πάντα τους άλλους πρώτους - και έχω κουραστεί.": "183496750579844807",
  "Ξέρω τι πρέπει να κάνω. Αλλά δεν το κάνω. Και αυτό με βαραίνει.": "183496756599718945",
  "Νιώθω ότι ζω μια ζωή που δεν διάλεξα εντελώς εγώ.": "183496766349378982",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const fields = body?.data?.fields as Array<{
      label: string;
      value: string | string[];
    }>;

    if (!fields) {
      return NextResponse.json({ error: "No fields found" }, { status: 400 });
    }

    // Extract email
    const emailField = fields.find((f) => f.label.toLowerCase() === "email");
    const email = emailField?.value as string;

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Extract last question answer (last field that's not email)
    const lastField = [...fields].reverse().find((f) => f.label.toLowerCase() !== "email");
    const answer = Array.isArray(lastField?.value)
      ? lastField!.value[0]
      : lastField?.value;

    if (!answer) {
      return NextResponse.json({ error: "No answer found" }, { status: 400 });
    }

    // Find matching group
    const groupId = GROUP_MAP[answer.trim()];

    if (!groupId) {
      console.warn("No group match for answer:", answer);
      // Still add subscriber without group
    }

    // Add subscriber to MailerLite
    const mlRes = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MAILERLITE_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        groups: groupId ? [groupId] : [],
      }),
    });

    if (!mlRes.ok) {
      const error = await mlRes.json();
      console.error("MailerLite error:", error);
      return NextResponse.json({ error: "MailerLite failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
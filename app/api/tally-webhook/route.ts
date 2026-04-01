import { NextRequest, NextResponse } from "next/server";

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY!;

// Map answer text to MailerLite group ID
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
      type: string;
      value: string | string[];
      options?: Array<{ id: string; text: string }>;
    }>;

    if (!fields) {
      return NextResponse.json({ error: "No fields found" }, { status: 400 });
    }

    // Extract email
    const emailField = fields.find((f) => f.type === "INPUT_EMAIL");
    const email = emailField?.value as string;

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Find last multiple choice field (the final question)
    const lastChoiceField = [...fields]
      .reverse()
      .find((f) => f.type === "MULTIPLE_CHOICE" && f.options);

    if (!lastChoiceField || !lastChoiceField.options) {
      return NextResponse.json({ error: "No choice field found" }, { status: 400 });
    }

    // Get selected UUID(s)
    const selectedIds = Array.isArray(lastChoiceField.value)
      ? lastChoiceField.value
      : [lastChoiceField.value];

    // Map UUID to text
    const selectedText = lastChoiceField.options.find(
      (opt) => opt.id === selectedIds[0]
    )?.text;

    console.log("Selected answer:", selectedText);

    if (!selectedText) {
      return NextResponse.json({ error: "Could not resolve answer text" }, { status: 400 });
    }

    // Find matching group
    const groupId = GROUP_MAP[selectedText.trim()];

    if (!groupId) {
      console.warn("No group match for answer:", selectedText);
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
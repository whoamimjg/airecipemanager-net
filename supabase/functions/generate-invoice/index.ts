import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await userClient
      .from("billing_history")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a simple text-based PDF using minimal PDF spec
    const pdfContent = generatePDF(invoice, user.email ?? "");

    return new Response(pdfContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generatePDF(invoice: any, email: string): Uint8Array {
  // Minimal PDF generation without external libraries
  const lines: string[] = [];
  let objectCount = 0;
  const offsets: number[] = [];

  const addObject = (content: string) => {
    objectCount++;
    offsets.push(lines.join("").length);
    lines.push(`${objectCount} 0 obj\n${content}\nendobj\n`);
    return objectCount;
  };

  // Catalog
  addObject("<< /Type /Catalog /Pages 2 0 R >>");

  // Pages
  addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");

  // Page
  addObject(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>"
  );

  const planName = (invoice.plan || "free").charAt(0).toUpperCase() + (invoice.plan || "free").slice(1);
  const date = new Date(invoice.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const amount = `$${Number(invoice.amount).toFixed(2)}`;

  // Content stream
  const contentLines = [
    "BT",
    "/F2 24 Tf",
    "72 700 Td",
    `(AI Recipe Manager) Tj`,
    "/F1 10 Tf",
    "0 -30 Td",
    `(INVOICE) Tj`,
    "0 -40 Td",
    "/F1 11 Tf",
    `(Invoice Number: ${escPdf(invoice.invoice_number)}) Tj`,
    "0 -18 Td",
    `(Date: ${escPdf(date)}) Tj`,
    "0 -18 Td",
    `(Email: ${escPdf(email)}) Tj`,
    "0 -18 Td",
    `(Status: ${escPdf(invoice.status.toUpperCase())}) Tj`,
    "0 -40 Td",
    "/F2 12 Tf",
    `(Plan: ${escPdf(planName)}) Tj`,
    "/F1 11 Tf",
    "0 -20 Td",
    `(${escPdf(invoice.description || planName + " Plan - Monthly Subscription")}) Tj`,
    "0 -30 Td",
    "/F2 16 Tf",
    `(Total: ${escPdf(amount)}) Tj`,
    "0 -50 Td",
    "/F1 9 Tf",
    `(Payment Method: ${escPdf(invoice.payment_method || "N/A")}) Tj`,
    "0 -40 Td",
    "/F1 8 Tf",
    `(Thank you for your subscription!) Tj`,
    "ET",
  ];

  const stream = contentLines.join("\n");
  addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  // Fonts
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  // Build PDF
  const header = "%PDF-1.4\n";
  const body = lines.join("");
  const xrefOffset = header.length + body.length;

  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  let runningOffset = header.length;
  for (let i = 0; i < objectCount; i++) {
    xref += `${String(runningOffset).padStart(10, "0")} 00000 n \n`;
    runningOffset += lines[i].length;
  }

  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const fullPdf = header + body + xref + trailer;
  return new TextEncoder().encode(fullPdf);
}

function escPdf(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

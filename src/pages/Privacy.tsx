import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const lastUpdated = "July 20, 2026";

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/20 bg-brand-slate text-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="AI Recipe Manager" className="h-8 w-8 rounded" />
            <span className="text-xl font-bold tracking-tight">AI Recipe Manager</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="prose prose-slate mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              airecipemanager.com ("we," "us," or "our") respects your privacy. This Privacy Policy
              explains how we collect, use, disclose, and protect your information when you use AI
              Recipe Manager (the "Service").
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">We collect the following categories of information:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li><strong>Account information:</strong> name, email address, and authentication identifiers (including Google or Apple sign-in IDs).</li>
              <li><strong>User content:</strong> recipes, kitchen inventory, meal plans, grocery lists, photos, receipts, and feedback you submit.</li>
              <li><strong>Payment information:</strong> billing details processed securely by our PCI-compliant payment processor. We do not store full card numbers on our servers.</li>
              <li><strong>Usage data:</strong> pages visited, features used, device type, browser, IP address, and approximate location.</li>
              <li><strong>Cookies & similar technologies:</strong> used to keep you signed in, remember preferences, and measure performance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Provide, operate, and maintain the Service.</li>
              <li>Generate AI recipes, meal plans, and personalized recommendations.</li>
              <li>Process payments, subscriptions, and invoices.</li>
              <li>Communicate with you about your account, updates, and support requests.</li>
              <li>Improve and secure the Service, prevent fraud, and enforce our Terms.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">4. AI Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you use AI features, the data you submit is sent to a third-party AI provider
              solely to generate the requested response. The model is Google Gemini, accessed
              through the Lovable AI Gateway. No AI model runs on your device — all AI processing
              happens on our servers and at that provider.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li><strong>Recipe generation:</strong> the names, quantities, and storage locations of your pantry items, your saved dietary restrictions and allergies, and any preferences you type.</li>
              <li><strong>Receipt scanning:</strong> the photograph of the receipt.</li>
              <li><strong>Recipe photo scanning:</strong> the photograph of the recipe or cookbook page.</li>
              <li><strong>Ingredient categorization:</strong> ingredient names only.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Your name, email address, account identifier, and authentication token are never
              included in these requests. We do not use your personal content to train
              third-party AI models.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">5. Mobile App Permissions</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you use our iOS or Android app, we may request access to certain device features.
              We only request permission when you actively use a feature that needs it, and you can
              revoke access at any time in your device settings.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li><strong>Camera:</strong> Used to take photos of grocery receipts (Receipt Scanner) and recipes or cookbook pages (Add Recipe / Photo Recipe Scanner). Photos are processed to extract text and ingredients.</li>
              <li><strong>Photo Library:</strong> Used when you choose to upload an existing photo of a receipt, recipe, or dish image instead of taking a new one. We only access the specific image you select.</li>
              <li><strong>Network access:</strong> Required to sync your recipes, inventory, meal plans, and account data with our servers.</li>
              <li><strong>Haptic feedback:</strong> Used purely for in-app touch feedback; no data is collected.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do not access your microphone, contacts, location, calendar, health data, or any
              media on your device beyond the specific images you choose to share with the app.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">6. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              We rely on the following third-party providers to operate the Service. Each provider
              processes data only as needed to deliver its function and is bound by its own privacy
              policy.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li><strong>Supabase:</strong> Hosts our database, authentication, file storage, and serverless functions. Stores your account info, recipes, inventory, and uploaded images.</li>
              <li><strong>Google Sign-In:</strong> If you choose to sign in with Google, Google shares your name, email, and profile identifier with us. Governed by the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Privacy Policy</a>.</li>
              <li><strong>Apple Sign-In:</strong> If you choose to sign in with Apple, Apple shares your name and an email (real or relay) with us. Governed by the <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Apple Privacy Policy</a>.</li>
              <li><strong>Google Gemini, via the Lovable AI Gateway:</strong> Processes recipe prompts, receipt images, and cookbook photos to generate AI responses, as described in section 4. Does not train models on your content.</li>
              <li><strong>Firecrawl:</strong> Used when you import a recipe from a URL, to fetch and parse the public web page you provided. Receives only that URL.</li>
              <li><strong>Kroger and Apify:</strong> Retrieve store prices for grocery items you choose to price. Receive the item search term and your postal code.</li>
              <li><strong>Open Food Facts:</strong> Barcode lookup. Receives only the scanned barcode.</li>
              <li><strong>Accept.blue:</strong> Processes subscription payments made on this website. Card details are handled directly by Accept.blue and never stored on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">7. How We Share Information</h2>

            <p className="text-muted-foreground leading-relaxed">We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li><strong>Service providers</strong> that host our infrastructure, process payments, deliver email, and provide AI model APIs, under contractual confidentiality obligations.</li>
              <li><strong>Legal authorities</strong> when required by law, subpoena, or to protect our rights and users.</li>
              <li><strong>Business transfers</strong> in connection with a merger, acquisition, or sale of assets, with notice to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide
              the Service. When you delete your account, we permanently remove your personal data and
              user content from our active systems, except where retention is required by law (e.g.,
              tax and payment records).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">9. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use industry-standard safeguards including encryption in transit (TLS), encrypted
              storage at rest, row-level security on user data, and two-factor authentication for
              administrative access. No method of transmission over the internet is 100% secure, and
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">10. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on where you live, you may have the right to access, correct, export, or
              delete your personal information, and to object to or restrict certain processing. You
              can exercise most of these rights directly from your account settings, or by contacting
              us at <a href="mailto:support@airecipemanager.com" className="text-primary underline">support@airecipemanager.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">11. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is not intended for children under 13 (or under 16 in the EEA/UK). We do not
              knowingly collect personal information from children. If you believe a child has
              provided us with personal information, please contact us so we can remove it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">12. International Users</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our servers are located in the United States. By using the Service, you consent to the
              transfer and processing of your information in the United States, which may have data
              protection laws different from those in your country.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">13. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to keep you signed in and analytics cookies to understand how
              the Service is used. You can control cookies through your browser settings; disabling
              them may affect functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">14. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Material changes will be announced
              within the Service or by email. Continued use after changes become effective constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">15. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy questions or requests, contact us at:{" "}
              <a href="mailto:support@airecipemanager.com" className="text-primary underline">
                support@airecipemanager.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12">
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </main>

      <footer className="bg-brand-navy text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-white/70">
          © {new Date().getFullYear()} airecipemanager.com
        </div>
      </footer>
    </div>
  );
};

export default Privacy;

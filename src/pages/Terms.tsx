import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/20 bg-brand-slate text-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-horizontal-white.svg" alt="AI Recipe Manager" className="h-8 w-auto" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-4xl font-bold text-foreground">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="prose prose-slate mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using AI Recipe Manager ("the Service"), operated by airecipemanager.com
              ("we," "us," or "our"), you agree to be bound by these Terms and Conditions ("Terms"). If
              you do not agree to these Terms, you must not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              AI Recipe Manager is a software-as-a-service (SaaS) platform that provides recipe
              management, kitchen inventory tracking, AI-powered meal planning, grocery list
              generation, and related digital tools.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">3. Eligibility & Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old to create an account. You are responsible for
              maintaining the confidentiality of your account credentials and for all activity that
              occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">4. Subscription Plans & Billing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We offer free and paid subscription tiers (Starter, Home Cook, Chef Pro, and Unlimited).
              Paid subscriptions are billed monthly in advance through our payment processor. By
              subscribing, you authorize us to charge your payment method on a recurring basis until
              you cancel.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>All prices are listed in U.S. Dollars (USD).</li>
              <li>Subscriptions automatically renew at the end of each billing cycle.</li>
              <li>You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period.</li>
              <li>Applicable taxes may be added to your charges.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">5. Refund Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Subscription fees are non-refundable except where required by law. If you believe you
              were charged in error, contact us within 30 days at support@airecipemanager.com and we
              will review your request in good faith.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">6. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-muted-foreground">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorized access to the Service or its related systems.</li>
              <li>Upload malicious code, viruses, or content that infringes intellectual property rights.</li>
              <li>Resell, sublicense, or commercially exploit the Service without our written consent.</li>
              <li>Use automated means to scrape, harvest, or collect data from the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">7. User Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of recipes, photos, and other content you upload ("User Content").
              By submitting User Content, you grant us a non-exclusive, worldwide, royalty-free license
              to host, store, display, and process it solely to operate and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">8. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service uses artificial intelligence to generate recipes, meal suggestions, and
              other content. AI output may contain inaccuracies. You are solely responsible for
              verifying ingredient safety, allergens, cooking temperatures, and dietary suitability
              before consumption. We make no warranties regarding the accuracy or safety of
              AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">9. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All software, branding, trademarks, and content provided by us remain our exclusive
              property. These Terms do not grant you any rights to our intellectual property except as
              expressly set forth herein.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">10. Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy, which describes how we
              collect, use, and protect your information. Payment card data is handled exclusively by
              our PCI-compliant payment processor and is never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your access to the Service at any time for violation of
              these Terms. You may terminate your account at any time by deleting it from your account
              settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">12. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">13. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, our total liability arising out of or related to
              these Terms or the Service shall not exceed the amount you paid us in the twelve (12)
              months preceding the claim. We shall not be liable for indirect, incidental, special, or
              consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">14. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. Continued use of the Service after changes
              become effective constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">15. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the United States, without regard to conflict of
              law principles. Any disputes shall be resolved in the courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">16. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, contact us at:{" "}
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

export default Terms;

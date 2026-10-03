import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Brain, Package, CalendarDays, ShoppingCart, Camera,
  Check, ArrowRight, Receipt, Smartphone, Wallet,
} from "lucide-react";
import heroImg from "@/assets/hero-kitchen.jpg";
import plannerImg from "@/assets/feature-planner.jpg";
import groceryImg from "@/assets/feature-grocery.jpg";
import inventoryImg from "@/assets/feature-inventory.jpg";

const SIGNUP = "/auth?mode=signup";
const signupFor = (plan: string) => `/auth?mode=signup&plan=${plan}`;

const features = [
  {
    icon: Brain,
    title: "AI Chef",
    description:
      "Ask for anything — \"authentic carbonara\", \"something with the chicken I have\" — and get a complete recipe with steps and amounts.",
  },
  {
    icon: BookOpen,
    title: "Import from any URL",
    description:
      "Paste a link to any recipe site and get a clean, readable recipe: ingredients, steps, times. No life story, no ads.",
  },
  {
    icon: Camera,
    title: "Scan from a photo",
    description:
      "Photograph a cookbook page or a handwritten card and it becomes a saved recipe you can search and cook from.",
  },
  {
    icon: Package,
    title: "Kitchen inventory",
    description:
      "Track your pantry, fridge and freezer with quantities, locations and expiration dates. Scan barcodes to add items fast.",
  },
  {
    icon: CalendarDays,
    title: "Meal planning",
    description:
      "Plan a week or a month, meal by meal. Set your own meal times and subscribe to it from Google or Apple Calendar.",
  },
  {
    icon: ShoppingCart,
    title: "Smart grocery lists",
    description:
      "Built from your meal plan, grouped by aisle, and aware of what's already in your kitchen. Nothing ever disappears off the list.",
  },
  {
    icon: Receipt,
    title: "Receipt scanning",
    description:
      "Snap a grocery receipt to restock your inventory and record what you spent, without typing a thing.",
  },
  {
    icon: Wallet,
    title: "Grocery budget",
    description:
      "See budget against actual, spending by category and how your shopping changes over the months.",
  },
];

const steps = [
  { n: "01", title: "Stock your kitchen", text: "Scan barcodes or a receipt to fill your inventory in minutes." },
  { n: "02", title: "Find what to cook", text: "Import favourites, scan a cookbook page, or ask AI Chef for ideas." },
  { n: "03", title: "Plan your week", text: "Drop recipes onto the calendar for breakfast, lunch, dinner and snacks." },
  { n: "04", title: "Shop smarter", text: "Get a grocery list by aisle, minus what you already have at home." },
];

const plans = [
  { key: "free", name: "Free", price: "$0", cadence: "forever", recipes: "Save up to 25 recipes", cta: "Start free" },
  { key: "basic", name: "Basic", price: "$5.99", cadence: "/month", recipes: "Save up to 100 recipes", cta: "Choose Basic" },
  { key: "pro", name: "Pro", price: "$12.99", cadence: "/month", recipes: "Save up to 500 recipes", cta: "Choose Pro", popular: true },
  { key: "unlimited", name: "Unlimited", price: "$24.99", cadence: "/month", recipes: "Save unlimited recipes", cta: "Choose Unlimited" },
];

const faqs = [
  {
    q: "Is AI Recipe Manager free?",
    a: "Yes. Every feature is free, including AI recipes, meal planning, inventory and grocery lists. The free plan saves up to 25 recipes; paid plans raise that limit and nothing else.",
  },
  {
    q: "Do I need an account to try it?",
    a: "No. You can use the app without creating an account. Make an account later if you want your recipes on more than one device.",
  },
  {
    q: "Does it work on iPhone and Android?",
    a: "It works in any browser today, and the iPhone and Android apps are in testing now. Sign up and you can install the test versions from your dashboard.",
  },
  {
    q: "How does the AI know what I have?",
    a: "It reads the kitchen inventory you build by scanning barcodes, scanning receipts or typing items in, then suggests recipes that use what's there — respecting any allergies and diets you set.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Subscriptions are monthly and you can cancel whenever you like from your account page. You keep access until the end of the period you've paid for.",
  },
  {
    q: "Does it handle allergies and diets?",
    a: "Yes. Set your diets and allergies once — vegetarian, keto, gluten-free, nut allergies and more — and every AI suggestion avoids them.",
  },
];

/** Structured data so search engines can show pricing and the FAQ directly. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "AI Recipe Manager",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web, iOS, Android",
      url: "https://airecipemanager.com",
      description:
        "Plan meals, track your kitchen inventory, and build smart grocery lists. AI recipes from what you already have.",
      offers: plans.map((p) => ({
        "@type": "Offer",
        name: `${p.name} plan`,
        price: p.price.replace("$", ""),
        priceCurrency: "USD",
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const Landing = () => {
  // Inject structured data for crawlers; removed on unmount so it never leaks
  // onto the app pages.
  useEffect(() => {
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.text = JSON.stringify(JSON_LD);
    document.head.appendChild(tag);
    return () => {
      document.head.removeChild(tag);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur">
        <nav className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="" className="h-8 w-8" />
            <span className="font-semibold tracking-tight">AI Recipe Manager</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</a>
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">Blog</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to={SIGNUP}>
              <Button size="sm">Start free</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="bg-brand-slate text-white">
        <div className="container mx-auto grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Web today · iPhone &amp; Android in testing
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] md:text-5xl lg:text-6xl">
              Your kitchen.<br />
              <span className="text-accent">Simplified.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Plan your meals, cut food waste, and cook with what you already have — with AI that
              knows what's in your kitchen.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={SIGNUP}>
                <Button size="lg" className="gap-2">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/beta">
                <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <Smartphone className="mr-2 h-4 w-4" /> Get the mobile apps
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/70">
              Free forever for 25 recipes. No credit card, and you can try it without an account.
            </p>
          </div>
          <div>
            <img
              src={heroImg}
              alt="Fresh vegetables and a phone showing a meal plan on a kitchen counter"
              className="w-full rounded-2xl shadow-2xl"
              width={1200}
              height={800}
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Features</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Everything your kitchen needs, nothing it doesn't
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every feature below is included on every plan — including the free one.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <article key={f.title} className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                <f.icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to={SIGNUP}>
              <Button size="lg">Try every feature free</Button>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">No account needed to try it.</p>
          </div>
        </div>
      </section>

      {/* ---------- Deep dives ---------- */}
      <section className="bg-secondary/20 py-20 md:py-28">
        <div className="container mx-auto space-y-20 px-4">
          {[
            {
              img: plannerImg,
              alt: "A weekly meal plan laid out by day",
              title: "Plan every meal, effortlessly",
              text: "Drop recipes onto a weekly or monthly calendar for breakfast, lunch, dinner and snacks. Set the times you actually eat, then subscribe to the plan from Google or Apple Calendar so it's on every device you own.",
              bullets: ["Weekly and monthly views", "Your own meal times", "Calendar subscription included"],
            },
            {
              img: inventoryImg,
              alt: "Kitchen shelves of labelled ingredients",
              title: "Know what's in your kitchen",
              text: "Scan barcodes or a grocery receipt to build your inventory in minutes. Quantities, storage locations and expiration dates mean food gets used before it goes off — and the AI only suggests meals you can actually make.",
              bullets: ["Barcode and receipt scanning", "Expiration awareness", "Pantry, fridge and freezer"],
              reverse: true,
            },
            {
              img: groceryImg,
              alt: "A grocery list beside fresh produce",
              title: "Shop smarter, waste less",
              text: "Your grocery list builds itself from the meals you planned, grouped by aisle, with anything you already own moved aside rather than removed. Check prices before you go, and scan the receipt afterwards to close the loop.",
              bullets: ["Grouped by aisle", "Knows what you have", "Price lookup and budget tracking"],
            },
          ].map((row) => (
            <div key={row.title} className="grid items-center gap-10 md:grid-cols-2">
              <img
                src={row.img}
                alt={row.alt}
                className={`w-full rounded-2xl shadow-lg ${row.reverse ? "md:order-2" : ""}`}
                width={1200}
                height={800}
                loading="lazy"
              />
              <div>
                <h2 className="text-2xl font-bold md:text-3xl">{row.title}</h2>
                <p className="mt-4 text-muted-foreground">{row.text}</p>
                <ul className="mt-5 space-y-2">
                  {row.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> {b}
                    </li>
                  ))}
                </ul>
                <Link to={SIGNUP} className="mt-6 inline-block">
                  <Button variant="outline" className="gap-2">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="bg-brand-slate py-20 text-white md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">How it works</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Four steps to a calmer kitchen</h2>
          </div>
          <ol className="mt-14 grid gap-10 md:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n}>
                <div className="text-3xl font-bold text-accent">{s.n}</div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-white/75">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 text-center">
            <Link to={SIGNUP}>
              <Button size="lg">Start free in minutes</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Every feature, free. Pay only for more saved recipes.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Plans change one thing: how many recipes you can keep. Nothing is locked behind a
              subscription.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div
                key={p.key}
                className={`relative rounded-xl border bg-card p-6 ${
                  p.popular ? "border-primary shadow-lg" : "border-border"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-3">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.cadence}</span>
                </p>
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> {p.recipes}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> Every feature included
                </p>
                <Link to={p.key === "free" ? SIGNUP : signupFor(p.key)} className="mt-6 block">
                  <Button variant={p.popular ? "default" : "outline"} className="w-full">
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            Subscriptions renew monthly and can be cancelled any time from your account. Prices in
            USD; in the apps, billing goes through the App Store or Google Play.
          </p>
        </div>
      </section>

      {/* ---------- Mobile beta ---------- */}
      <section className="bg-secondary/20 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
            <Smartphone className="h-7 w-7 text-primary" aria-hidden />
            <h2 className="text-2xl font-bold">Try the mobile apps early</h2>
            <p className="text-muted-foreground">
              The iPhone and Android apps are in testing now. Sign up free on the web, then install
              the test version on your phone — same account, everything syncs.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={SIGNUP}><Button size="lg">Start free</Button></Link>
              <Link to="/beta"><Button size="lg" variant="outline">Get the test apps</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="py-20 md:py-28">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Questions, answered</h2>
          </div>
          <dl className="mt-10 divide-y divide-border">
            {faqs.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-2 text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="bg-brand-slate py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to simplify your kitchen?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Start free in minutes. Every feature included, no credit card, and no account needed to
            look around.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={SIGNUP}><Button size="lg">Start free</Button></Link>
            <Link to="/beta">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Get the mobile apps
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto grid gap-8 px-4 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="" className="h-7 w-7" />
              <span className="font-semibold">AI Recipe Manager</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Meal planning and kitchen inventory for web, iPhone and Android.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><Link to="/beta" className="hover:text-foreground">Mobile apps</Link></li>
              <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Account</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to={SIGNUP} className="hover:text-foreground">Create an account</Link></li>
              <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
              <li><a href="/support.html" className="hover:text-foreground">Support</a></li>
              <li><Link to="/delete-account" className="hover:text-foreground">Delete account</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              <li>
                <a href="mailto:support@airecipemanager.com" className="hover:text-foreground">
                  support@airecipemanager.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="container mx-auto mt-10 px-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} AI Manager LLC. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Landing;

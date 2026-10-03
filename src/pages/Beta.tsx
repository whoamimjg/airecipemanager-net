import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Smartphone, Apple } from "lucide-react";
import { ANDROID_TEST_URL, IOS_TESTFLIGHT_URL, hasIosBeta } from "@/lib/beta";

/**
 * Public page people can be pointed at from anywhere (dashboard card, email,
 * social) to install the pre-release apps.
 */
const Beta = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="container mx-auto flex items-center gap-2 px-4 py-4">
        <ChefHat className="h-6 w-6 text-primary" />
        <Link to="/" className="font-serif text-lg font-semibold">AI Recipe Manager</Link>
      </div>
    </header>

    <main className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-serif text-3xl font-bold">Try the mobile apps</h1>
      <p className="mt-3 text-muted-foreground">
        The iPhone and Android apps aren't in the stores yet, but you can install the test versions
        today. Sign in with the same account you use on the website and everything — your recipes,
        inventory, meal plans and plan — is already there.
      </p>

      <div className="mt-8 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Smartphone className="h-5 w-5 text-primary" /> Android
            </CardTitle>
            <CardDescription>Install from Google Play, as a tester.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Open the link below on the phone, signed in with your Google account.</li>
              <li>Tap <strong>Become a tester</strong>.</li>
              <li>Tap <strong>Download it on Google Play</strong> and install as usual.</li>
            </ol>
            <Button asChild className="w-full sm:w-auto">
              <a href={ANDROID_TEST_URL} target="_blank" rel="noopener noreferrer">
                Join the Android test
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Please stay in the test for at least two weeks — Google requires it before the app can
              be released publicly.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Apple className="h-5 w-5 text-primary" /> iPhone and iPad
            </CardTitle>
            <CardDescription>
              {hasIosBeta ? "Install through Apple's TestFlight app." : "Coming very soon."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasIosBeta ? (
              <>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Install <strong>TestFlight</strong> from the App Store.</li>
                  <li>Open the link below on the iPhone.</li>
                  <li>Tap <strong>Accept</strong>, then <strong>Install</strong>.</li>
                </ol>
                <Button asChild className="w-full sm:w-auto">
                  <a href={IOS_TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer">
                    Join the iPhone test
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                The iPhone app is with Apple for review. Check back here shortly — this page will
                have the TestFlight link as soon as it's approved.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Something broken or confusing? Email{" "}
        <a className="text-primary underline" href="mailto:support@airecipemanager.com">
          support@airecipemanager.com
        </a>{" "}
        — test feedback is genuinely useful.
      </p>
    </main>
  </div>
);

export default Beta;

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Smartphone, Apple } from "lucide-react";
import { ANDROID_TEST_URL, ANDROID_TESTER_GROUP_URL, IOS_APP_STORE_URL } from "@/lib/beta";

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
      <h1 className="font-serif text-3xl font-bold">Get the mobile apps</h1>
      <p className="mt-3 text-muted-foreground">
        The iPhone app is on the App Store. The Android app is in testing and you can install the
        test version today. Sign in with the same account you use on the website and everything — your recipes,
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
              <li>
                On the phone, signed in with your Google account, open the tester group and tap{" "}
                <strong>Join group</strong>. Google Play only lets group members install the test.
              </li>
              <li>Open the Play link, with the same Google account, and tap <strong>Become a tester</strong>.</li>
              <li>Tap <strong>Download it on Google Play</strong> and install as usual.</li>
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={ANDROID_TESTER_GROUP_URL} target="_blank" rel="noopener noreferrer">
                  1. Join the tester group
                </a>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <a href={ANDROID_TEST_URL} target="_blank" rel="noopener noreferrer">
                  2. Join the Android test
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Seeing “App not available” on Play? That means step 1 hasn’t been done with this Google account yet.
            </p>
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
            <CardDescription>On the App Store.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full sm:w-auto">
              <a href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                <Apple className="mr-2 h-4 w-4" /> Download on the App Store
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Requires iOS 18.2 or later. Sign in with the account you use on the website.
            </p>
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

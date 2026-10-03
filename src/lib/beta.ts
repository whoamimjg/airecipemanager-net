/**
 * Links to the pre-release mobile apps. The apps aren't in the stores yet, so
 * everyone who signs up on the web is invited to test them — which also feeds
 * Google's requirement of 12 testers opted in for 14 days before an Android app
 * can go to production.
 *
 * Set IOS_TESTFLIGHT_URL once the TestFlight public link exists (App Store
 * Connect → TestFlight → external group → Public Link); the UI hides the iOS
 * option until then.
 */
export const ANDROID_TEST_URL = "https://play.google.com/apps/testing/com.michaelgreene.airecipemanager";
export const IOS_TESTFLIGHT_URL = ""; // TestFlight public link not serving invites yet — set back to https://testflight.apple.com/join/2KDzUARf once a build is approved for external testing

export const hasIosBeta = IOS_TESTFLIGHT_URL.length > 0;

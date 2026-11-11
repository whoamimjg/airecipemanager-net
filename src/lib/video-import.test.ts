import { describe, it, expect } from 'vitest';
import { isVideoRecipeUrl } from './video-import';

describe('video import routing', () => {
  it.each(['https://vm.tiktok.com/abc/', 'https://www.tiktok.com/@chef/video/123', 'https://www.instagram.com/reel/abc/?igsh=123'])('routes %s to the video extractor', url => expect(isVideoRecipeUrl(url)).toBe(true));
  it.each(['https://www.allrecipes.com/recipe/123', 'https://tiktok.com.evil.test/@chef/video/123', 'not a URL'])('preserves website routing for %s', url => expect(isVideoRecipeUrl(url)).toBe(false));
});

# Compare The Same Page Between Two Versions Of The Same Site Prior Rolling Out

**Current status**: Working, but I need to update links and document. This is
just written (October 2024) and had been useful to compare
[renoirboulanger.com](https://renoirboulanger.com) versus the newer version
written in [renoirb/site](https://github.com/renoirb/site) on branch 2020.
Essentially migrating 19 years of content that was never reviewed over the
years.

It’s a tool to help compare pages of the same Web site before a major code
upgrade:

- To make sure All URLs OK (or at least as much as possible —
  [Cool URIs Do Not Change](https://www.w3.org/Provider/Style/URI))
- Allow comparing the same page, even when a page changed URL on the new version

To allow us quickly flip through files, compare visually, and take notes.

See [**Compare The Same Page Between Two Versions Of The Same Site Prior Rolling
Out** on _renoirboulanger.com_][project-url]

This utility is running with Deno and leverages Playwright.

[project-url]:
  https://renoirboulanger-com.pages.dev/projects/tools-compare-same-page-between-two-versions

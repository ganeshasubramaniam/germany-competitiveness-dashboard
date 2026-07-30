import assert from "node:assert/strict";
import test from "node:test";
import { curateNews, parseFeed } from "../scripts/lib/news.mjs";

const source = {
  id: "destatis",
  name: "Destatis",
  kind: "official-statistics",
  authority: 4,
};

test("parseFeed reads RSS without retaining article bodies", () => {
  const items = parseFeed(
    `<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[Industrieproduktion steigt um 2,4 %]]></title>
      <link>https://example.test/release?utm_source=rss</link>
      <guid>release-1</guid>
      <pubDate>Thu, 30 Jul 2026 08:00:00 GMT</pubDate>
      <description>Copyrighted body that must not be retained.</description>
    </item></channel></rss>`,
    source,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Industrieproduktion steigt um 2,4 %");
  assert.equal("description" in items[0], false);
});

test("curateNews publishes authoritative quantified priority releases", () => {
  const news = curateNews(
    [
      {
        ...source,
        source: source.name,
        sourceId: source.id,
        id: "release-1",
        title: "Industrieproduktion steigt um 2,4 %",
        url: "https://example.test/release?utm_source=rss",
        publishedAt: "2026-07-30T08:00:00.000Z",
      },
      {
        ...source,
        source: source.name,
        sourceId: source.id,
        id: "release-2",
        title: "Interview zur Sommerveranstaltung",
        url: "https://example.test/interview",
        publishedAt: "2026-07-30T09:00:00.000Z",
      },
    ],
    new Date("2026-07-30T12:00:00Z"),
  );
  assert.equal(news.length, 1);
  assert.equal(news[0].score, 8);
  assert.deepEqual(news[0].topics, ["Macro & demand", "Industry & investment"]);
  assert.equal(news[0].url, "https://example.test/release");
});

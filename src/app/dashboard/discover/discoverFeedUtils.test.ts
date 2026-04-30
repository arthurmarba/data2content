import { prepareDiscoverSections } from "./discoverFeedUtils";

describe("prepareDiscoverSections", () => {
  it("deduplicates repeated post ids within the same section", () => {
    const freshDate = new Date().toISOString();

    const result = prepareDiscoverSections([
      {
        key: "trending",
        title: "Em alta agora",
        items: [
          { id: "698e69935279cc65a29ed204", postDate: freshDate, coverUrl: "/thumb-1.jpg" },
          { id: "698e69935279cc65a29ed204", postDate: freshDate, coverUrl: "/thumb-1b.jpg" },
          { id: "698e69935279cc65a29ed205", postDate: freshDate, coverUrl: "/thumb-2.jpg" },
        ],
      },
    ]);

    expect(result.featuredSection?.items.map((item) => item.id)).toEqual([
      "698e69935279cc65a29ed204",
      "698e69935279cc65a29ed205",
    ]);
  });
});

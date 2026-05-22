(function () {
  const SOURCE_HOSTS = [
    {
      source: "ebay",
      test: (host) => host.includes("ebay.")
    },
    {
      source: "comc",
      test: (host) => host.includes("comc.com")
    }
  ];

  function getSource() {
    const declaredSource = document.documentElement.dataset.cmSource || document.body?.dataset.cmSource;
    if (declaredSource === "ebay" || declaredSource === "comc") {
      return declaredSource;
    }

    const host = window.location.hostname.toLowerCase();
    return SOURCE_HOSTS.find((entry) => entry.test(host))?.source || "unknown";
  }

  function textFrom(element, selectors) {
    for (const selector of selectors) {
      const target = element.querySelector(selector);
      const text = target?.textContent?.trim();

      if (text) {
        return text.replace(/\s+/g, " ");
      }
    }

    return "";
  }

  function cleanTitle(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isBadTitle(title) {
    return !title
      || title.length < 7
      || /^shop on ebay$/i.test(title)
      || /^\d[\d,+]*\+?\s+results?\s+for\b/i.test(title)
      || /\bsave this search\b/i.test(title)
      || /\bwe.ve streamlined your search results\b/i.test(title);
  }

  function closestTitleFromItemLinks(image) {
    const maxDepth = 9;
    let node = image.parentElement;

    for (let depth = 0; node && depth < maxDepth; depth += 1) {
      const links = Array.from(node.querySelectorAll("a[href*='/itm/'], a[href*='itm/']"));
      const titles = links
        .map((link) => cleanTitle(link.getAttribute("title") || link.textContent || link.getAttribute("aria-label")))
        .filter((title) => !isBadTitle(title))
        .sort((a, b) => b.length - a.length);

      if (titles[0]) {
        return titles[0];
      }

      node = node.parentElement;
    }

    return "";
  }

  function nearestListingRoot(image, source) {
    const selectors = source === "ebay"
      ? [
          "li.s-item",
          ".s-item",
          "[data-testid='item-card']",
          ".brwrvr__item-card",
          ".brwrvr__item-card__body",
          ".su-card-container",
          ".s-card",
          ".vim.x-item-title",
          ".x-item-title"
        ]
      : [
          ".item",
          ".card",
          ".search-result",
          ".row",
          "main",
          "body"
        ];

    for (const selector of selectors) {
      const root = image.closest(selector);
      if (root) {
        return root;
      }
    }

    return image.parentElement || document.body;
  }

  function titleForImage(image, source) {
    if (source === "ebay") {
      const itemLinkTitle = closestTitleFromItemLinks(image);
      if (itemLinkTitle) {
        return itemLinkTitle;
      }
    }

    const root = nearestListingRoot(image, source);
    const sourceSelectors = source === "ebay"
      ? [
          ".s-item__title",
          "[data-testid='item-title']",
          ".brwrvr__item-card__title",
          ".su-card-title",
          ".s-card__title",
          "h1.x-item-title__mainTitle",
          "[data-testid='x-item-title']",
          "a[title]"
        ]
      : [
          ".title",
          ".item-title",
          ".name",
          "h1",
          "h2",
          "a[title]"
        ];

    const title = cleanTitle(textFrom(root, sourceSelectors));
    if (!isBadTitle(title)) {
      return title;
    }

    const fallbackTitle = cleanTitle(image.alt || image.getAttribute("aria-label") || "");
    return isBadTitle(fallbackTitle) ? "" : fallbackTitle;
  }

  function isLikelyCardImage(image) {
    const rect = image.getBoundingClientRect();
    const src = image.currentSrc || image.src || "";
    const text = `${image.alt || ""} ${src}`.toLowerCase();

    if (rect.width < 80 || rect.height < 80) {
      return false;
    }

    if (text.includes("sprite") || text.includes("logo") || text.includes("avatar")) {
      return false;
    }

    return Boolean(src);
  }

  function getImageContainer(image) {
    const candidates = [
      image.parentElement,
      image.closest("picture"),
      image.closest("a"),
      image
    ].filter(Boolean);

    return candidates.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width >= image.getBoundingClientRect().width && rect.height >= image.getBoundingClientRect().height;
    }) || image.parentElement;
  }

  function findListings() {
    const source = getSource();

    return Array.from(document.images)
      .filter(isLikelyCardImage)
      .map((image, index) => {
        const title = titleForImage(image, source);

        return {
          id: `${source}-${index}-${Math.round(image.getBoundingClientRect().top)}`,
          source,
          title,
          image,
          container: getImageContainer(image),
          pageUrl: window.location.href
        };
      })
      .filter((listing) => listing.title.length > 6 && listing.container);
  }

  window.CMRarityParser = {
    findListings,
    getSource
  };
})();

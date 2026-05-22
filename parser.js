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

  function nearestListingRoot(image, source) {
    const selectors = source === "ebay"
      ? [
          "li.s-item",
          ".s-item",
          ".vim.x-item-title",
          ".x-item-title",
          "main",
          "body"
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
    const root = nearestListingRoot(image, source);
    const sourceSelectors = source === "ebay"
      ? [
          ".s-item__title",
          "h1.x-item-title__mainTitle",
          "[data-testid='x-item-title']",
          "h1",
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

    const title = textFrom(root, sourceSelectors);
    if (title && !/^shop on ebay$/i.test(title)) {
      return title;
    }

    return image.alt?.trim() || image.getAttribute("aria-label")?.trim() || "";
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

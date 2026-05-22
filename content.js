(function () {
  const processedImages = new WeakSet();
  const lookupPromises = new Map();

  function shouldSkipListing(listing) {
    return processedImages.has(listing.image) || !listing.title || listing.source === "unknown";
  }

  async function loadRarityForListing(listing) {
    const cacheKey = `${listing.source}:${listing.title}:${listing.pageUrl}`;

    if (!lookupPromises.has(cacheKey)) {
      lookupPromises.set(cacheKey, window.CMRarityApi.fetchRarity({
        title: listing.title,
        source: listing.source,
        pageUrl: listing.pageUrl
      }));
    }

    return lookupPromises.get(cacheKey);
  }

  function enhanceListing(listing) {
    processedImages.add(listing.image);

    let hasCountedLookup = false;
    let hasLoaded = false;

    const widget = window.CMRarityUI.attachBadge(listing, {
      async onOpen(panel) {
        const accessState = await window.CMRarityStorage.getAccessState();

        if (!accessState.isPaid && !accessState.hasFreeLookup && !hasLoaded) {
          widget.renderLimitPanel(accessState);
          return;
        }

        if (!hasLoaded) {
          window.CMRarityUI.renderLoading(panel);
        }

        try {
          const rarity = await loadRarityForListing(listing);

          if (!accessState.isPaid && !hasCountedLookup) {
            await window.CMRarityStorage.incrementDailyUsage();
            hasCountedLookup = true;
          }

          hasLoaded = true;
          const refreshedAccessState = await window.CMRarityStorage.getAccessState();
          widget.renderPanel(rarity, refreshedAccessState);
        } catch (error) {
          window.CMRarityUI.renderError(panel);
        }
      }
    });
  }

  function scan() {
    window.CMRarityParser.findListings()
      .filter((listing) => !shouldSkipListing(listing))
      .slice(0, 80)
      .forEach(enhanceListing);
  }

  function startObserver() {
    const observer = new MutationObserver(() => {
      window.clearTimeout(startObserver.scanTimer);
      startObserver.scanTimer = window.setTimeout(scan, 300);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  scan();
  startObserver();
})();

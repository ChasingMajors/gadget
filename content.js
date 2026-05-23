(function () {
  const processedImages = new WeakSet();
  const lookupPromises = new Map();
  let hasAttachedMasterBadge = false;

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

  function isUsefulMasterRarity(rarity) {
    return !rarity.isFallback
      && rarity.rarityTier !== "Unknown"
      && (rarity.matchMode === "set" || rarity.printRun || rarity.packOdds)
      && Number(rarity.matchConfidence || 0) >= 0.54;
  }

  function attachMasterBadge(searchTitle, rarity) {
    if (hasAttachedMasterBadge) {
      return;
    }

    hasAttachedMasterBadge = true;
    const listing = {
      id: "ebay-master-search",
      source: "ebay",
      title: searchTitle,
      image: null,
      container: document.body,
      pageUrl: window.location.href
    };

    let hasCountedLookup = false;
    const widget = window.CMRarityUI.attachBadge(listing, {
      async onOpen(panel) {
        const accessState = await window.CMRarityStorage.getAccessState();

        if (!accessState.isPaid && !accessState.hasFreeLookup && !hasCountedLookup) {
          widget.renderLimitPanel(accessState);
          return;
        }

        if (!accessState.isPaid && !hasCountedLookup) {
          await window.CMRarityStorage.incrementDailyUsage();
          hasCountedLookup = true;
        }

        const refreshedAccessState = await window.CMRarityStorage.getAccessState();
        widget.renderPanel(rarity, refreshedAccessState);
      }
    }, {
      master: true,
      label: "🧠",
      ariaLabel: "Show Chasing Majors search rarity intelligence",
      panelPosition: {
        align: "center"
      }
    });
  }

  async function maybeAttachMasterBadge() {
    if (hasAttachedMasterBadge || window.CMRarityParser.getSource() !== "ebay") {
      return;
    }

    const searchTitle = window.CMRarityParser.titleFromEbaySearch?.();
    if (!searchTitle) {
      return;
    }

    try {
      const rarity = await window.CMRarityApi.fetchRarity({
        title: searchTitle,
        source: "ebay",
        pageUrl: window.location.href
      });

      if (isUsefulMasterRarity(rarity)) {
        attachMasterBadge(searchTitle, rarity);
      }
    } catch (error) {
      // Master badge is opportunistic; listing badges remain available.
    }
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
  maybeAttachMasterBadge();
  startObserver();
})();

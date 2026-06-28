(function () {
  const SOURCE_HOSTS = [
    {
      source: "ebay",
      test: (host) => host.includes("ebay.")
    },
    {
      source: "comc",
      test: (host) => host.includes("comc.com")
    },
    {
      source: "sportlots",
      test: (host) => host.includes("sportlots.com")
    }
  ];

  function getSource() {
    const declaredSource = document.documentElement.dataset.cmSource || document.body?.dataset.cmSource;
    if (declaredSource === "ebay" || declaredSource === "comc" || declaredSource === "sportlots") {
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
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isBadTitle(title) {
    return !title
      || title.length < 7
      || /^shop on ebay$/i.test(title)
      || /^\$[\d,.]+/.test(title)
      || /^get srp$/i.test(title)
      || /^\d+\s+from$/i.test(title)
      || /^\d+d\s+left\b/i.test(title)
      || /^\d[\d,+]*\+?\s+results?\s+for\b/i.test(title)
      || /\bsave this search\b/i.test(title)
      || /\bwe.ve streamlined your search results\b/i.test(title);
  }

  function firstCardYear(title) {
    const text = String(title || "");
    const fullYearMatch = text.match(/\b(19\d{2}|20\d{2})(?:\s*[-/]\s*\d{2,4})?\b/);
    if (fullYearMatch) {
      return Number(fullYearMatch[1]);
    }

    const shortSeasonMatch = text.match(/(?:^|\b)([5-9]\d)\s*[-/]\s*(\d{2})(?=\b|[^a-z0-9])/i);
    if (shortSeasonMatch) {
      return 1900 + Number(shortSeasonMatch[1]);
    }

    return null;
  }

  function isSupportedCardYear(title) {
    const year = firstCardYear(title);
    return year === null || year >= 1990;
  }

  function cleanComcTitlePart(text) {
    return cleanTitle(text)
      .replace(/\bX[-\s]?Fractors?\b/gi, "Xfractors")
      .replace(/\[(?=[^\]]*(?:psa|bgs|sgc|cgc|gem|mint|pristine|nm|mt|ex|vg|good|auth))[^\]]+\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function comcSportFromUrl() {
    const declaredSport = document.documentElement.dataset.cmSport || document.body?.dataset.cmSport;
    if (declaredSport) {
      return declaredSport;
    }

    const path = window.location.pathname || window.location.href || "";
    const match = path.match(/\/(?:Cards|Players)\/(Basketball|Baseball|Football|Hockey|Soccer)\b/i)
      || path.match(/\/Players\/(Basketball|Baseball|Football|Hockey|Soccer)\b/i);
    return match ? match[1] : "";
  }

  function enrichComcTitle(title) {
    const sport = comcSportFromUrl();
    if (!sport || new RegExp(`\\b${sport}\\b`, "i").test(title)) {
      return title;
    }

    return cleanTitle(`${title} ${sport}`);
  }

  function sportFromText(text) {
    const match = String(text || "").match(/\b(Basketball|Baseball|Football|Hockey|Soccer)\b/i);
    return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : "";
  }

  function seasonYearForSport(yearText, sport) {
    const year = firstCardYear(yearText);
    if (!year) {
      return "";
    }

    if (/^\d{4}\s*[-/]\s*\d{2,4}$/.test(String(yearText || "").trim())) {
      return String(yearText).replace(/\s+/g, "");
    }

    if (/^(?:basketball|hockey)$/i.test(sport || "")) {
      return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
    }

    return String(year);
  }

  let cachedEbaySport;
  function ebaySportFromContext(root) {
    if (cachedEbaySport) {
      return cachedEbaySport;
    }

    if (cachedEbaySport === undefined) {
      const urlSport = sportFromText(window.location.href);
      if (urlSport) {
        cachedEbaySport = urlSport;
        return cachedEbaySport;
      }

      const titleSport = sportFromText(document.title);
      if (titleSport) {
        cachedEbaySport = titleSport;
        return cachedEbaySport;
      }

      const breadcrumbText = Array.from(document.querySelectorAll?.("nav[aria-label*='Breadcrumb' i], .breadcrumbs, .breadcrumb, [data-testid*='breadcrumb' i]") || [])
        .map((element) => cleanTitle(element?.textContent || ""))
        .join(" ");
      cachedEbaySport = sportFromText(breadcrumbText) || "";
    }

    return cachedEbaySport || sportFromText(root?.textContent || "");
  }

  function enrichEbayTitle(title, root) {
    const sport = ebaySportFromContext(root);
    if (!sport || new RegExp(`\\b${sport}\\b`, "i").test(title)) {
      return title;
    }

    return cleanTitle(`${title} ${sport}`);
  }

  let cachedSportlotsSport;
  function sportlotsSportFromContext(root) {
    if (cachedSportlotsSport) {
      return cachedSportlotsSport;
    }

    if (cachedSportlotsSport === undefined) {
      const urlSport = sportFromText(window.location.href);
      if (urlSport) {
        cachedSportlotsSport = urlSport;
        return cachedSportlotsSport;
      }

      const titleSport = sportFromText(document.title);
      if (titleSport) {
        cachedSportlotsSport = titleSport;
        return cachedSportlotsSport;
      }

      const breadcrumbText = Array.from(document.querySelectorAll?.(".breadcrumbs, .breadcrumb, nav, h1, h2") || [])
        .map((element) => cleanTitle(element?.textContent || ""))
        .join(" ");
      cachedSportlotsSport = sportFromText(breadcrumbText) || "";
    }

    return cachedSportlotsSport || sportFromText(root?.textContent || "");
  }

  function normalizeSportlotsProduct(rest) {
    const productRules = [
      [/^bowman'?s\s+best\b/i, "Bowman's Best"],
      [/^bowman\s+best\b/i, "Bowman's Best"],
      [/^fleer\s+ultra\b/i, "Fleer Ultra"],
      [/^ultra\b/i, "Fleer Ultra"],
      [/^topps\s+finest\b/i, "Topps Finest"],
      [/^finest\b/i, "Topps Finest"],
      [/^fleer\s+tradition\b/i, "Fleer Tradition"],
      [/^tradition\b/i, "Fleer Tradition"],
      [/^topps\s+chrome\b/i, "Topps Chrome"],
      [/^chrome\b/i, "Topps Chrome"],
      [/^topps\s+stadium\s+club\b/i, "Topps Stadium Club"],
      [/^stadium\s+club\b/i, "Topps Stadium Club"],
      [/^upper\s+deck\s+spx\b/i, "Upper Deck SPx"],
      [/^spx\b/i, "Upper Deck SPx"],
      [/^upper\s+deck\s+sp\b/i, "Upper Deck SP"],
      [/^sp\b/i, "Upper Deck SP"]
    ];

    for (const [pattern, product] of productRules) {
      const match = rest.match(pattern);
      if (match) {
        return {
          product,
          remainder: cleanTitle(rest.slice(match[0].length))
        };
      }
    }

    const fallback = rest.match(/^([A-Z][A-Za-z'&.]+(?:\s+[A-Z][A-Za-z'&.]+){0,2})\b/);
    if (!fallback) {
      return {
        product: "",
        remainder: rest
      };
    }

    return {
      product: fallback[1],
      remainder: cleanTitle(rest.slice(fallback[1].length))
    };
  }

  function normalizeSportlotsModifier(text) {
    return cleanTitle(text)
      .replace(/\bRefractors\b/gi, "Refractor")
      .replace(/\bX[-\s]?Fractors?\b/gi, "X-Fractor");
  }

  function normalizeSportlotsTitle(title, root) {
    const raw = cleanTitle(title)
      .replace(/\b(?:single|card|cards|set|lot)\b$/i, "")
      .trim();
    const match = raw.match(/^\s*((?:19|20)\d{2}(?:\s*[-/]\s*\d{2,4})?|\d{2}\s*[-/]\s*\d{2})\s+(.+)$/);
    if (!match) {
      return raw;
    }

    const sport = sportlotsSportFromContext(root);
    const year = seasonYearForSport(match[1], sport);
    const { product, remainder } = normalizeSportlotsProduct(match[2]);
    if (!year || !product) {
      return sport && !new RegExp(`\\b${sport}\\b`, "i").test(raw) ? cleanTitle(`${raw} ${sport}`) : raw;
    }

    const modifier = normalizeSportlotsModifier(remainder);
    return cleanTitle([
      `${year} ${product}`,
      sport,
      modifier ? `- ${modifier}` : ""
    ].filter(Boolean).join(" "));
  }

  function humanizeComcPathPart(part) {
    return decodeURIComponent(String(part || ""))
      .replace(/[_+]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function comcTitleFromCardUrl(url) {
    if (!url) {
      return "";
    }

    try {
      const pathParts = new URL(url, window.location.href).pathname.split("/").filter(Boolean);
      const cardsIndex = pathParts.findIndex((part) => part.toLowerCase() === "cards");
      if (cardsIndex < 0) {
        return "";
      }

      const sport = humanizeComcPathPart(pathParts[cardsIndex + 1]);
      const year = humanizeComcPathPart(pathParts[cardsIndex + 2]);
      const product = humanizeComcPathPart(pathParts[cardsIndex + 3]);
      const number = humanizeComcPathPart(pathParts[cardsIndex + 4]);
      const player = humanizeComcPathPart(pathParts[cardsIndex + 5]);

      if (!year || !product) {
        return "";
      }

      return cleanTitle([
        year,
        product,
        number ? `#${number.replace(/^#/, "")}` : "",
        player,
        sport
      ].filter(Boolean).join(" "));
    } catch (error) {
      return "";
    }
  }

  function textLinesFrom(element) {
    const blockText = element.innerText || element.textContent || "";
    return blockText
      .replace(/\u00a0/g, " ")
      .split(/\n+/)
      .map(cleanComcTitlePart)
      .filter((line) => !isBadTitle(line));
  }

  function isComcSetLine(line) {
    return /^(?:19|20)\d{2}(?:\s*[-/]\s*\d{2,4})?\s+.+/i.test(line)
      && !/\ball\s+cards\b/i.test(line)
      && !/\blistings?\b/i.test(line);
  }

  function isComcDetailLine(line) {
    return !isComcSetLine(line)
      && !/^(?:basketball|baseball|football|hockey|soccer|cards?|set name|card #|description|srp|price|qty)$/i.test(line)
      && !/\b(?:sort by|select|attributes|players|teams)\b/i.test(line);
  }

  function serialTextFromComcLine(line) {
    const match = String(line || "").match(/#?\s*\/\s*([\d,]{1,9})\b/);
    return match ? `#/${match[1]}` : "";
  }

  function mergeComcSetAndDetail(setLine, detailLine) {
    const cleanSetLine = cleanTitle(setLine);
    const cleanDetailLine = cleanTitle(detailLine);

    if (!cleanDetailLine) {
      return cleanSetLine;
    }

    const serialText = serialTextFromComcLine(cleanDetailLine);
    const normalizedSet = cleanSetLine.toLowerCase();
    const detailWithoutSerial = cleanTitle(cleanDetailLine.replace(/#?\s*\/\s*[\d,]{1,9}\b/g, ""));

    if (detailWithoutSerial && !normalizedSet.includes(detailWithoutSerial.toLowerCase())) {
      return cleanTitle([cleanSetLine, cleanDetailLine].join(" "));
    }

    if (serialText && !normalizedSet.includes(serialText.toLowerCase())) {
      return cleanTitle([cleanSetLine, serialText].join(" "));
    }

    return cleanSetLine;
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
      : source === "sportlots"
        ? [
            "tr",
            ".card",
            ".item",
            ".set",
            ".search-result",
            ".product",
            "li",
            "article",
            "main",
            "body"
          ]
      : [
          ".item",
          ".card",
          ".cardItem",
          ".card-item",
          ".card-list-item",
          ".product",
          ".product-list-item",
          ".search-result",
          "li",
          "article",
          "tr",
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

  function comcTitleForImage(image) {
    const root = nearestListingRoot(image, "comc");
    const cardLink = image.closest("a[href*='/Cards/']")
      || root.querySelector("a[href*='/Cards/']");
    const cardHref = cardLink?.href || cardLink?.getAttribute("href") || "";
    const linkedTitle = cleanComcTitlePart(cardLink?.getAttribute("title") || cardLink?.textContent || "");
    const imageTitle = cleanComcTitlePart(image.getAttribute("title") || image.alt || image.getAttribute("aria-label") || "");
    const urlTitle = comcTitleFromCardUrl(cardHref || image.closest("a")?.href || image.closest("a")?.getAttribute("href") || "");

    const selectorText = [
      ".set-name",
      ".setName",
      ".card-title",
      ".cardTitle",
      ".item-title",
      ".itemTitle",
      ".title",
      ".description",
      ".player",
      ".name",
      "h1",
      "h2",
      "h3",
      "h4",
      "a[title]"
    ]
      .map((selector) => Array.from(root.querySelectorAll(selector)))
      .flat()
      .map((element) => cleanComcTitlePart(element.getAttribute("title") || element.textContent))
      .filter((title) => !isBadTitle(title));

    const lines = Array.from(new Set([
      linkedTitle,
      imageTitle,
      urlTitle,
      ...selectorText,
      ...textLinesFrom(root),
    ].filter(Boolean)));

    const directTitle = [imageTitle, linkedTitle, urlTitle]
      .find((title) => isComcSetLine(title));
    if (directTitle) {
      const detailLine = lines.find((line) => line !== directTitle && isComcDetailLine(line));
      return enrichComcTitle(mergeComcSetAndDetail(directTitle, detailLine));
    }

    const setLineIndex = lines.findIndex(isComcSetLine);
    if (setLineIndex >= 0) {
      const setLine = lines[setLineIndex];
      const detailLine = lines.slice(setLineIndex + 1).find(isComcDetailLine)
        || lines.find((line, index) => index !== setLineIndex && isComcDetailLine(line));
      return enrichComcTitle(mergeComcSetAndDetail(setLine, detailLine));
    }

    const fallback = lines.find((line) => !isBadTitle(line)) || "";
    return fallback ? enrichComcTitle(fallback) : "";
  }

  function sportlotsTitleForImage(image) {
    const root = nearestListingRoot(image, "sportlots");
    const cardLink = image.closest("a")
      || root.querySelector("a[title]")
      || root.querySelector("a");

    const candidates = [
      cardLink?.getAttribute?.("title"),
      cardLink?.textContent,
      image.getAttribute("title"),
      image.alt,
      image.getAttribute("aria-label"),
      ...Array.from(root.querySelectorAll("a[title], td, .title, .item-title, h1, h2, h3"))
        .map((element) => cleanTitle(element.getAttribute?.("title") || element.textContent || ""))
    ]
      .map(cleanTitle)
      .filter((candidate) => !isBadTitle(candidate))
      .filter((candidate) => /(?:19|20)\d{2}|\b\d{2}\s*[-/]\s*\d{2}\b/.test(candidate))
      .sort((a, b) => b.length - a.length);

    return candidates[0] ? normalizeSportlotsTitle(candidates[0], root) : "";
  }

  function titleForImage(image, source) {
    if (source === "ebay") {
      const root = nearestListingRoot(image, source);
      const itemLinkTitle = closestTitleFromItemLinks(image);
      if (itemLinkTitle) {
        return enrichEbayTitle(itemLinkTitle, root);
      }
    }

    if (source === "comc") {
      return comcTitleForImage(image);
    }

    if (source === "sportlots") {
      return sportlotsTitleForImage(image);
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
      return source === "ebay" ? enrichEbayTitle(title, root) : title;
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

  function yearContextForListing(image, container, title) {
    const cardLink = image.closest("a")
      || container?.querySelector?.("a[href*='/Cards/'], a[href*='/itm/'], a[href*='itm/'], a[title]");

    return [
      title,
      window.location.href,
      image.alt,
      image.getAttribute("title"),
      image.getAttribute("aria-label"),
      image.currentSrc,
      image.src,
      cardLink?.href,
      cardLink?.getAttribute?.("href"),
      cardLink?.getAttribute?.("title"),
      cardLink?.textContent,
      container?.innerText,
      container?.textContent
    ].filter(Boolean).join(" ");
  }

  function isPlainComcBaseCardTitle(text) {
    const raw = String(text || "");
    const normalized = raw.toLowerCase();
    const plainBaseLabel = /\[\s*base\s*\]\s*#/.test(normalized)
      && !/\[\s*base\s*\]\s*-/.test(normalized);
    const plainBaseUrl = isPlainComcBaseImageUrl(raw);

    return plainBaseLabel || plainBaseUrl;
  }

  function isPlainComcBaseImageUrl(url) {
    return /\/(?:cards|i)\/(?:basketball|baseball|football|hockey|soccer)\/(?:19|20)\d{2}(?:[-/]\d{2,4})?\/[^/\s?]+---base\/\d+\b/i.test(String(url || ""));
  }

  function urlContextFromElement(element) {
    if (!element) {
      return "";
    }

    const attributeNames = typeof element.getAttributeNames === "function"
      ? element.getAttributeNames()
      : [
          "src",
          "currentSrc",
          "srcset",
          "data-src",
          "data-original",
          "data-original-src",
          "data-lazy-src",
          "data-srcset",
          "href"
        ];
    const attributes = attributeNames.map((name) => element.getAttribute?.(name));
    const datasetValues = element.dataset ? Object.values(element.dataset) : [];

    return [
      element.currentSrc,
      element.src,
      element.href,
      ...attributes,
      ...datasetValues
    ].filter(Boolean).join(" ");
  }

  function imageUrlContext(image) {
    const container = image?.closest?.("picture") || image?.parentElement;
    const relatedElements = [
      image,
      image?.closest?.("a"),
      container,
      ...Array.from(container?.querySelectorAll?.("source, img, a") || [])
    ].filter(Boolean);

    return relatedElements.map(urlContextFromElement).filter(Boolean).join(" ");
  }

  function isUnsupportedComcBaseImage(image) {
    return isPlainComcBaseImageUrl(imageUrlContext(image));
  }

  function isSupportedListing(listing) {
    if (listing.source === "comc" && isPlainComcBaseCardTitle(`${listing.title} ${listing.yearContext}`)) {
      return false;
    }

    return isSupportedCardYear(listing.yearContext || listing.title);
  }

  function findListings() {
    const source = getSource();

    return Array.from(document.images)
      .filter(isLikelyCardImage)
      .filter((image) => source !== "comc" || !isUnsupportedComcBaseImage(image))
      .map((image, index) => {
        const title = titleForImage(image, source);
        const root = nearestListingRoot(image, source);
        const container = getImageContainer(image);

        return {
          id: `${source}-${index}-${Math.round(image.getBoundingClientRect().top)}`,
          source,
          title,
          image,
          container,
          yearContext: yearContextForListing(image, root || container, title),
          pageUrl: window.location.href
        };
      })
      .filter((listing) => listing.title.length > 6
        && listing.container
        && isSupportedListing(listing));
  }

  function titleFromEbaySearch() {
    if (getSource() !== "ebay") {
      return "";
    }

    const params = new URLSearchParams(window.location.search || "");
    const query = cleanTitle(params.get("_nkw") || "");
    if (!isBadTitle(query) && isSupportedCardYear(query)) {
      return query;
    }

    const input = document.querySelector("input[name='_nkw'], input[aria-label*='Search']");
    const inputTitle = cleanTitle(input?.value || input?.getAttribute("value") || "");
    if (!isBadTitle(inputTitle) && isSupportedCardYear(inputTitle)) {
      return inputTitle;
    }

    return "";
  }

  window.CMRarityParser = {
    findListings,
    titleFromEbaySearch,
    getSource,
    isPlainComcBaseCardTitle,
    isPlainComcBaseImageUrl,
    isUnsupportedComcBaseImage,
    isSupportedCardYear,
    normalizeSportlotsTitle
  };
})();

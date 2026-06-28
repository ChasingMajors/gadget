const fs = require("fs");
const vm = require("vm");

const parserSource = fs.readFileSync("parser.js", "utf8");

function makeElement({ tag = "div", text = "", attrs = {}, className = "", children = [], parent = null } = {}) {
  const element = {
    tag,
    textContent: text,
    parentElement: parent,
    children,
    className,
    dataset: {},
    style: {},
    get innerText() {
      return [this.textContent, ...(this.children || []).map((child) => child.innerText)].filter(Boolean).join("\n");
    },
    getAttribute(name) {
      return attrs[name] || null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const results = [];
      const selectors = selector.split(",").map((part) => part.trim());

      function matches(node, singleSelector) {
        if (singleSelector === "a[title]") {
          return node.tag === "a" && Boolean(node.attrs?.title);
        }
        if (singleSelector.includes("href*='/Cards/'")) {
          return node.tag === "a" && String(node.attrs?.href || "").includes("/Cards/");
        }
        if (singleSelector.includes("href*='/itm/'") || singleSelector.includes("href*='itm/'")) {
          return node.tag === "a" && String(node.attrs?.href || "").includes("/itm/");
        }
        if (singleSelector.startsWith(".")) {
          return String(node.className || "").split(" ").includes(singleSelector.slice(1));
        }
        if (singleSelector.startsWith("[data-testid='")) {
          return node.attrs?.["data-testid"] === singleSelector.slice(15, -2);
        }
        if (/^[a-z][a-z0-9]*$/i.test(singleSelector)) {
          return node.tag === singleSelector.toLowerCase();
        }
        return false;
      }

      function walk(node) {
        for (const child of node.children || []) {
          if (selectors.some((singleSelector) => matches(child, singleSelector))) {
            results.push(child);
          }
          walk(child);
        }
      }

      walk(this);
      return results;
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (selector.startsWith(".") && String(node.className || "").split(" ").includes(selector.slice(1))) {
          return node;
        }
        if (selector.startsWith("[data-testid='") && node.attrs?.["data-testid"] === selector.slice(15, -2)) {
          return node;
        }
        if (selector.includes("href*='/Cards/'") && node.tag === "a" && String(node.attrs?.href || "").includes("/Cards/")) {
          return node;
        }
        if (/^[a-z][a-z0-9]*$/i.test(selector) && node.tag === selector.toLowerCase()) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    },
    getBoundingClientRect() {
      return {
        width: attrs.width || 240,
        height: attrs.height || 320,
        top: attrs.top || 0
      };
    }
  };

  element.attrs = attrs;
  children.forEach((child) => {
    child.parentElement = element;
  });
  return element;
}

const image = makeElement({
  tag: "img",
  attrs: {
    width: 240,
    height: 320,
    src: "https://i.ebayimg.com/images/example.jpg"
  }
});
image.alt = "";
image.src = image.attrs.src;
image.currentSrc = image.attrs.src;

const listingLink = makeElement({
  tag: "a",
  text: "2025-26 Topps NBA Flagship Basketball Ace Bailey RC Rookie #205 Utah Jazz Base",
  attrs: {
    href: "https://www.ebay.com/itm/123",
    title: "2025-26 Topps NBA Flagship Basketball Ace Bailey RC Rookie #205 Utah Jazz Base"
  },
  children: [image]
});

const card = makeElement({
  className: "su-card-container",
  children: [listingLink]
});

const pageHeading = makeElement({
  tag: "h1",
  text: "11,000+ results for 2025-26 ace bailey"
});

const body = makeElement({
  children: [pageHeading, card]
});

const context = {
  window: {
    location: {
      hostname: "www.ebay.com",
      href: "https://www.ebay.com/sch/i.html?_nkw=2025-26+ace+bailey"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body,
    documentElement: {
      dataset: {}
    },
    images: [image]
  }
};

vm.createContext(context);
vm.runInContext(parserSource, context);

const listings = context.window.CMRarityParser.findListings();
const title = listings[0]?.title;
const expected = "2025-26 Topps NBA Flagship Basketball Ace Bailey RC Rookie #205 Utah Jazz Base";

if (title !== expected) {
  console.error(`Parser validation failed. Expected "${expected}" but got "${title}"`);
  process.exit(1);
}

if (context.window.CMRarityParser.isSupportedCardYear("1989 Upper Deck Ken Griffey Jr. Rookie #1")) {
  console.error("Parser validation failed. Pre-1990 cards should be skipped.");
  process.exit(1);
}

if (context.window.CMRarityParser.isSupportedCardYear("86-87 Fleer Michael Jordan Rookie #57")) {
  console.error("Parser validation failed. Short pre-1990 seasons should be skipped.");
  process.exit(1);
}

if (context.window.CMRarityParser.isSupportedCardYear("89-90 Hoops David Robinson Rookie #138")) {
  console.error("Parser validation failed. 1989-90 seasons should be skipped.");
  process.exit(1);
}

if (!context.window.CMRarityParser.isSupportedCardYear("1990 Topps Frank Thomas Rookie #414")) {
  console.error("Parser validation failed. 1990 cards should remain supported.");
  process.exit(1);
}

if (!context.window.CMRarityParser.isSupportedCardYear("90-91 SkyBox Basketball Michael Jordan #41")) {
  console.error("Parser validation failed. Short 1990-91 seasons should remain supported.");
  process.exit(1);
}

if (!context.window.CMRarityParser.isSupportedCardYear("Topps Chrome Refractor Basketball")) {
  console.error("Parser validation failed. Listings without an explicit year should remain supported.");
  process.exit(1);
}

const oldImage = makeElement({
  tag: "img",
  attrs: {
    width: 240,
    height: 320,
    src: "https://i.ebayimg.com/images/old-card.jpg"
  }
});
oldImage.alt = "";
oldImage.src = oldImage.attrs.src;
oldImage.currentSrc = oldImage.attrs.src;

const oldListingLink = makeElement({
  tag: "a",
  text: "Nolan Ryan Baseball Card",
  attrs: {
    href: "https://www.ebay.com/itm/456",
    title: "Nolan Ryan Baseball Card"
  },
  children: [oldImage]
});

const oldListingYear = makeElement({
  tag: "span",
  text: "1981 Topps"
});

const oldCard = makeElement({
  className: "su-card-container",
  children: [oldListingLink, oldListingYear]
});

const oldContext = {
  window: {
    location: {
      hostname: "www.ebay.com",
      href: "https://www.ebay.com/sch/i.html?_nkw=nolan+ryan"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: makeElement({
      children: [oldCard]
    }),
    documentElement: {
      dataset: {}
    },
    images: [oldImage]
  }
};

vm.createContext(oldContext);
vm.runInContext(parserSource, oldContext);

if (oldContext.window.CMRarityParser.findListings().length !== 0) {
  console.error("Parser validation failed. Pre-1990 listing context should suppress the gadget.");
  process.exit(1);
}

const comcBasePathImage = makeElement({
  tag: "img",
  attrs: {
    width: 220,
    height: 310,
    src: "https://img.comc.com/i/Football/1998/Metal-Universe---Base/42/Emmitt-Smith.jpg?id=af5b0f28-3e5b-4a49-889e-d67d39fcabc1&size=biggerthumb"
  }
});
comcBasePathImage.alt = "";
comcBasePathImage.src = comcBasePathImage.attrs.src;
comcBasePathImage.currentSrc = comcBasePathImage.attrs.src;

const comcBasePathContext = {
  URL,
  window: {
    URL,
    location: {
      hostname: "www.comc.com",
      href: "https://www.comc.com/Cards/Football/1998/Metal-Universe---Base/42/Emmitt_Smith"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: makeElement({
      children: [comcBasePathImage]
    }),
    documentElement: {
      dataset: {}
    },
    images: [comcBasePathImage]
  }
};

vm.createContext(comcBasePathContext);
vm.runInContext(parserSource, comcBasePathContext);

if (comcBasePathContext.window.CMRarityParser.findListings().length !== 0) {
  console.error("COMC parser validation failed. Base image path should suppress the gadget before title parsing.");
  process.exit(1);
}

const comcImage = makeElement({
  tag: "img",
  attrs: {
    width: 220,
    height: 310,
    src: "https://img.comc.com/i/Basketball/2025-26/Topps/201/Cooper-Flagg.jpg",
    title: "2025-26 Topps - [Base] #201 Cooper Flagg [PSA 10 GEM MT]"
  }
});
comcImage.alt = "2025-26 Topps - [Base] #201 Cooper Flagg [PSA 10 GEM MT]";
comcImage.src = comcImage.attrs.src;
comcImage.currentSrc = comcImage.attrs.src;

const comcSetLine = makeElement({
  tag: "a",
  className: "card-title",
  text: "2025-26 Topps - [Base] #201",
  attrs: {
    href: "https://www.comc.com/Cards/Basketball/2025-26/Topps/201/Cooper_Flagg"
  }
});

const comcPlayerLine = makeElement({
  tag: "h3",
  className: "name",
  text: "Cooper Flagg [PSA 10 GEM MT] #/1,265,000"
});

const comcPrice = makeElement({
  tag: "span",
  text: "$98.18"
});

const comcCard = makeElement({
  className: "cardItem",
  children: [comcImage, comcSetLine, comcPlayerLine, comcPrice]
});

const comcBody = makeElement({
  children: [comcCard]
});

const comcUrlOnlyImage = makeElement({
  tag: "img",
  attrs: {
    width: 220,
    height: 310,
    src: "https://img.comc.com/i/Basketball/2025-26/Topps_Chrome/251/Cooper-Flagg.jpg"
  }
});
comcUrlOnlyImage.alt = "";
comcUrlOnlyImage.src = comcUrlOnlyImage.attrs.src;
comcUrlOnlyImage.currentSrc = comcUrlOnlyImage.attrs.src;

const comcUrlOnlyLink = makeElement({
  tag: "a",
  attrs: {
    href: "https://www.comc.com/Cards/Basketball/2025-26/Topps_Chrome/251/Cooper_Flagg"
  },
  children: [comcUrlOnlyImage]
});

const comcUrlOnlyCard = makeElement({
  className: "item",
  children: [comcUrlOnlyLink]
});

const comcContext = {
  URL,
  window: {
    URL,
    location: {
      hostname: "www.comc.com",
      href: "https://www.comc.com/Players/Basketball/Cooper_Flagg/c465571/Cards/Basketball"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: comcBody,
    documentElement: {
      dataset: {}
    },
    images: [comcImage]
  }
};

vm.createContext(comcContext);
vm.runInContext(parserSource, comcContext);

const comcListings = comcContext.window.CMRarityParser.findListings();

if (comcListings.length !== 0) {
  console.error("COMC parser validation failed. Plain [Base] # cards should suppress the gadget.");
  process.exit(1);
}

[
  "1998 Topps - [Base] #25",
  "1998 Ultra - [Base] #370",
  "1998 Upper Deck UD Choice - [Base] #323",
  "1998 Metal Universe - [Base] #42",
  "1998 Topps [Base] #25",
  "https://img.comc.com/i/Football/1998/Metal-Universe---Base/42/Emmitt-Smith.jpg?id=af5b0f28-3e5b-4a49-889e-d67d39fcabc1&size=biggerthumb"
].forEach((title) => {
  if (!comcContext.window.CMRarityParser.isPlainComcBaseCardTitle(title)) {
    console.error(`COMC plain base detector failed for "${title}"`);
    process.exit(1);
  }
});

if (comcContext.window.CMRarityParser.isPlainComcBaseCardTitle("1998 SPx - [Base] - Gold #1")) {
  console.error("COMC plain base detector should keep [Base] - parallel cards.");
  process.exit(1);
}

if (!comcContext.window.CMRarityParser.isPlainComcBaseImageUrl("https://img.comc.com/i/Football/1998/Metal-Universe---Base/42/Emmitt-Smith.jpg?id=af5b0f28-3e5b-4a49-889e-d67d39fcabc1&size=biggerthumb")) {
  console.error("COMC base image URL detector failed for the live base path.");
  process.exit(1);
}

[
  "https://img.comc.com/i/Football/1998/Bowman-Chrome---Base---Interstate/105/Emmitt-Smith.jpg?id=a323c823-1bf7-4c75-828c-2bc7accaeb13&size=biggerthumb",
  "https://img.comc.com/i/Football/1998/Pacific-Crown-Royale---Pillars-of-the-Game/4/Emmitt-Smith.jpg?id=790f2b3d-4307-4607-876f-51d30b1d672b&size=biggerthumb"
].forEach((title) => {
  if (comcContext.window.CMRarityParser.isPlainComcBaseCardTitle(title)) {
    console.error(`COMC plain base detector should keep "${title}"`);
    process.exit(1);
  }
  if (comcContext.window.CMRarityParser.isPlainComcBaseImageUrl(title)) {
    console.error(`COMC base image URL detector should keep "${title}"`);
    process.exit(1);
  }
});

const comcAuctionImage = makeElement({
  tag: "img",
  attrs: {
    width: 220,
    height: 310,
    src: "https://img.comc.com/i/Basketball/2025-26/Bowman/GL-5/Ace-Bailey.jpg",
    title: "2025-26 Bowman - Greatness Loading - Refractor #GL-5"
  }
});
comcAuctionImage.alt = "2025-26 Bowman - Greatness Loading - Refractor #GL-5";
comcAuctionImage.src = comcAuctionImage.attrs.src;
comcAuctionImage.currentSrc = comcAuctionImage.attrs.src;

const comcAuctionSetLine = makeElement({
  tag: "a",
  className: "card-title",
  text: "2025-26 Bowman - Greatness Loading - Refractor #GL-5",
  attrs: {
    href: "https://www.comc.com/Cards/Basketball/2025-26/Bowman/GL-5/Ace_Bailey"
  }
});

const comcAuctionPlayerLine = makeElement({
  tag: "h3",
  className: "name",
  text: "Ace Bailey"
});

const comcAuctionTime = makeElement({
  tag: "span",
  text: "3d left (0) $0.99"
});

const comcAuctionCard = makeElement({
  className: "cardItem",
  children: [comcAuctionImage, comcAuctionSetLine, comcAuctionPlayerLine, comcAuctionTime]
});

const comcAuctionContext = {
  URL,
  window: {
    URL,
    location: {
      hostname: "www.comc.com",
      href: "https://www.comc.com/Players/Basketball/Ace_Bailey/c555555/Cards/Basketball"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: makeElement({
      children: [comcAuctionCard]
    }),
    documentElement: {
      dataset: {}
    },
    images: [comcAuctionImage]
  }
};

vm.createContext(comcAuctionContext);
vm.runInContext(parserSource, comcAuctionContext);

const comcAuctionTitle = comcAuctionContext.window.CMRarityParser.findListings()[0]?.title;
const expectedComcAuctionTitle = "2025-26 Bowman - Greatness Loading - Refractor #GL-5 Ace Bailey Basketball";

if (comcAuctionTitle !== expectedComcAuctionTitle) {
  console.error(`COMC auction parser validation failed. Expected "${expectedComcAuctionTitle}" but got "${comcAuctionTitle}"`);
  process.exit(1);
}

const comcSerialImage = makeElement({
  tag: "img",
  attrs: {
    width: 220,
    height: 310,
    src: "https://img.comc.com/i/Basketball/2025-26/Bowman/BCV-5/Ace-Bailey.jpg",
    title: "2025-26 Bowman - Chrome - Blue Reptilian Refractor #BCV-5"
  }
});
comcSerialImage.alt = "2025-26 Bowman - Chrome - Blue Reptilian Refractor #BCV-5";
comcSerialImage.src = comcSerialImage.attrs.src;
comcSerialImage.currentSrc = comcSerialImage.attrs.src;

const comcSerialSetLine = makeElement({
  tag: "a",
  className: "card-title",
  text: "2025-26 Bowman - Chrome - Blue Reptilian Refractor #BCV-5",
  attrs: {
    href: "https://www.comc.com/Cards/Basketball/2025-26/Bowman/BCV-5/Ace_Bailey"
  }
});

const comcSerialPlayerLine = makeElement({
  tag: "h3",
  className: "name",
  text: "Ace Bailey #/150"
});

const comcSerialCard = makeElement({
  className: "cardItem",
  children: [comcSerialImage, comcSerialSetLine, comcSerialPlayerLine]
});

const comcSerialContext = {
  URL,
  window: {
    URL,
    location: {
      hostname: "www.comc.com",
      href: "https://www.comc.com/Players/Basketball/Ace_Bailey/c555555/Cards/Basketball"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: makeElement({
      children: [comcSerialCard]
    }),
    documentElement: {
      dataset: {}
    },
    images: [comcSerialImage]
  }
};

vm.createContext(comcSerialContext);
vm.runInContext(parserSource, comcSerialContext);

const comcSerialTitle = comcSerialContext.window.CMRarityParser.findListings()[0]?.title;
const expectedComcSerialTitle = "2025-26 Bowman - Chrome - Blue Reptilian Refractor #BCV-5 Ace Bailey #/150 Basketball";

if (comcSerialTitle !== expectedComcSerialTitle) {
  console.error(`COMC serial parser validation failed. Expected "${expectedComcSerialTitle}" but got "${comcSerialTitle}"`);
  process.exit(1);
}

const comcGradedSerialImage = makeElement({
  tag: "img",
  attrs: {
    width: 220,
    height: 310,
    src: "https://img.comc.com/i/Basketball/2025-26/Topps-Now-Draft/D2/Dylan-Harper.jpg",
    title: "2025-26 Topps Now Draft - Online Exclusive [Base] - Orange Foil #D2"
  }
});
comcGradedSerialImage.alt = "2025-26 Topps Now Draft - Online Exclusive [Base] - Orange Foil #D2";
comcGradedSerialImage.src = comcGradedSerialImage.attrs.src;
comcGradedSerialImage.currentSrc = comcGradedSerialImage.attrs.src;

const comcGradedSerialSetLine = makeElement({
  tag: "a",
  className: "card-title",
  text: "2025-26 Topps Now Draft - Online Exclusive [Base] - Orange Foil #D2",
  attrs: {
    href: "https://www.comc.com/Cards/Basketball/2025-26/Topps_Now_Draft/D2/Dylan_Harper"
  }
});

const comcGradedSerialPlayerLine = makeElement({
  tag: "h3",
  className: "name",
  text: "Dylan Harper [PSA 9 MINT] #/25"
});

const comcGradedSerialCard = makeElement({
  className: "cardItem",
  children: [comcGradedSerialImage, comcGradedSerialSetLine, comcGradedSerialPlayerLine]
});

const comcGradedSerialContext = {
  URL,
  window: {
    URL,
    location: {
      hostname: "www.comc.com",
      href: "https://www.comc.com/Players/Basketball/Dylan_Harper/c555556/Cards/Basketball"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: makeElement({
      children: [comcGradedSerialCard]
    }),
    documentElement: {
      dataset: {}
    },
    images: [comcGradedSerialImage]
  }
};

vm.createContext(comcGradedSerialContext);
vm.runInContext(parserSource, comcGradedSerialContext);

const comcGradedSerialTitle = comcGradedSerialContext.window.CMRarityParser.findListings()[0]?.title;
const expectedComcGradedSerialTitle = "2025-26 Topps Now Draft - Online Exclusive [Base] - Orange Foil #D2 Dylan Harper #/25 Basketball";

if (comcGradedSerialTitle !== expectedComcGradedSerialTitle) {
  console.error(`COMC graded serial parser validation failed. Expected "${expectedComcGradedSerialTitle}" but got "${comcGradedSerialTitle}"`);
  process.exit(1);
}

const comcUrlContext = {
  URL,
  window: {
    URL,
    location: {
      hostname: "www.comc.com",
      href: "https://www.comc.com/Cards/Basketball/2025-26/Topps_Chrome/251/Cooper_Flagg",
      pathname: "/Cards/Basketball/2025-26/Topps_Chrome/251/Cooper_Flagg"
    },
    getComputedStyle() {
      return {
        position: "relative"
      };
    },
    CMRarityParser: null
  },
  document: {
    body: makeElement({
      children: [comcUrlOnlyCard]
    }),
    documentElement: {
      dataset: {}
    },
    images: [comcUrlOnlyImage]
  }
};

vm.createContext(comcUrlContext);
vm.runInContext(parserSource, comcUrlContext);

const comcUrlTitle = comcUrlContext.window.CMRarityParser.findListings()[0]?.title;
const expectedComcUrlTitle = "2025-26 Topps Chrome #251 Cooper Flagg Basketball";

if (comcUrlTitle !== expectedComcUrlTitle) {
  console.error(`COMC URL parser validation failed. Expected "${expectedComcUrlTitle}" but got "${comcUrlTitle}"`);
  process.exit(1);
}

function sportlotsContext({ hostname = "www.sportlots.com", href, rowText }) {
  const sportlotsImage = makeElement({
    tag: "img",
    attrs: {
      width: 220,
      height: 310,
      src: "https://img.sportlots.com/cards/example.jpg"
    }
  });
  sportlotsImage.alt = "";
  sportlotsImage.src = sportlotsImage.attrs.src;
  sportlotsImage.currentSrc = sportlotsImage.attrs.src;

  const sportlotsLink = makeElement({
    tag: "a",
    text: rowText,
    attrs: {
      href: "https://www.sportlots.com/card/example",
      title: rowText
    },
    children: [sportlotsImage]
  });

  const sportlotsCell = makeElement({
    tag: "td",
    text: rowText,
    children: [sportlotsLink]
  });

  const sportlotsRow = makeElement({
    tag: "tr",
    children: [sportlotsCell]
  });

  return {
    window: {
      location: {
        hostname,
        href
      },
      getComputedStyle() {
        return {
          position: "relative"
        };
      },
      CMRarityParser: null
    },
    document: {
      body: makeElement({
        children: [sportlotsRow]
      }),
      documentElement: {
        dataset: {}
      },
      images: [sportlotsImage]
    }
  };
}

const sportlotsBaseballContext = sportlotsContext({
  href: "https://www.sportlots.com/baseball/cards",
  rowText: "1998 Ultra Gold Medallion"
});
vm.createContext(sportlotsBaseballContext);
vm.runInContext(parserSource, sportlotsBaseballContext);

const sportlotsBaseballTitle = sportlotsBaseballContext.window.CMRarityParser.findListings()[0]?.title;
const expectedSportlotsBaseballTitle = "1998 Fleer Ultra Baseball - Gold Medallion";

if (sportlotsBaseballTitle !== expectedSportlotsBaseballTitle) {
  console.error(`Sportlots baseball parser validation failed. Expected "${expectedSportlotsBaseballTitle}" but got "${sportlotsBaseballTitle}"`);
  process.exit(1);
}

const sportlotsFinestContext = sportlotsContext({
  href: "https://www.sportlots.com/baseball/cards",
  rowText: "1999 Finest Split Screen Right Refractors"
});
vm.createContext(sportlotsFinestContext);
vm.runInContext(parserSource, sportlotsFinestContext);

const sportlotsFinestTitle = sportlotsFinestContext.window.CMRarityParser.findListings()[0]?.title;
const expectedSportlotsFinestTitle = "1999 Topps Finest Baseball - Split Screen Right Refractor";

if (sportlotsFinestTitle !== expectedSportlotsFinestTitle) {
  console.error(`Sportlots Finest parser validation failed. Expected "${expectedSportlotsFinestTitle}" but got "${sportlotsFinestTitle}"`);
  process.exit(1);
}

const sportlotsBasketballContext = sportlotsContext({
  href: "https://www.sportlots.com/basketball/cards",
  rowText: "1998 Ultra Gold Medallion"
});
vm.createContext(sportlotsBasketballContext);
vm.runInContext(parserSource, sportlotsBasketballContext);

const sportlotsBasketballTitle = sportlotsBasketballContext.window.CMRarityParser.findListings()[0]?.title;
const expectedSportlotsBasketballTitle = "1998-99 Fleer Ultra Basketball - Gold Medallion";

if (sportlotsBasketballTitle !== expectedSportlotsBasketballTitle) {
  console.error(`Sportlots basketball parser validation failed. Expected "${expectedSportlotsBasketballTitle}" but got "${sportlotsBasketballTitle}"`);
  process.exit(1);
}

console.log("CM Rarity parser validation passed.");

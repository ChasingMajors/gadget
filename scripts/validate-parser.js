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
const comcTitle = comcListings[0]?.title;
const expectedComc = "2025-26 Topps - [Base] #201 Cooper Flagg #/1,265,000 Basketball";

if (comcTitle !== expectedComc) {
  console.error(`COMC parser validation failed. Expected "${expectedComc}" but got "${comcTitle}"`);
  process.exit(1);
}

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

console.log("CM Rarity parser validation passed.");

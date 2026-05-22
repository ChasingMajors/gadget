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
        if (singleSelector.includes("href*='/itm/'") || singleSelector.includes("href*='itm/'")) {
          return node.tag === "a" && String(node.attrs?.href || "").includes("/itm/");
        }
        if (singleSelector.startsWith(".")) {
          return String(node.className || "").split(" ").includes(singleSelector.slice(1));
        }
        if (singleSelector.startsWith("[data-testid='")) {
          return node.attrs?.["data-testid"] === singleSelector.slice(15, -2);
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

console.log("CM Rarity parser validation passed.");
